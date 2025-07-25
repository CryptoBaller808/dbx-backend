/**
 * Bitcoin Routes - SAFE VERSION
 * Minimal implementation to prevent deployment crashes
 */

const express = require('express');
const router = express.Router();

/**
 * Safe middleware that allows all requests
 */
const safeMiddleware = (req, res, next) => {
  console.log(`[Bitcoin Routes] ${req.method} ${req.path} - Using safe middleware`);
  next();
};

/**
 * Health check endpoint
 */
router.get('/health', safeMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Bitcoin routes are healthy',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /health - Health check',
        'POST /wallet/create - Create Bitcoin wallet (placeholder)',
        'GET /wallet/balance - Get wallet balance (placeholder)'
      ]
    });
  } catch (error) {
    console.error('[Bitcoin Routes] Health check error:', error);
    res.status(500).json({ success: false, error: 'Health check failed' });
  }
});

/**
 * Create Bitcoin wallet - PLACEHOLDER
 */
router.post('/wallet/create', safeMiddleware, async (req, res) => {
  try {
    console.log('[Bitcoin Routes] Placeholder: Create Bitcoin wallet called');
    res.json({
      success: true,
      message: 'Placeholder for Bitcoin wallet creation',
      data: {
        walletId: 'mock-btc-wallet-' + Date.now(),
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        network: 'bitcoin',
        created: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Bitcoin Routes] Create wallet error:', error);
    res.status(500).json({ success: false, error: 'Wallet creation failed' });
  }
});

/**
 * Get wallet balance - PLACEHOLDER
 */
router.get('/wallet/balance', safeMiddleware, async (req, res) => {
  try {
    console.log('[Bitcoin Routes] Placeholder: Get wallet balance called');
    res.json({
      success: true,
      message: 'Placeholder for Bitcoin wallet balance',
      data: {
        balance: '0.00000000',
        currency: 'BTC',
        confirmed: '0.00000000',
        unconfirmed: '0.00000000',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Bitcoin Routes] Get balance error:', error);
    res.status(500).json({ success: false, error: 'Balance check failed' });
  }
});

module.exports = router;

