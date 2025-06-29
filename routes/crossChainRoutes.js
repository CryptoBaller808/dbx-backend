const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const CrossChainTransactionService = require('../services/blockchain/CrossChainTransactionService');
const { initializeBlockchainServices } = require('../services/blockchain');
const { auditMiddleware } = require('../middleware/auditMiddleware');
const { authenticateToken: authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Initialize services
let crossChainService;
let blockchainServices;
let walletService;

const initializeServices = async (db) => {
  try {
    blockchainServices = await initializeBlockchainServices(db);
    walletService = blockchainServices.walletService;
    crossChainService = new CrossChainTransactionService(
      blockchainServices.registry,
      walletService,
      db
    );
    console.log('[Cross-Chain Routes] Services initialized successfully');
  } catch (error) {
    console.error('[Cross-Chain Routes] Failed to initialize services:', error);
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
const handleCrossChainError = (error, req, res, next) => {
  console.error('[Cross-Chain Routes] Error:', error);
  
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
 * GET /api/crosschain/supported-pairs
 * Get supported cross-chain trading pairs
 */
router.get('/supported-pairs',
  auditMiddleware('crosschain_supported_pairs'),
  async (req, res, next) => {
    try {
      if (!crossChainService) {
        return res.status(503).json({
          success: false,
          error: 'Cross-chain service not initialized'
        });
      }

      const pairs = crossChainService.getSupportedCrosschainPairs();
      
      res.json({
        success: true,
        data: {
          pairs,
          count: pairs.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/crosschain/quote
 * Get cross-chain transaction quote
 */
router.post('/quote',
  authMiddleware,
  [
    body('fromChain')
      .notEmpty()
      .withMessage('Source chain is required')
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid source chain'),
    body('toChain')
      .notEmpty()
      .withMessage('Destination chain is required')
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid destination chain'),
    body('fromToken')
      .notEmpty()
      .withMessage('Source token is required')
      .isString(),
    body('toToken')
      .notEmpty()
      .withMessage('Destination token is required')
      .isString(),
    body('amount')
      .notEmpty()
      .withMessage('Amount is required')
      .isNumeric()
      .withMessage('Amount must be numeric')
      .custom((value) => {
        if (parseFloat(value) <= 0) {
          throw new Error('Amount must be greater than 0');
        }
        return true;
      }),
    body('userAddress')
      .optional()
      .isString()
      .withMessage('User address must be a string')
  ],
  validateRequest,
  auditMiddleware('crosschain_quote_request'),
  async (req, res, next) => {
    try {
      const { fromChain, toChain, fromToken, toToken, amount, userAddress } = req.body;
      const userId = req.user.id;

      // Validate that chains are different
      if (fromChain === toChain) {
        return res.status(400).json({
          success: false,
          error: 'Source and destination chains must be different'
        });
      }

      // Get user address if not provided
      let finalUserAddress = userAddress;
      if (!finalUserAddress) {
        const fromWallet = walletService.getUserWalletConnection(userId, fromChain);
        if (fromWallet) {
          finalUserAddress = fromWallet.publicKey || fromWallet.accounts?.[0];
        }
      }

      if (!finalUserAddress) {
        return res.status(400).json({
          success: false,
          error: 'User address required - please connect wallet or provide address'
        });
      }

      const quote = await crossChainService.getCrosschainQuote(
        fromChain,
        toChain,
        fromToken,
        toToken,
        amount,
        finalUserAddress
      );
      
      res.json({
        success: true,
        data: quote
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/crosschain/execute
 * Execute cross-chain transaction
 */
router.post('/execute',
  authMiddleware,
  [
    body('quoteId')
      .notEmpty()
      .withMessage('Quote ID is required')
      .isString(),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object')
  ],
  validateRequest,
  auditMiddleware('crosschain_transaction_execute'),
  async (req, res, next) => {
    try {
      const { quoteId, options = {} } = req.body;
      const userId = req.user.id;

      const result = await crossChainService.executeCrosschainTransaction(
        userId,
        quoteId,
        options
      );
      
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
 * GET /api/crosschain/transaction/:transactionId
 * Get cross-chain transaction status
 */
router.get('/transaction/:transactionId',
  authMiddleware,
  [
    param('transactionId')
      .notEmpty()
      .withMessage('Transaction ID is required')
      .isString()
  ],
  validateRequest,
  auditMiddleware('crosschain_transaction_status'),
  async (req, res, next) => {
    try {
      const { transactionId } = req.params;

      const status = await crossChainService.getCrosschainTransactionStatus(transactionId);
      
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
 * GET /api/crosschain/bridge-providers
 * Get available bridge providers
 */
router.get('/bridge-providers',
  auditMiddleware('crosschain_bridge_providers'),
  async (req, res, next) => {
    try {
      if (!crossChainService) {
        return res.status(503).json({
          success: false,
          error: 'Cross-chain service not initialized'
        });
      }

      const providers = crossChainService.bridgeProviders;
      
      res.json({
        success: true,
        data: {
          providers: Object.entries(providers).map(([id, config]) => ({
            id,
            ...config
          })),
          count: Object.keys(providers).length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/crosschain/fees
 * Get cross-chain fee information
 */
router.get('/fees',
  [
    query('fromChain')
      .optional()
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid source chain'),
    query('toChain')
      .optional()
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid destination chain')
  ],
  validateRequest,
  auditMiddleware('crosschain_fees_inquiry'),
  async (req, res, next) => {
    try {
      const { fromChain, toChain } = req.query;

      if (!crossChainService) {
        return res.status(503).json({
          success: false,
          error: 'Cross-chain service not initialized'
        });
      }

      let feeInfo = {};

      if (fromChain && toChain) {
        // Get specific pair fee info
        const bridgeKey = `${fromChain}_${toChain}`;
        const bridgeConfig = crossChainService.bridgeConfigurations[bridgeKey];
        
        if (bridgeConfig) {
          feeInfo = {
            pair: `${fromChain} → ${toChain}`,
            bridgeFee: bridgeConfig.fee,
            minAmount: bridgeConfig.minAmount,
            maxAmount: bridgeConfig.maxAmount,
            estimatedTime: bridgeConfig.estimatedTime,
            provider: bridgeConfig.provider
          };
        } else {
          return res.status(404).json({
            success: false,
            error: 'Bridge not available for this pair'
          });
        }
      } else {
        // Get all fee information
        feeInfo = {
          bridgeConfigurations: crossChainService.bridgeConfigurations,
          bridgeProviders: crossChainService.bridgeProviders
        };
      }
      
      res.json({
        success: true,
        data: {
          feeInfo,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/crosschain/routes
 * Get available cross-chain routes
 */
router.get('/routes',
  [
    query('fromChain')
      .optional()
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid source chain'),
    query('toChain')
      .optional()
      .isIn(['XRP', 'STELLAR', 'XDC', 'SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'])
      .withMessage('Invalid destination chain')
  ],
  validateRequest,
  auditMiddleware('crosschain_routes_inquiry'),
  async (req, res, next) => {
    try {
      const { fromChain, toChain } = req.query;

      if (!crossChainService) {
        return res.status(503).json({
          success: false,
          error: 'Cross-chain service not initialized'
        });
      }

      const allRoutes = [];
      
      // Build routes from bridge configurations
      for (const [bridgeKey, config] of Object.entries(crossChainService.bridgeConfigurations)) {
        const [from, to] = bridgeKey.split('_');
        
        // Filter by query parameters if provided
        if (fromChain && from !== fromChain) continue;
        if (toChain && to !== toChain) continue;
        
        allRoutes.push({
          fromChain: from,
          toChain: to,
          provider: config.provider,
          type: config.type,
          fee: config.fee,
          estimatedTime: config.estimatedTime,
          minAmount: config.minAmount,
          maxAmount: config.maxAmount,
          isActive: true
        });
      }
      
      res.json({
        success: true,
        data: {
          routes: allRoutes,
          count: allRoutes.length,
          filters: { fromChain, toChain },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/crosschain/user-transactions
 * Get user's cross-chain transaction history
 */
router.get('/user-transactions',
  authMiddleware,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative'),
    query('status')
      .optional()
      .isIn(['initiated', 'in_progress', 'completed', 'failed'])
      .withMessage('Invalid status filter')
  ],
  validateRequest,
  auditMiddleware('crosschain_user_transactions'),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0, status } = req.query;

      // Mock implementation - would query database
      const transactions = [
        {
          id: 'crosschain_123',
          fromChain: 'AVALANCHE',
          toChain: 'POLYGON',
          fromToken: 'AVAX',
          toToken: 'MATIC',
          inputAmount: '100',
          outputAmount: '250',
          status: 'completed',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3000000).toISOString()
        },
        {
          id: 'crosschain_124',
          fromChain: 'SOLANA',
          toChain: 'BSC',
          fromToken: 'SOL',
          toToken: 'BNB',
          inputAmount: '50',
          outputAmount: '15',
          status: 'in_progress',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          completedAt: null
        }
      ];

      // Apply filters
      let filteredTransactions = transactions;
      if (status) {
        filteredTransactions = transactions.filter(tx => tx.status === status);
      }

      // Apply pagination
      const paginatedTransactions = filteredTransactions.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );
      
      res.json({
        success: true,
        data: {
          transactions: paginatedTransactions,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: filteredTransactions.length,
            hasMore: parseInt(offset) + parseInt(limit) < filteredTransactions.length
          },
          filters: { status },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/crosschain/health
 * Health check for cross-chain service
 */
router.get('/health',
  auditMiddleware('crosschain_health_check'),
  async (req, res, next) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          crossChainService: !!crossChainService,
          blockchainServices: !!blockchainServices,
          walletService: !!walletService
        }
      };

      if (crossChainService) {
        try {
          const supportedPairs = crossChainService.getSupportedCrosschainPairs();
          health.supportedPairs = supportedPairs.length;
          health.bridgeProviders = Object.keys(crossChainService.bridgeProviders).length;
          health.bridgeConfigurations = Object.keys(crossChainService.bridgeConfigurations).length;
        } catch (error) {
          health.status = 'degraded';
          health.error = error.message;
        }
      } else {
        health.status = 'unhealthy';
        health.error = 'Cross-chain service not initialized';
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
router.use(handleCrossChainError);

module.exports = {
  router,
  initializeServices
};

