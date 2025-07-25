// SAFE AND FINAL VERSION OF walletRoutes.js
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const WalletService = require('../services/blockchain/wallet-service');
const { initializeBlockchainServices } = require('../services/blockchain');
const { auditMiddleware } = require('../middleware/auditMiddleware');
const { authenticateToken: authMiddleware } = require('../middleware/auth');

const router = express.Router();

let walletService;
let blockchainServices;

const initializeServices = async (db) => {
  try {
    blockchainServices = await initializeBlockchainServices(db);
    walletService = blockchainServices.walletService;
    console.log('[Wallet Routes] Services initialized successfully');
  } catch (error) {
    console.error('[Wallet Routes] Failed to initialize services:', error);
    throw error;
  }
};

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

const handleWalletError = (error, req, res, next) => {
  console.error('[Wallet Routes] Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
};

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
      const result = await walletService.connectWallet(userId, chainId, walletType, options);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.use(handleWalletError);
module.exports = { router, initializeServices };
// Last updated: Fri Jul 25 00:28:08 EDT 2025
