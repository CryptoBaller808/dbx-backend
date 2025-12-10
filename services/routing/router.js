/**
 * Smart Hybrid Liquidity Router
 * Implements threshold-based routing strategy:
 * - < $1k: Best price
 * - $1k-$25k: Deepest liquidity
 * - > $25k: Split across top 2 venues
 */

const xrplGateHub = require('./providers/xrpl_gatehub_usd');
const xrplBitstamp = require('./providers/xrpl_bitstamp_usd');
const xrplUsdx = require('./providers/xrpl_usdx_retail');
const stellarUsdc = require('./providers/stellar_usdc_anchor');
const xdcUsdt = require('./providers/xdc_usdt_wrapped');
const { addDecision } = require('./decisionsBuffer');

// Feature flag and thresholds from environment
const ROUTING_ENGINE_V1 = process.env.ROUTING_ENGINE_V1 === 'true';
const ROUTING_ENGINE_LOG = process.env.ROUTING_ENGINE_LOG || 'info';
const ROUTING_THRESHOLD_LARGE_USD = parseInt(process.env.ROUTING_THRESHOLD_LARGE_USD) || 1000;
const ROUTING_THRESHOLD_SPLIT_USD = parseInt(process.env.ROUTING_THRESHOLD_SPLIT_USD) || 25000;

// Provider registry
const PROVIDERS = [
  { name: 'xrpl-gatehub', adapter: xrplGateHub },
  { name: 'xrpl-bitstamp', adapter: xrplBitstamp },
  { name: 'xrpl-usdx', adapter: xrplUsdx },
  { name: 'stellar-usdc', adapter: stellarUsdc },
  { name: 'xdc-usdt', adapter: xdcUsdt }
];

/**
 * Route a quote request through the smart hybrid router
 * @param {Object} params - Routing parameters
 * @param {string} params.base - Base currency
 * @param {string} params.quote - Quote currency
 * @param {string} params.side - Trade side ('buy' or 'sell')
 * @param {number} params.amountUsd - Trade amount in USD
 * @returns {Promise<Object>} Routing result
 */
async function routeQuote({ base, quote, side, amountUsd }) {
  if (!ROUTING_ENGINE_V1) {
    return {
      ok: false,
      code: 'ROUTING_DISABLED',
      message: 'Routing engine is disabled'
    };
  }

  // Stage 6C: Override routing for EVM pairs (ETH, BNB, AVAX, MATIC)
  const evmPairs = ['ETH', 'BNB', 'AVAX', 'MATIC'];
  const isEvmPair = evmPairs.includes(base.toUpperCase()) && quote.toUpperCase() === 'USDT';
  
  if (isEvmPair) {
    console.log(`[Router] EVM routing override for ${base}/${quote}`);
    return {
      ok: true,
      strategy: 'evm-demo',
      primary: 'binance',
      splits: [],
      chosen: {
        source: 'binance',
        strategy: 'evm-demo'
      },
      policy: {
        strategy: 'evm-demo',
        reason: 'EVM demo routing for Stage 6C'
      }
    };
  }

  const startTime = Date.now();

  try {
    // Query all providers in parallel
    const results = await Promise.allSettled(
      PROVIDERS.map(async ({ name, adapter }) => {
        try {
          const result = await adapter.getQuote({ base, quote, amountUsd });
          return { name, ...result };
        } catch (error) {
          return { name, ok: false, reason: error.message };
        }
      })
    );

    // Extract fulfilled results
    const fulfilledResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    // Filter for valid candidates
    const okCands = fulfilledResults.filter(r => 
      r && 
      r.ok && 
      Number.isFinite(r.price) && 
      r.source
    );

    // Guard: No viable candidates
    if (okCands.length === 0) {
      const providersStatus = fulfilledResults.map(r => ({
        source: r?.source || r?.name || 'unknown',
        ok: !!r?.ok,
        reason: r?.reason || r?.error || 'no-quote'
      }));

      // Record failed attempt
      const failedDecision = {
        timestamp: new Date().toISOString(),
        base,
        quote,
        amountUsd,
        side,
        chosenSource: null,
        price: null,
        feeBps: null,
        liquidityScore: null,
        estConfirmMs: null,
        split: false,
        elapsedMs: Date.now() - startTime,
        success: false,
        providers: providersStatus
      };
      
      addDecision(failedDecision);

      return {
        ok: false,
        code: 'NO_CANDIDATES',
        message: 'No viable routing providers returned a quote',
        providers: providersStatus
      };
    }

    // Calculate derived metrics for valid candidates
    const candidates = okCands.map(candidate => {
      const slippageBps = Math.round((1 - candidate.liquidityScore) * 100);
      const totalCostBps = candidate.feeBps + slippageBps;
      
      // Normalize price based on side
      const effectivePrice = side === 'buy' 
        ? candidate.price * (1 + totalCostBps / 10000)
        : candidate.price * (1 - totalCostBps / 10000);

      return {
        ...candidate,
        slippageBps,
        totalCostBps,
        effectivePrice
      };
    });

    // Apply routing strategy based on trade size
    const routing = applyRoutingStrategy(candidates, amountUsd, side);
    
    const elapsedMs = Date.now() - startTime;

    // Log routing decision
    const decisionRecord = {
      timestamp: new Date().toISOString(),
      base,
      quote,
      amountUsd,
      side,
      chosenSource: routing.chosen.source,
      price: routing.chosen.price,
      feeBps: routing.chosen.feeBps,
      liquidityScore: routing.chosen.liquidityScore,
      estConfirmMs: routing.chosen.estConfirmMs,
      split: routing.route.splits ? true : false,
      elapsedMs,
      success: true,
      providers: fulfilledResults.map(r => ({
        source: r?.source || r?.name || 'unknown',
        ok: !!r?.ok,
        reason: r?.ok ? 'success' : (r?.reason || 'no-quote')
      }))
    };
    
    logRoutingDecision(decisionRecord);
    addDecision(decisionRecord);

    return {
      ok: true,
      route: routing.route,
      chosen: routing.chosen,
      candidates: candidates.slice(0, 5), // Limit to top 5
      policy: {
        strategy: 'smart-hybrid',
        thresholds: {
          large: ROUTING_THRESHOLD_LARGE_USD,
          split: ROUTING_THRESHOLD_SPLIT_USD
        }
      },
      meta: {
        elapsedMs,
        candidateCount: candidates.length
      }
    };
  } catch (error) {
    console.error('[Router] Error:', error);
    
    // Record exception
    const errorDecision = {
      timestamp: new Date().toISOString(),
      base,
      quote,
      amountUsd,
      side,
      chosenSource: null,
      price: null,
      feeBps: null,
      liquidityScore: null,
      estConfirmMs: null,
      split: false,
      elapsedMs: Date.now() - startTime,
      success: false,
      error: error.message
    };
    
    addDecision(errorDecision);

    return {
      ok: false,
      code: 'ROUTING_ERROR',
      message: error.message
    };
  }
}

