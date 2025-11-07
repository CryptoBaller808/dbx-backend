const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');

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
 * @example /api/price/quote?pair=ETHUSDT
 * @example /api/price/quote?pair=ETH-USDT
 * @example /api/price/quote?pair=ETH/USDT
 * @returns {Object} { pair, lastPrice, ts, source }
 */
router.get('/quote', (req, res, next) => {
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
  return priceController.getSpotPrice(req, res, next);
});

/**
 * @route GET /api/price/health
 * @desc Health check for price service
 * @returns {Object} Service status and configuration
 */
router.get('/health', priceController.healthCheck);

module.exports = router;
