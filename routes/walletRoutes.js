const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const WalletService = require('../services/blockchain/wallet-service');
const { initializeBlockchainServices } = require('../services/blockchain');
const { auditMiddleware } = require('../middleware/auditMiddleware');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Initialize blockchain services
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

/**
 * Error handling middleware
 */
const handleWalletError = (error, req, res, next) => {
  console.error('[Wallet Routes] Error:', error);
  
  if (error.name === 'BlockchainError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: error.code,
      chainId: error.chainId
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
};

/**
 * GET /api/wallets/available
 * Get available wallets for the current environment
 */
router.get('/available',
  auditMiddleware({ action: 'wallet_list_available' }),
  async (req, res, next) => {
    try {
      if (!walletService) {
        return res.status(503).json({
          success: false,
          error: 'Wallet service not initialized'
        });
      }

      const wallets = await walletService.getAvailableWallets();
      
      res.json({
        success: true,
        data: {
          wallets,
          count: wallets.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/wallets/connect
 * Connect to a wallet for a specific blockchain
 */
router.post('/connect',
  authMiddleware,
  [
    body('chainId')
      .notEmpty()
      .withMessage('Chain ID is required')
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid chain ID'),
    body('walletType')
      .notEmpty()
      .withMessage('Wallet type is required')
      .isIn(['metamask', 'phantom', 'xumm', 'freighter', 'solflare', 'walletconnect'])
      .withMessage('Invalid wallet type'),
    body('options').optional().isObject()
  ],
  validateRequest,
  auditMiddleware({ action: 'wallet_connect' }),
  async (req, res, next) => {
    try {
      const { chainId, walletType, options = {} } = req.body;
      const userId = req.user.id;

      const result = await walletService.connectWallet(userId, chainId, walletType, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/wallets/disconnect
 * Disconnect from a wallet for a specific blockchain
 */
router.post('/disconnect',
  authMiddleware,
  [
    body('chainId')
      .notEmpty()
      .withMessage('Chain ID is required')
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid chain ID')
  ],
  validateRequest,
  auditMiddleware({ action: 'wallet_disconnect' }),
  async (req, res, next) => {
    try {
      const { chainId } = req.body;
      const userId = req.user.id;

      const result = await walletService.disconnectWallet(userId, chainId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/wallets/disconnect-all
 * Disconnect from all wallets
 */
router.post('/disconnect-all',
  authMiddleware,
  auditMiddleware({ action: 'wallet_disconnect_all' }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const results = await walletService.disconnectAllWallets(userId);
      
      res.json({
        success: true,
        data: {
          results,
          disconnectedCount: results.filter(r => r.success).length,
          failedCount: results.filter(r => !r.success).length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/status
 * Get wallet connection status for the current user
 */
router.get('/status',
  authMiddleware,
  auditMiddleware({ action: 'wallet_status_check' }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const status = walletService.getUserWalletStatus(userId);
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/connection/:chainId
 * Get specific wallet connection for a chain
 */
router.get('/connection/:chainId',
  authMiddleware,
  [
    param('chainId')
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid chain ID')
  ],
  validateRequest,
  auditMiddleware({ action: 'wallet_connection_check' }),
  async (req, res, next) => {
    try {
      const { chainId } = req.params;
      const userId = req.user.id;

      const connection = walletService.getUserWalletConnection(userId, chainId);
      
      res.json({
        success: true,
        data: {
          chainId,
          connection,
          isConnected: !!connection
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/balance
 * Get multi-chain balance for the current user
 */
router.get('/balance',
  authMiddleware,
  [
    query('includeTokens')
      .optional()
      .isBoolean()
      .withMessage('includeTokens must be a boolean')
  ],
  validateRequest,
  auditMiddleware({ action: 'wallet_balance_check' }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const includeTokens = req.query.includeTokens === 'true';

      const balances = await walletService.getUserMultiChainBalance(userId, includeTokens);
      
      // Calculate total value (would need price data in real implementation)
      const totalChains = balances.filter(b => !b.error).length;
      const totalErrors = balances.filter(b => b.error).length;
      
      res.json({
        success: true,
        data: {
          balances,
          summary: {
            totalChains,
            totalErrors,
            includeTokens,
            lastUpdated: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/balance/:chainId
 * Get balance for a specific chain
 */
router.get('/balance/:chainId',
  authMiddleware,
  [
    param('chainId')
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid chain ID'),
    query('address').optional().isString(),
    query('includeTokens')
      .optional()
      .isBoolean()
      .withMessage('includeTokens must be a boolean')
  ],
  validateRequest,
  auditMiddleware({ action: 'wallet_chain_balance_check' }),
  async (req, res, next) => {
    try {
      const { chainId } = req.params;
      const { address } = req.query;
      const userId = req.user.id;
      const includeTokens = req.query.includeTokens === 'true';

      // Get wallet connection
      const connection = walletService.getUserWalletConnection(userId, chainId);
      if (!connection && !address) {
        return res.status(400).json({
          success: false,
          error: 'No wallet connected for this chain and no address provided'
        });
      }

      const targetAddress = address || connection.publicKey || connection.accounts?.[0];
      
      if (!targetAddress) {
        return res.status(400).json({
          success: false,
          error: 'No address available for balance check'
        });
      }

      // Get adapter and check balance
      const adapter = blockchainServices.registry.getAdapter(chainId);
      const balance = await adapter.getBalance(targetAddress);
      
      let tokens = [];
      if (includeTokens) {
        tokens = await walletService.getUserTokenBalances(userId, chainId, targetAddress);
      }
      
      res.json({
        success: true,
        data: {
          chainId,
          address: targetAddress,
          balance,
          tokens,
          includeTokens,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/wallets/health
 * Health check for wallet service
 */
router.get('/health',
  auditMiddleware({ action: 'wallet_health_check' }),
  async (req, res, next) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          walletService: !!walletService,
          blockchainServices: !!blockchainServices,
          adapterRegistry: !!blockchainServices?.registry
        }
      };

      if (blockchainServices) {
        try {
          const supportedChains = blockchainServices.registry.getSupportedChains();
          health.supportedChains = supportedChains.length;
          health.chainStatus = {};

          for (const chainId of supportedChains.slice(0, 3)) { // Check first 3 chains for health
            try {
              const adapter = blockchainServices.registry.getAdapter(chainId);
              const status = await adapter.getNetworkStatus();
              health.chainStatus[chainId] = status.isConnected ? 'connected' : 'disconnected';
            } catch (error) {
              health.chainStatus[chainId] = 'error';
            }
          }
        } catch (error) {
          health.status = 'degraded';
          health.error = error.message;
        }
      } else {
        health.status = 'unhealthy';
        health.error = 'Services not initialized';
      }
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        success: health.status !== 'unhealthy',
        data: health
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handling middleware
router.use(handleWalletError);

module.exports = {
  router,
  initializeServices
};

