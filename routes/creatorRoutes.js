/**
 * Creator Tools API Routes
 * Handles creator dashboard, royalty management, and verification
 */

const express = require('express');
const CreatorToolsService = require('../services/CreatorToolsService');
const { auditLogger } = require('../services/auditLogger');

const router = express.Router();
let creatorToolsService;

// Initialize creator tools service
const initializeCreatorToolsService = async (socketIO = null) => {
  if (!creatorToolsService) {
    creatorToolsService = new CreatorToolsService();
    await creatorToolsService.initialize(socketIO);
  }
  return creatorToolsService;
};

// Middleware to ensure creator tools service is initialized
const ensureCreatorToolsService = async (req, res, next) => {
  try {
    await initializeCreatorToolsService();
    next();
  } catch (error) {
    console.error('[Creator Tools Routes] Service initialization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Service initialization failed',
      message: error.message
    });
  }
};

/**
 * @route GET /api/creator/dashboard/:creatorId
 * @desc Get creator dashboard data
 * @access Private
 */
router.get('/dashboard/:creatorId', ensureCreatorToolsService, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { timeframe = '30d' } = req.query;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own dashboard unless admin
    if (requestingUserId !== creatorId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const dashboard = await creatorToolsService.getCreatorDashboard(creatorId, timeframe);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get dashboard failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get creator dashboard',
      message: error.message
    });
  }
});

/**
 * @route GET /api/creator/analytics/:creatorId
 * @desc Get creator analytics data
 * @access Private
 */
router.get('/analytics/:creatorId', ensureCreatorToolsService, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { timeframe = '30d' } = req.query;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own analytics unless admin
    if (requestingUserId !== creatorId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const timeFilter = creatorToolsService.getTimeFilter(timeframe);
    
    // Get revenue analytics
    const revenueAnalytics = await creatorToolsService.getRevenueAnalytics(creatorId, timeFilter);
    
    // Get top performing NFTs
    const topNFTs = await creatorToolsService.getTopPerformingNFTs(creatorId, timeFilter, 10);
    
    // Get marketplace insights
    const marketplaceInsights = await creatorToolsService.getMarketplaceInsights(creatorId, timeFilter);

    res.json({
      success: true,
      data: {
        timeframe,
        revenue_analytics: revenueAnalytics,
        top_nfts: topNFTs,
        marketplace_insights: marketplaceInsights
      }
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get creator analytics',
      message: error.message
    });
  }
});

/**
 * @route GET /api/creator/activity/:creatorId
 * @desc Get creator activity feed
 * @access Private
 */
router.get('/activity/:creatorId', ensureCreatorToolsService, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { limit = 20 } = req.query;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own activity unless admin
    if (requestingUserId !== creatorId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const activity = await creatorToolsService.getCreatorActivity(creatorId, parseInt(limit));

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get activity failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get creator activity',
      message: error.message
    });
  }
});

/**
 * @route POST /api/creator/royalty/settings
 * @desc Manage royalty settings
 * @access Private
 */
router.post('/royalty/settings', ensureCreatorToolsService, async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const settingsData = {
      ...req.body,
      creator_id: userId
    };

    // Validate required fields
    const requiredFields = ['royalty_percentage', 'recipients'];
    for (const field of requiredFields) {
      if (settingsData[field] === undefined) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }

    const result = await creatorToolsService.manageRoyaltySettings(userId, settingsData);

    // Log royalty settings change
    await auditLogger.logUserActivity(userId, 'ROYALTY_SETTINGS_UPDATED', {
      collection_id: settingsData.collection_id,
      nft_id: settingsData.nft_id,
      royalty_percentage: settingsData.royalty_percentage,
      recipients_count: settingsData.recipients.length
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Manage royalty settings failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to manage royalty settings',
      message: error.message
    });
  }
});

/**
 * @route GET /api/creator/royalty/earnings/:creatorId
 * @desc Get royalty earnings report
 * @access Private
 */
router.get('/royalty/earnings/:creatorId', ensureCreatorToolsService, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { timeframe = '30d' } = req.query;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own earnings unless admin
    if (requestingUserId !== creatorId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const report = await creatorToolsService.getRoyaltyEarningsReport(creatorId, timeframe);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get royalty earnings failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get royalty earnings',
      message: error.message
    });
  }
});

/**
 * @route POST /api/creator/verification/submit
 * @desc Submit creator verification request
 * @access Private
 */
router.post('/verification/submit', ensureCreatorToolsService, async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const verificationData = req.body;

    // Validate required fields
    const requiredFields = ['verification_type', 'bio'];
    for (const field of requiredFields) {
      if (!verificationData[field]) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }

    const verification = await creatorToolsService.submitVerificationRequest(userId, verificationData);

    // Log verification submission
    await auditLogger.logUserActivity(userId, 'VERIFICATION_SUBMITTED', {
      verification_id: verification.id,
      verification_type: verification.verification_type
    });

    res.status(201).json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Submit verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit verification request',
      message: error.message
    });
  }
});

/**
 * @route GET /api/creator/verification/status/:creatorId
 * @desc Get creator verification status
 * @access Private
 */
router.get('/verification/status/:creatorId', ensureCreatorToolsService, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own verification status unless admin
    if (requestingUserId !== creatorId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const status = await creatorToolsService.getVerificationStatus(creatorId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get verification status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get verification status',
      message: error.message
    });
  }
});

/**
 * @route GET /api/creator/collections/:creatorId
 * @desc Get creator's collections with detailed stats
 * @access Private
 */
