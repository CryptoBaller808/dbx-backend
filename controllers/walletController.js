// backend/src/controllers/walletController.js

const WalletService = require('../services/blockchain/wallet-service');
const { validationResult } = require('express-validator');

/**
 * Sample controller for connecting to a wallet
 */
const connectWallet = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { chainId, walletType, options = {} } = req.body;
    const userId = req.user?.id || 'demo-user'; // Temporary fallback

    const walletService = new WalletService(); // Create service instance
    const result = await walletService.connectWallet(userId, chainId, walletType, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Wallet Controller] connectWallet error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  connectWallet
};