/**
 * Apply routing strategy based on trade size
 * @param {Array} candidates - Available quote candidates
 * @param {number} amountUsd - Trade amount in USD
 * @param {string} side - Trade side
 * @returns {Object} Routing decision
 */
function applyRoutingStrategy(candidates, amountUsd, side) {
  // Strategy 1: Small trades (< $1k) - Best effective price
  if (amountUsd < ROUTING_THRESHOLD_LARGE_USD) {
    const sorted = [...candidates].sort((a, b) => {
      if (side === 'buy') {
        return a.effectivePrice - b.effectivePrice; // Lower is better for buy
      } else {
        return b.effectivePrice - a.effectivePrice; // Higher is better for sell
      }
    });

    const chosen = sorted[0];
    return {
      route: { primary: chosen.source },
      chosen: {
        price: chosen.price,
        feeBps: chosen.feeBps,
        liquidityScore: chosen.liquidityScore,
        estConfirmMs: chosen.estConfirmMs,
        source: chosen.source,
        totalCostBps: chosen.totalCostBps,
        reason: 'best-price'
      }
    };
  }

  // Strategy 2: Medium trades ($1k-$25k) - Deepest liquidity
  if (amountUsd < ROUTING_THRESHOLD_SPLIT_USD) {
    const sorted = [...candidates].sort((a, b) => 
      b.liquidityScore - a.liquidityScore
    );

    const chosen = sorted[0];
    return {
      route: { primary: chosen.source },
      chosen: {
        price: chosen.price,
        feeBps: chosen.feeBps,
        liquidityScore: chosen.liquidityScore,
        estConfirmMs: chosen.estConfirmMs,
        source: chosen.source,
        totalCostBps: chosen.totalCostBps,
        reason: 'deepest-liquidity'
      }
    };
  }

  // Strategy 3: Large trades (> $25k) - Split across top 2
  const sorted = [...candidates].sort((a, b) => 
    b.liquidityScore - a.liquidityScore
  );

  const top1 = sorted[0];
  const top2 = sorted[1] || top1; // Fallback to single if only one available

  // Calculate split percentages based on liquidity scores
  const totalLiquidity = top1.liquidityScore + top2.liquidityScore;
  const pct1 = Math.round((top1.liquidityScore / totalLiquidity) * 100);
  const pct2 = 100 - pct1;

  // Weighted average price
  const avgPrice = (top1.price * pct1 + top2.price * pct2) / 100;
  const avgFeeBps = Math.round((top1.feeBps * pct1 + top2.feeBps * pct2) / 100);
  const avgLiqScore = (top1.liquidityScore * pct1 + top2.liquidityScore * pct2) / 100;
  const avgConfirmMs = Math.round((top1.estConfirmMs * pct1 + top2.estConfirmMs * pct2) / 100);

  return {
    route: {
      primary: top1.source,
      splits: [
        { source: top1.source, pct: pct1 },
        { source: top2.source, pct: pct2 }
      ]
    },
    chosen: {
      price: avgPrice,
      feeBps: avgFeeBps,
      liquidityScore: avgLiqScore,
      estConfirmMs: avgConfirmMs,
      source: `split:${top1.source}/${top2.source}`,
      totalCostBps: avgFeeBps + Math.round((1 - avgLiqScore) * 100),
      reason: 'smart-split'
    }
  };
}

/**
 * Log routing decision
 * @param {Object} record - Decision record
 */
function logRoutingDecision(record) {
  if (ROUTING_ENGINE_LOG === 'debug' || ROUTING_ENGINE_LOG === 'info') {
    if (record.success && record.chosenSource) {
      const split = record.chosenSource.includes('split:');
      console.log(
        `[routing] ${record.base}/${record.quote} ${record.side} amountUsd=${record.amountUsd}, ` +
        `picked=${record.chosenSource}, price=${record.price.toFixed(6)}, ` +
        `feeBps=${record.feeBps}, liq=${record.liquidityScore.toFixed(2)}, ` +
        `ms=${record.elapsedMs}, split=${split}`
      );
    } else {
      console.log(
        `[routing] ${record.base}/${record.quote} ${record.side} amountUsd=${record.amountUsd}, ` +
        `FAILED, ms=${record.elapsedMs}, error=${record.error || 'no-candidates'}`
      );
    }
  }
}

module.exports = {
  routeQuote
};
