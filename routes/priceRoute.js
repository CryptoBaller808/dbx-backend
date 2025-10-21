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
 * @route GET /api/price/health
 * @desc Health check for price service
 * @returns {Object} Service status and configuration
 */
router.get('/health', priceController.healthCheck);

module.exports = router;
