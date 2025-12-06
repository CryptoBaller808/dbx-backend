/**
 * SimulatedLiquidityProvider.js
 * Stage 5 - Phase 1: Simulated Liquidity Provider
 * 
 * Provides simulated liquidity data from config/liquidity.json.
 * This is the fallback provider and matches Stage 4 behavior.
 */

const fs = require('fs');
const path = require('path');
const BaseLiquidityProvider = require('./BaseLiquidityProvider');

class SimulatedLiquidityProvider extends BaseLiquidityProvider {
  constructor(config = {}) {
    super('simulated', config);
    this.liquidityData = null;
    this.loadLiquidityData();
  }

  /**
   * Load liquidity data from config file
   */
  loadLiquidityData() {
    try {
      const configPath = path.join(__dirname, '../../../config/liquidity.json');
      const rawData = fs.readFileSync(configPath, 'utf8');
      this.liquidityData = JSON.parse(rawData);
      console.log('[SimulatedLiquidityProvider] Loaded liquidity data successfully');
    } catch (error) {
      console.error('[SimulatedLiquidityProvider] Failed to load liquidity data:', error.message);
      this.liquidityData = { pools: {}, bridges: {}, syntheticPairs: {}, priceOracles: {} };
    }
  }

  /**
   * Reload liquidity data from config file
   */
  reload() {
    this.loadLiquidityData();
  }

  /**
   * Get spot price for a token pair
   */
  async getSpotPrice(base, quote, opts = {}) {
    // Check if it's a direct price oracle entry
    if (quote === 'USD' || quote === 'USDT' || quote === 'USDC') {
      return this.liquidityData.priceOracles[base] || null;
    }

    // Check synthetic pairs
    const syntheticKey = `${base}_${quote}`;
    if (this.liquidityData.syntheticPairs[syntheticKey]) {
      return this.liquidityData.syntheticPairs[syntheticKey].spotPrice;
    }

    // Calculate from price oracles
    const price0 = this.liquidityData.priceOracles[base];
    const price1 = this.liquidityData.priceOracles[quote];
    if (price0 && price1) {
      return price0 / price1;
    }

    return null;
  }

  /**
   * Get market depth for a token pair
   */
  async getDepth(base, quote, opts = {}) {
    const { chain } = opts;
    
    if (!chain) {
      // Try to find pool in any chain
      for (const chainName in this.liquidityData.pools) {
        const pool = this.getPool(chainName, base, quote);
        if (pool) {
          return this.calculateDepth(pool, base, quote);
        }
      }
      return null;
    }

    const pool = this.getPool(chain, base, quote);
    if (!pool) return null;

    return this.calculateDepth(pool, base, quote);
  }

  /**
   * Get slippage curve for a token pair
   */
  async getSlippageCurve(base, quote, opts = {}) {
    const { chain, amounts = [] } = opts;
    
    const pool = chain ? this.getPool(chain, base, quote) : null;
    if (!pool) return null;

    const curve = [];
    const testAmounts = amounts.length > 0 ? amounts : [
      parseFloat(pool.reserve0) * 0.001,  // 0.1%
      parseFloat(pool.reserve0) * 0.01,   // 1%
      parseFloat(pool.reserve0) * 0.05,   // 5%
      parseFloat(pool.reserve0) * 0.1,    // 10%
      parseFloat(pool.reserve0) * 0.2     // 20%
    ];

    for (const amount of testAmounts) {
      const result = this.calculateSwapOutput(chain, base, quote, amount.toString());
      if (result) {
        curve.push({
          amountIn: amount.toString(),
          amountOut: result.amountOut,
          slippage: result.slippage,
          priceImpact: result.priceImpact
        });
      }
    }

    return { curve, spotPrice: pool.spotPrice };
  }

  /**
   * Check if this provider supports a given token pair
   */
  supports(base, quote, opts = {}) {
    // Simulated provider supports all pairs in config
    const spotPrice = this.getSpotPriceSync(base, quote);
    return spotPrice !== null;
  }

