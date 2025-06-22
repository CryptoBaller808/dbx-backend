/**
 * Cross-Chain Bridge API Routes
 * Handles NFT bridging between different blockchain networks
 */

const express = require('express');
const CrossChainNFTBridge = require('../services/CrossChainNFTBridge');
const { auditLogger } = require('../services/auditLogger');

const router = express.Router();
let bridgeService;

// Initialize bridge service
const initializeBridgeService = async (socketIO = null) => {
  if (!bridgeService) {
    bridgeService = new CrossChainNFTBridge();
    await bridgeService.initialize(socketIO);
  }
  return bridgeService;
};

// Middleware to ensure bridge service is initialized
const ensureBridgeService = async (req, res, next) => {
  try {
    await initializeBridgeService();
    next();
  } catch (error) {
    console.error('[Bridge Routes] Service initialization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Service initialization failed',
      message: error.message
    });
  }
};

/**
 * @route POST /api/bridge/initiate
 * @desc Initiate NFT bridge transfer
 * @access Private
 */
router.post('/initiate', ensureBridgeService, async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const bridgeData = {
      ...req.body,
      user_id: userId
    };

    // Validate required fields
    const requiredFields = ['nft_id', 'source_chain', 'destination_chain', 'destination_address'];
    for (const field of requiredFields) {
      if (!bridgeData[field]) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }

    const result = await bridgeService.initiateBridge(bridgeData);

    // Log bridge initiation
    await auditLogger.logUserActivity(userId, 'BRIDGE_INITIATED', {
      bridge_id: result.bridge_transaction.id,
      nft_id: bridgeData.nft_id,
      source_chain: bridgeData.source_chain,
      destination_chain: bridgeData.destination_chain,
      bridge_fee: result.bridge_fee
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Bridge Routes] Bridge initiation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Bridge initiation failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/bridge/:id/burn
 * @desc Execute burn phase of bridge
 * @access Private
 */
router.post('/:id/burn', ensureBridgeService, async (req, res) => {
  try {
    const { id } = req.params;
    const { burn_signature } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!burn_signature) {
      return res.status(400).json({
        success: false,
        error: 'Burn signature is required'
      });
    }

    const result = await bridgeService.executeBurnPhase(id, burn_signature);

    // Log burn execution
    await auditLogger.logUserActivity(userId, 'BRIDGE_BURN_EXECUTED', {
      bridge_id: id,
      burn_tx_hash: burn_signature.transactionHash,
      block_number: burn_signature.blockNumber
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Bridge Routes] Burn execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Burn execution failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/bridge/:id/mint
 * @desc Execute mint phase of bridge
 * @access Private
 */
router.post('/:id/mint', ensureBridgeService, async (req, res) => {
  try {
    const { id } = req.params;
    const { validator_signatures } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!validator_signatures) {
      return res.status(400).json({
        success: false,
        error: 'Validator signatures are required'
      });
    }

    const result = await bridgeService.executeMintPhase(id, validator_signatures);

    // Log mint execution
    await auditLogger.logUserActivity(userId, 'BRIDGE_MINT_EXECUTED', {
      bridge_id: id,
      original_nft_id: result.bridge_transaction.nft_id,
      mirrored_nft_id: result.mirrored_nft.id,
      destination_chain: result.bridge_transaction.destination_chain,
      mint_tx_hash: result.mirrored_nft.transaction_hash
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Bridge Routes] Mint execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Mint execution failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/bridge/:id/status
 * @desc Get bridge transaction status
 * @access Public
 */
router.get('/:id/status', ensureBridgeService, async (req, res) => {
  try {
    const { id } = req.params;

    const status = await bridgeService.getBridgeStatus(id);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[Bridge Routes] Get bridge status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bridge status',
      message: error.message
    });
  }
});

/**
 * @route GET /api/bridge/user/:userId
 * @desc Get user's bridge transactions
 * @access Private
 */
router.get('/user/:userId', ensureBridgeService, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own bridge transactions unless admin
    if (requestingUserId !== userId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const filters = {
      status: req.query.status,
      source_chain: req.query.source_chain,
      destination_chain: req.query.destination_chain,
      limit: req.query.limit || 20,
      offset: req.query.offset || 0
    };

    const result = await bridgeService.getUserBridgeTransactions(userId, filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Bridge Routes] Get user bridge transactions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user bridge transactions',
      message: error.message
    });
  }
});

/**
 * @route GET /api/bridge/statistics
 * @desc Get bridge statistics
 * @access Public
 */
router.get('/statistics', ensureBridgeService, async (req, res) => {
  try {
    const filters = {
      time_period: req.query.time_period || '7d',
      source_chain: req.query.source_chain,
      destination_chain: req.query.destination_chain
    };

    const stats = await bridgeService.getBridgeStatistics(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Bridge Routes] Get bridge statistics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bridge statistics',
      message: error.message
    });
  }
});

/**
 * @route GET /api/bridge/supported-chains
 * @desc Get supported blockchain networks for bridging
 * @access Public
 */
router.get('/supported-chains', ensureBridgeService, async (req, res) => {
  try {
    const supportedChains = bridgeService.supportedChains;
    
    // Get bridge fees for each chain pair
    const chainPairs = [];
    for (let i = 0; i < supportedChains.length; i++) {
      for (let j = 0; j < supportedChains.length; j++) {
        if (i !== j) {
          const sourceChain = supportedChains[i];
          const destChain = supportedChains[j];
          const fee = bridgeService.calculateBridgeFee(sourceChain, destChain, { attributes: [] });
          
          chainPairs.push({
            source_chain: sourceChain,
            destination_chain: destChain,
            bridge_fee: fee,
            estimated_time: bridgeService.estimateCompletionTime(sourceChain, destChain)
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        supported_chains: supportedChains,
        chain_pairs: chainPairs,
        verification_threshold: bridgeService.verificationThreshold
      }
    });
  } catch (error) {
    console.error('[Bridge Routes] Get supported chains failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported chains',
      message: error.message
    });
  }
});

/**
 * @route POST /api/bridge/estimate-fee
 * @desc Estimate bridge fee for NFT transfer
 * @access Public
 */
router.post('/estimate-fee', ensureBridgeService, async (req, res) => {
  try {
    const { source_chain, destination_chain, nft_id } = req.body;

    if (!source_chain || !destination_chain) {
      return res.status(400).json({
        success: false,
        error: 'Source and destination chains are required'
      });
    }

    // Get NFT details if provided
    let nft = { attributes: [] };
    if (nft_id) {
      const nftRecord = await db.nfts.findByPk(nft_id);
      if (nftRecord) {
        nft = nftRecord;
      }
    }

    const bridgeFee = bridgeService.calculateBridgeFee(source_chain, destination_chain, nft);
    const estimatedTime = bridgeService.estimateCompletionTime(source_chain, destination_chain);

    res.json({
      success: true,
      data: {
        bridge_fee: bridgeFee,
        estimated_completion_time: estimatedTime,
        source_chain,
        destination_chain
      }
    });
  } catch (error) {
    console.error('[Bridge Routes] Fee estimation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Fee estimation failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/bridge/active
 * @desc Get all active bridge transactions
 * @access Public
 */
router.get('/active', ensureBridgeService, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const activeTransactions = await db.nft_bridge_transactions.findAndCountAll({
      where: {
        status: ['INITIATED', 'BURN_COMPLETED', 'VERIFYING', 'VERIFIED']
      },
      include: [
        {
          model: db.nfts,
          as: 'nft',
          include: [
            { model: db.nft_collections, as: 'collection' },
            { model: db.users, as: 'creator' }
          ]
        },
        { model: db.users, as: 'user' }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Add progress information
    const transactionsWithProgress = activeTransactions.rows.map(tx => ({
      ...tx.toJSON(),
      progress_percentage: bridgeService.calculateBridgeProgress(tx),
      estimated_time_remaining: bridgeService.estimateRemainingTime(tx)
    }));

    res.json({
      success: true,
      data: {
        transactions: transactionsWithProgress,
        total: activeTransactions.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('[Bridge Routes] Get active transactions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active transactions',
      message: error.message
    });
  }
});

/**
 * @route GET /api/bridge/recent
 * @desc Get recent completed bridge transactions
 * @access Public
 */
router.get('/recent', ensureBridgeService, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const recentTransactions = await db.nft_bridge_transactions.findAll({
      where: {
        status: 'MINT_COMPLETED'
      },
      include: [
        {
          model: db.nfts,
          as: 'nft',
          include: [
            { model: db.nft_collections, as: 'collection' },
            { model: db.users, as: 'creator' }
          ]
        },
        { model: db.users, as: 'user' }
      ],
      order: [['completion_timestamp', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: recentTransactions
    });
  } catch (error) {
    console.error('[Bridge Routes] Get recent transactions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent transactions',
      message: error.message
    });
  }
});

module.exports = { router, initializeBridgeService };

