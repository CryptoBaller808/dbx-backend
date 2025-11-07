const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');

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
 * @route GET /api/quote
 * @desc Alias for /api/price with single pair parameter
 * @query {string} pair - Trading pair (ETHUSDT, ETH-USDT, or ETH/USDT)
 * @example /api/quote?pair=ETHUSDT
 * @example /api/quote?pair=ETH-USDT
 * @example /api/quote?pair=ETH/USDT
 * @returns {Object} { pair, lastPrice, ts, source }
 */
router.get('/quote', (req, res, next) => {
  const raw = String(req.query.pair || '').trim().toUpperCase();
  const m = raw.match(/^([A-Z0-9]+)[-\/]?([A-Z0-9]+)$/);
  if (!m) {
    return res.status(400).json({
      ok: false,
      code: 'BAD_PAIR',
      message: 'Use pair like ETHUSDT or ETH-USDT'
    });
  }
  req.query.base = m[1];
  req.query.quote = m[2];
  return priceController.getSpotPrice(req, res, next);
});

/**
 * @route GET /api/price/health
 * @desc Health check for price service
 * @returns {Object} Service status and configuration
 */
router.get('/health', priceController.healthCheck);

module.exports = router;