router.get('/collections/:creatorId', ensureCreatorToolsService, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own collections unless admin
    if (requestingUserId !== creatorId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const collections = await db.nft_collections.findAndCountAll({
      where: { creator_id: creatorId },
      include: [
        {
          model: db.nfts,
          as: 'nfts',
          include: [
            { model: db.nft_transactions, as: 'transactions' },
            { model: db.nft_auctions, as: 'auctions' }
          ]
        },
        { model: db.categories, as: 'category' }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format collections with stats
    const formattedCollections = collections.rows.map(collection => 
      creatorToolsService.formatCollectionSummary(collection)
    );

    res.json({
      success: true,
      data: {
        collections: formattedCollections,
        total: collections.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get collections failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get creator collections',
      message: error.message
    });
  }
});

/**
 * @route GET /api/creator/nfts/:creatorId
 * @desc Get creator's NFTs with performance data
 * @access Private
 */
router.get('/nfts/:creatorId', ensureCreatorToolsService, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { 
      collection_id, 
      status, 
      blockchain,
      limit = 20, 
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own NFTs unless admin
    if (requestingUserId !== creatorId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const whereClause = { creator_id: creatorId };
    if (collection_id) whereClause.collection_id = collection_id;
    if (status) whereClause.status = status;
    if (blockchain) whereClause.blockchain = blockchain;

    const nfts = await db.nfts.findAndCountAll({
      where: whereClause,
      include: [
        { model: db.nft_collections, as: 'collection' },
        { model: db.nft_transactions, as: 'transactions' },
        { model: db.nft_auctions, as: 'auctions' },
        { model: db.users, as: 'current_owner' }
      ],
      order: [[sort_by, sort_order]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Add performance metrics to each NFT
    const nftsWithMetrics = nfts.rows.map(nft => {
      const sales = nft.transactions?.filter(t => t.transaction_type === 'SALE') || [];
      const activeAuctions = nft.auctions?.filter(a => a.status === 'ACTIVE') || [];
      
      return {
        ...nft.toJSON(),
        performance: {
          total_sales: sales.length,
          total_volume: sales.reduce((sum, sale) => sum + parseFloat(sale.price || 0), 0),
          highest_sale: sales.length > 0 ? Math.max(...sales.map(s => parseFloat(s.price || 0))) : 0,
          average_price: sales.length > 0 ? 
            sales.reduce((sum, sale) => sum + parseFloat(sale.price || 0), 0) / sales.length : 0,
          active_listings: activeAuctions.length,
          current_listing_price: activeAuctions[0]?.current_price || null
        }
      };
    });

    res.json({
      success: true,
      data: {
        nfts: nftsWithMetrics,
        total: nfts.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get NFTs failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get creator NFTs',
      message: error.message
    });
  }
});

/**
 * @route GET /api/creator/leaderboard
 * @desc Get creator leaderboard
 * @access Public
 */
router.get('/leaderboard', ensureCreatorToolsService, async (req, res) => {
  try {
    const { 
      timeframe = '30d',
      metric = 'volume',
      blockchain,
      limit = 50 
    } = req.query;

    const timeFilter = creatorToolsService.getTimeFilter(timeframe);
    
    let orderBy;
    switch (metric) {
      case 'volume':
        orderBy = [db.sequelize.fn('SUM', db.sequelize.col('nfts.transactions.price')), 'DESC'];
        break;
      case 'sales':
        orderBy = [db.sequelize.fn('COUNT', db.sequelize.col('nfts.transactions.id')), 'DESC'];
        break;
      case 'nfts':
        orderBy = [db.sequelize.fn('COUNT', db.sequelize.col('nfts.id')), 'DESC'];
        break;
      default:
        orderBy = [db.sequelize.fn('SUM', db.sequelize.col('nfts.transactions.price')), 'DESC'];
    }

    const whereClause = {};
    if (blockchain) {
      whereClause['$nfts.blockchain$'] = blockchain;
    }

    const leaderboard = await db.users.findAll({
      where: whereClause,
      include: [
        {
          model: db.nfts,
          as: 'created_nfts',
          include: [
            {
              model: db.nft_transactions,
              as: 'transactions',
              where: {
                transaction_type: 'SALE',
                created_at: { [Op.gte]: timeFilter }
              },
              required: false
            }
          ]
        }
      ],
      attributes: [
        'id',
        'username',
        'profile_pic',
        [db.sequelize.fn('COUNT', db.sequelize.col('created_nfts.id')), 'total_nfts'],
        [db.sequelize.fn('COUNT', db.sequelize.col('created_nfts.transactions.id')), 'total_sales'],
        [db.sequelize.fn('SUM', db.sequelize.col('created_nfts.transactions.price')), 'total_volume'],
        [db.sequelize.fn('AVG', db.sequelize.col('created_nfts.transactions.price')), 'average_price']
      ],
      group: ['users.id'],
      order: [orderBy],
      limit: parseInt(limit),
      raw: false
    });

    res.json({
      success: true,
      data: {
        leaderboard: leaderboard.map((creator, index) => ({
          rank: index + 1,
          creator_id: creator.id,
          username: creator.username,
          profile_pic: creator.profile_pic,
          total_nfts: parseInt(creator.dataValues.total_nfts || 0),
          total_sales: parseInt(creator.dataValues.total_sales || 0),
          total_volume: parseFloat(creator.dataValues.total_volume || 0),
          average_price: parseFloat(creator.dataValues.average_price || 0)
        })),
        timeframe,
        metric,
        blockchain
      }
    });
  } catch (error) {
    console.error('[Creator Tools Routes] Get leaderboard failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get creator leaderboard',
      message: error.message
    });
  }
});

module.exports = { router, initializeCreatorToolsService };