  /**
   * Get spot price synchronously (for supports() check)
   */
  getSpotPriceSync(base, quote) {
    // Check if it's a direct price oracle entry
    if (quote === 'USD' || quote === 'USDT' || quote === 'USDC') {
      return this.liquidityData.priceOracles[base] || null;
    }

    // Check synthetic pairs
    const syntheticKey = `${base}_${quote}`;
    if (this.liquidityData.syntheticPairs[syntheticKey]) {
      return this.liquidityData.syntheticPairs[syntheticKey].spotPrice;
    }

    // Calculate from price oracles
    const price0 = this.liquidityData.priceOracles[base];
    const price1 = this.liquidityData.priceOracles[quote];
    if (price0 && price1) {
      return price0 / price1;
    }

    return null;
  }

  /**
   * Get pool for a token pair on a specific chain
   */
  getPool(chain, token0, token1) {
    const chainPools = this.liquidityData.pools[chain];
    if (!chainPools) return null;

    // Try direct pair
    const directKey = `${token0}_${token1}`;
    if (chainPools[directKey] && chainPools[directKey].enabled) {
      return chainPools[directKey];
    }

    // Try reverse pair
    const reverseKey = `${token1}_${token0}`;
    if (chainPools[reverseKey] && chainPools[reverseKey].enabled) {
      // Swap reserves for reverse pair
      const pool = { ...chainPools[reverseKey] };
      [pool.reserve0, pool.reserve1] = [pool.reserve1, pool.reserve0];
      [pool.token0, pool.token1] = [pool.token1, pool.token0];
      pool.spotPrice = 1 / pool.spotPrice;
      return pool;
    }

    return null;
  }

  /**
   * Calculate market depth from pool data
   */
  calculateDepth(pool, base, quote) {
    const reserve0USD = parseFloat(pool.reserve0) * (this.liquidityData.priceOracles[pool.token0] || 0);
    const reserve1USD = parseFloat(pool.reserve1) * (this.liquidityData.priceOracles[pool.token1] || 0);

    return {
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      reserve0USD: reserve0USD.toFixed(2),
      reserve1USD: reserve1USD.toFixed(2),
      totalLiquidityUSD: (reserve0USD + reserve1USD).toFixed(2),
      depth: pool.depth || 'unknown',
      spotPrice: pool.spotPrice
    };
  }

  /**
   * Calculate output amount for a swap using constant product formula
   */
  calculateSwapOutput(chain, tokenIn, tokenOut, amountIn) {
    const pool = this.getPool(chain, tokenIn, tokenOut);
    if (!pool) return null;

    const amountInNum = parseFloat(amountIn);
    const reserve0 = parseFloat(pool.reserve0);
    const reserve1 = parseFloat(pool.reserve1);
    const fee = pool.fee || 0.003;

    // Constant product formula: (x + Δx * (1 - fee)) * (y - Δy) = x * y
    const amountInWithFee = amountInNum * (1 - fee);
    const amountOut = (amountInWithFee * reserve1) / (reserve0 + amountInWithFee);

    // Calculate price impact and slippage
    const spotPrice = pool.spotPrice;
    const executionPrice = amountInNum / amountOut;
    const priceImpact = (executionPrice - spotPrice) / spotPrice;
    const slippage = Math.abs(priceImpact);

    return {
      amountOut: amountOut.toString(),
      spotPrice,
      executionPrice,
      priceImpact,
      slippage,
      fee: fee * 100 // Convert to percentage
    };
  }

  /**
   * Get all chains with pools
   */
  getChains() {
    return Object.keys(this.liquidityData.pools);
  }

  /**
   * Get all pools for a chain
   */
  getChainPools(chain) {
    const chainPools = this.liquidityData.pools[chain];
    if (!chainPools) return [];

    return Object.entries(chainPools)
      .filter(([_, pool]) => pool.enabled)
      .map(([pairKey, pool]) => ({
        pairKey,
        ...pool
      }));
  }

  /**
   * Get bridge configuration
   */
  getBridge(fromChain, toChain) {
    const bridgeKey = `${fromChain}_${toChain}`;
    return this.liquidityData.bridges[bridgeKey] || null;
  }
}

module.exports = SimulatedLiquidityProvider;
