/**
 * Trade Routes
 * Paper trading endpoints for DBX-63 MVP
 */

const express = require('express');
const router = express.Router();
const tradeController = require('../controllers/tradeController');

/**
 * GET /trade/quote
 * Get a quote for a potential trade
 * Query params: base, quote, side, amount
 */
router.get('/quote', tradeController.getQuote);

/**
 * POST /trade/market
 * Submit a market order (paper trading) - V2 primary endpoint
 * Body: { pair, side, amountBase, clientId? }
 */
router.post('/market', tradeController.submitOrder);

/**
 * POST /trade/submit
 * Legacy alias for /market (backward compatibility)
 * Body: { pair, side, amountBase, clientId? }
 */
router.post('/submit', tradeController.submitOrder);

/**
 * GET /trade/recent
 * Get recent paper fills from ring buffer
 * Query params: pair?, limit?
 */
router.get('/recent', tradeController.getRecentFills);

/**
 * GET /trade/config
 * Get trading configuration (for admin panel)
 */
router.get('/config', tradeController.getConfig);

/**
 * GET /trade/diag
 * Diagnostic endpoint for QA testing
 * Query params: base, quote, side, amount
 */
router.get('/diag', tradeController.getDiagnostic);

/**
 * GET /trade/test/quote
 * Public read-only quote test endpoint (no auth required)
 * Query params: pair, amount
 */
router.get('/test/quote', tradeController.getTestQuote);

module.exports = router;

