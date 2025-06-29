/**
 * Bitcoin Routes
 * API endpoints for Bitcoin wallet and trading operations
 */

const express = require('express');
const router = express.Router();
const BitcoinWalletService = require('../services/blockchain/BitcoinWalletService');
const BitcoinTradingService = require('../services/blockchain/BitcoinTradingService');
const { authenticateToken } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

// Initialize services
const bitcoinWalletService = new BitcoinWalletService();
const bitcoinTradingService = new BitcoinTradingService();

/**
 * Validation middleware
 */
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

// Validation middleware
const validateWalletCreation = [
  body('userId').isString().notEmpty().withMessage('User ID is required'),
  body('options').optional().isObject()
];

const validateWalletImport = [
  body('userId').isString().notEmpty().withMessage('User ID is required'),
  body('privateKey').isString().notEmpty().withMessage('Private key is required'),
  body('options').optional().isObject()
];

const validateTransaction = [
  body('walletId').isString().notEmpty().withMessage('Wallet ID is required'),
  body('toAddress').isString().notEmpty().withMessage('Recipient address is required'),
  body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be positive'),
  body('feeRate').optional().isFloat({ min: 1 }).withMessage('Fee rate must be at least 1 sat/vB')
];

const validateSwap = [
  body('fromWalletId').isString().notEmpty().withMessage('From wallet ID is required'),
  body('toWalletId').isString().notEmpty().withMessage('To wallet ID is required'),
  body('fromAmount').isFloat({ min: 0 }).withMessage('From amount must be positive'),
  body('toPair').isString().notEmpty().withMessage('Trading pair is required'),
  body('slippage').optional().isFloat({ min: 0, max: 50 }).withMessage('Slippage must be between 0-50%')
];

// ============================================================================
// WALLET MANAGEMENT ROUTES
// ============================================================================

/**
 * Create new Bitcoin wallet
 * POST /api/bitcoin/wallet/create
 */
router.post('/wallet/create', authenticateToken, validateWalletCreation, validateRequest, async (req, res) => {
  try {
    const { userId, options } = req.body;
    const wallet = await bitcoinWalletService.createWallet(userId, options);
    
    res.status(201).json({
      success: true,
      message: 'Bitcoin wallet created successfully',
      data: wallet
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'WALLET_CREATION_FAILED'
    });
  }
});

/**
 * Import existing Bitcoin wallet
 * POST /api/bitcoin/wallet/import
 */
router.post('/wallet/import', authenticateToken, validateWalletImport, validateRequest, async (req, res) => {
  try {
    const { userId, privateKey, options } = req.body;
    const wallet = await bitcoinWalletService.importWallet(userId, privateKey, options);
    
    res.status(201).json({
      success: true,
      message: 'Bitcoin wallet imported successfully',
      data: wallet
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'WALLET_IMPORT_FAILED'
    });
  }
});

/**
 * Get wallet details
 * GET /api/bitcoin/wallet/:walletId
 */
router.get('/wallet/:walletId', authenticateToken, param('walletId').isString(), validateRequest, async (req, res) => {
  try {
    const { walletId } = req.params;
    const wallet = await bitcoinWalletService.getWallet(walletId);
    
    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
      error: 'WALLET_NOT_FOUND'
    });
  }
});

/**
 * Sync wallet balance
 * POST /api/bitcoin/wallet/:walletId/sync
 */
router.post('/wallet/:walletId/sync', authenticateToken, param('walletId').isString(), validateRequest, async (req, res) => {
  try {
    const { walletId } = req.params;
    const balance = await bitcoinWalletService.syncWalletBalance(walletId);
    
    res.json({
      success: true,
      message: 'Wallet balance synced successfully',
      data: { balance }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'SYNC_FAILED'
    });
  }
});

/**
 * Generate QR code for wallet address
 * GET /api/bitcoin/wallet/:walletId/qr
 */
router.get('/wallet/:walletId/qr', authenticateToken, [
  param('walletId').isString(),
  query('amount').optional().isFloat({ min: 0 }),
  query('label').optional().isString()
], validateRequest, async (req, res) => {
  try {
    const { walletId } = req.params;
    const { amount, label } = req.query;
    
    const wallet = await bitcoinWalletService.getWallet(walletId);
    const qrCode = await bitcoinWalletService.generateAddressQR(wallet.address, amount, label);
    
    res.json({
      success: true,
      data: qrCode
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'QR_GENERATION_FAILED'
    });
  }
});

