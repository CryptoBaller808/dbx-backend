const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');
const { routeQuote } = require('../services/routing/router');

/**
 * Parse pair parameter into base and quote components
 * Supports: ETHUSDT, ETH-USDT, ETH/USDT
 */
function parsePairParam(raw) {
  const s = String(raw || '').trim().toUpperCase();

  // Hyphen or slash separator
  const sep = s.match(/^([A-Z0-9]+)[\-\/]([A-Z0-9]+)$/);
  if (sep) return { base: sep[1], quote: sep[2] };

  // Known quotes (ordered longest first to avoid ETHUSD + T splitting)
  const QUOTES = ['USDT','USDC','BUSD','USDX','DAI','USD','EUR','BTC','ETH','XRP','XLM','BNB','SOL','ADA','MATIC','XDC','DOGE','ARB','OP','DOT','LINK'];
  for (const q of QUOTES) {
    if (s.endsWith(q) && s.length > q.length) {
      return { base: s.slice(0, s.length - q.length), quote: q };
    }
  }
  return null;
}

/**
 * @route GET /api/price
 * @desc Get spot price for a trading pair
 * @query {string} base - Base currency (ETH, BTC, XRP, etc.)
 * @query {string} quote - Quote currency (USD, USDT, USDC, etc.)
 * @example /api/price?base=ETH&quote=USDT
 * @returns {Object} { pair, lastPrice, ts, source }
 */
router.get('/', priceController.getSpotPrice);

/**
 * @route GET /api/price/quote
 * @desc Alias for /api/price with single pair parameter
 * @query {string} pair - Trading pair (ETHUSDT, ETH-USDT, or ETH/USDT)
 * @query {number} [amountUsd] - Optional trade amount in USD for routing
 * @query {string} [side] - Optional trade side (buy/sell) for routing
 * @example /api/price/quote?pair=ETHUSDT
 * @example /api/price/quote?pair=ETH-USDT&amountUsd=1500&side=buy
 * @returns {Object} { pair, lastPrice, ts, source, routing? }
 */
router.get('/quote', async (req, res, next) => {
  const parsed = parsePairParam(req.query.pair);
  if (!parsed) {
    return res.status(400).json({
      ok: false,
      code: 'BAD_PAIR',
      message: 'Use pair like ETHUSDT, ETH-USDT, or ETH/USDT'
    });
  }
  req.query.base = parsed.base;
  req.query.quote = parsed.quote;
  
  // Get base price
  const priceData = await new Promise((resolve) => {
    const mockRes = {
      status: () => mockRes,
      json: (data) => resolve(data)
    };
    priceController.getSpotPrice(req, mockRes, next);
  });
  
  // Add routing block if amountUsd and side are provided
  if (req.query.amountUsd && req.query.side && process.env.ROUTING_ENGINE_V1 === 'true') {
    try {
      const routing = await routeQuote({
        base: parsed.base,
        quote: parsed.quote,
        side: req.query.side,
        amountUsd: parseFloat(req.query.amountUsd)
      });
      
      return res.json({
        ...priceData,
        routing
      });
    } catch (error) {
      // Never throw; include routing failure in response
      console.error('[Price/Quote] Routing error:', error.message);
      return res.json({
        ...priceData,
        routing: {
          ok: false,
          code: 'ROUTING_ERROR',
          message: error.message
        }
      });
    }
  }
  
  return res.json(priceData);
});

/**
 * @route GET /api/price/routing-quote
 * @desc Get routing recommendation for a trade
 * @query {string} base - Base currency
 * @query {string} quote - Quote currency
 * @query {number} amountUsd - Trade amount in USD
 * @query {string} side - Trade side (buy or sell)
 * @example /api/price/routing-quote?base=XRP&quote=USDT&amountUsd=500&side=buy
 * @returns {Object} Routing decision with candidates and policy
 */
router.get('/routing-quote', async (req, res) => {
  const { base, quote, amountUsd, side } = req.query;
  const startTime = Date.now();
  
  if (!base || !quote || !amountUsd || !side) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_PARAMS',
      message: 'Required: base, quote, amountUsd, side'
    });
  }
  
  if (process.env.ROUTING_ENGINE_V1 !== 'true') {
    return res.json({
      ok: false,
      code: 'ROUTING_DISABLED'
    });
  }
  
  const result = await routeQuote({
    base: base.toUpperCase(),
    quote: quote.toUpperCase(),
    side: side.toLowerCase(),
    amountUsd: parseFloat(amountUsd)
  });
  
  const latency_ms = Date.now() - startTime;
  
  // Log liquidity metrics if dashboard is enabled
  if (process.env.LIQUIDITY_DASHBOARD_V1 === 'true' && result.ok) {
    try {
      const LiquidityMetrics = require('../models/LiquidityMetrics');
      const provider = result.chosen?.source || result.routing?.primary || 'unknown';
      const strategy = result.policy?.strategy || 'auto';
      const fee_bps = result.chosen?.fee_bps || 25;
      
      await LiquidityMetrics.create({
        provider,
        pair: `${base}-${quote}`,
        strategy,
        volume: parseFloat(amountUsd),
        fee_bps,
        latency_ms
      });
    } catch (error) {
      console.error('[Phase2] init warn: Failed to log liquidity metrics:', error.message);
    }
  }
  
  return res.json(result);
});

/**
 * @route GET /api/price/health
 * @desc Health check for price service
 * @returns {Object} Service status and configuration
 */
router.get('/health', priceController.healthCheck);

module.exports = router;
