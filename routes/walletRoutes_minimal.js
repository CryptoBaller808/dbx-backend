const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Simple validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Simple auth middleware placeholder
const authMiddleware = (req, res, next) => {
  req.user = { id: 'test-user' };
  next();
};

// Simple audit middleware placeholder
const auditMiddleware = (options) => (req, res, next) => {
  console.log(`[Audit] ${options.action}`);
  next();
};

// Minimal connect route with inline handler
router.post('/connect',
  authMiddleware,
  [
    body('chainId').notEmpty().isString(),
    body('walletType').notEmpty().isString(),
    body('options').optional().isObject()
  ],
  validateRequest,
  auditMiddleware({ action: 'wallet_connect' }),
  async (req, res, next) => {
    try {
      const { chainId, walletType, options = {} } = req.body;
      const userId = req.user.id;
      
      // Mock response for testing
      const result = {
        success: true,
        walletType,
        chainId,
        userId,
        connected: true,
        timestamp: new Date().toISOString()
      };
      
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('[Wallet Connect] Error:', error);
      next(error);
    }
  }
);

// Health check route
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