// ============================================================================
// TRANSACTION ROUTES
// ============================================================================

/**
 * Send Bitcoin transaction
 * POST /api/bitcoin/transaction/send
 */
router.post('/transaction/send', authenticateToken, validateTransaction, validateRequest, async (req, res) => {
  try {
    const { walletId, toAddress, amount, feeRate } = req.body;
    const transaction = await bitcoinWalletService.sendTransaction(walletId, toAddress, amount, { feeRate });
    
    res.status(201).json({
      success: true,
      message: 'Bitcoin transaction sent successfully',
      data: transaction
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'TRANSACTION_FAILED'
    });
  }
});

/**
 * Get transaction history
 * GET /api/bitcoin/wallet/:walletId/transactions
 */
router.get('/wallet/:walletId/transactions', authenticateToken, [
  param('walletId').isString(),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validateRequest, async (req, res) => {
  try {
    const { walletId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await bitcoinWalletService.getTransactionHistory(walletId, limit);
    
    res.json({
      success: true,
      data: {
        transactions: history,
        count: history.length
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'HISTORY_FETCH_FAILED'
    });
  }
});

/**
 * Estimate transaction fees
 * POST /api/bitcoin/transaction/estimate-fees
 */
router.post('/transaction/estimate-fees', authenticateToken, [
  body('walletId').isString().notEmpty(),
  body('toAddress').isString().notEmpty(),
  body('amount').isFloat({ min: 0.00000001 })
], validateRequest, async (req, res) => {
  try {
    const { walletId, toAddress, amount } = req.body;
    const fees = await bitcoinWalletService.estimateTransactionFees(walletId, toAddress, amount);
    
    res.json({
      success: true,
      data: fees
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'FEE_ESTIMATION_FAILED'
    });
  }
});

/**
 * Monitor transaction status
 * GET /api/bitcoin/transaction/:txid/status
 */
router.get('/transaction/:txid/status', authenticateToken, param('txid').isString(), validateRequest, async (req, res) => {
  try {
    const { txid } = req.params;
    const status = await bitcoinWalletService.monitorTransaction(txid);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
      error: 'TRANSACTION_NOT_FOUND'
    });
  }
});

/**
 * Get wallet UTXOs
 * GET /api/bitcoin/wallet/:walletId/utxos
 */
router.get('/wallet/:walletId/utxos', authenticateToken, param('walletId').isString(), validateRequest, async (req, res) => {
  try {
    const { walletId } = req.params;
    const utxos = await bitcoinWalletService.getWalletUTXOs(walletId);
    
    res.json({
      success: true,
      data: {
        utxos,
        count: utxos.length
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'UTXOS_FETCH_FAILED'
    });
  }
});

// ============================================================================
// TRADING ROUTES
// ============================================================================

/**
 * Get supported Bitcoin trading pairs
 * GET /api/bitcoin/trading/pairs
 */
router.get('/trading/pairs', async (req, res) => {
  try {
    const pairs = bitcoinTradingService.getSupportedTradingPairs();
    
    res.json({
      success: true,
      data: {
        pairs,
        count: pairs.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'PAIRS_FETCH_FAILED'
    });
  }
});

/**
 * Get Bitcoin price
 * GET /api/bitcoin/trading/price/:quoteCurrency
 */
router.get('/trading/price/:quoteCurrency', param('quoteCurrency').isString(), validateRequest, async (req, res) => {
  try {
    const { quoteCurrency } = req.params;
    const price = await bitcoinTradingService.getBitcoinPrice(quoteCurrency);
    
    res.json({
      success: true,
      data: price
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'PRICE_FETCH_FAILED'
    });
  }
});

/**
 * Get order book for Bitcoin pair
 * GET /api/bitcoin/trading/orderbook/:pair
 */
router.get('/trading/orderbook/:pair', [
  param('pair').isString(),
  query('depth').optional().isInt({ min: 5, max: 100 })
], validateRequest, async (req, res) => {
  try {
    const { pair } = req.params;
    const depth = parseInt(req.query.depth) || 20;
    
    const orderBook = await bitcoinTradingService.getOrderBook(pair, depth);
    
    res.json({
      success: true,
      data: orderBook
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'ORDERBOOK_FETCH_FAILED'
    });
  }
});

/**
 * Execute Bitcoin swap
 * POST /api/bitcoin/trading/swap
 */
router.post('/trading/swap', authenticateToken, validateSwap, validateRequest, async (req, res) => {
  try {
    const { fromWalletId, toWalletId, fromAmount, toPair, slippage } = req.body;
    const swap = await bitcoinTradingService.executeBitcoinSwap(
      fromWalletId, 
      toWalletId, 
      fromAmount, 
      toPair, 
      { slippage }
    );
    
    res.status(201).json({
      success: true,
      message: 'Bitcoin swap executed successfully',
      data: swap
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'SWAP_FAILED'
    });
  }
});

/**
 * Get Bitcoin market data
 * GET /api/bitcoin/trading/market-data
 */
router.get('/trading/market-data', async (req, res) => {
  try {
    const marketData = await bitcoinTradingService.getBitcoinMarketData();
    
    res.json({
      success: true,
      data: marketData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'MARKET_DATA_FETCH_FAILED'
    });
  }
});

/**
 * Get Bitcoin trading history
 * GET /api/bitcoin/trading/history/:walletId
 */
router.get('/trading/history/:walletId', authenticateToken, [
  param('walletId').isString(),
  query('limit').optional().isInt({ min: 1, max: 100 })
], validateRequest, async (req, res) => {
  try {
    const { walletId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await bitcoinTradingService.getBitcoinTradingHistory(walletId, limit);
    
    res.json({
      success: true,
      data: {
        trades: history,
        count: history.length
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'TRADING_HISTORY_FETCH_FAILED'
    });
  }
});

/**
 * Calculate optimal swap route
 * POST /api/bitcoin/trading/calculate-route
 */
router.post('/trading/calculate-route', authenticateToken, [
  body('fromAsset').isString().notEmpty(),
  body('toAsset').isString().notEmpty(),
  body('amount').isFloat({ min: 0 })
], validateRequest, async (req, res) => {
  try {
    const { fromAsset, toAsset, amount } = req.body;
    const route = await bitcoinTradingService.calculateOptimalSwapRoute(fromAsset, toAsset, amount);
    
    res.json({
      success: true,
      data: route
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'ROUTE_CALCULATION_FAILED'
    });
  }
});

// ============================================================================
// NETWORK & UTILITY ROUTES
// ============================================================================

/**
 * Get Bitcoin network statistics
 * GET /api/bitcoin/network/stats
 */
router.get('/network/stats', async (req, res) => {
  try {
    const stats = await bitcoinTradingService.getBitcoinNetworkStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'NETWORK_STATS_FETCH_FAILED'
    });
  }
});

/**
 * Get mempool status
 * GET /api/bitcoin/network/mempool
 */
router.get('/network/mempool', async (req, res) => {
  try {
    const mempool = await bitcoinWalletService.getMempoolStatus();
    
    res.json({
      success: true,
      data: mempool
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'MEMPOOL_FETCH_FAILED'
    });
  }
});

/**
 * Validate Bitcoin address
 * POST /api/bitcoin/validate-address
 */
router.post('/validate-address', [
  body('address').isString().notEmpty().withMessage('Address is required')
], validateRequest, async (req, res) => {
  try {
    const { address } = req.body;
    const validation = bitcoinWalletService.bitcoinAdapter.validateAddress(address);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'ADDRESS_VALIDATION_FAILED'
    });
  }
});

/**
 * Get current Bitcoin price in multiple currencies
 * GET /api/bitcoin/price
 */
router.get('/price', async (req, res) => {
  try {
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'USDT', 'USDC'];
    const prices = await Promise.all(
      currencies.map(async (currency) => {
        try {
          const price = await bitcoinWalletService.getCurrentPrice(currency);
          return { currency, ...price };
        } catch (error) {
          return { currency, error: error.message };
        }
      })
    );
    
    res.json({
      success: true,
      data: {
        prices,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'PRICE_FETCH_FAILED'
    });
  }
});

/**
 * Get service information
 * GET /api/bitcoin/info
 */
router.get('/info', async (req, res) => {
  try {
    const walletInfo = bitcoinWalletService.getServiceInfo();
    const tradingInfo = bitcoinTradingService.getServiceInfo();
    
    res.json({
      success: true,
      data: {
        wallet: walletInfo,
        trading: tradingInfo,
        endpoints: {
          wallet: '/api/bitcoin/wallet',
          trading: '/api/bitcoin/trading',
          network: '/api/bitcoin/network'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'INFO_FETCH_FAILED'
    });
  }
});

module.exports = router;

