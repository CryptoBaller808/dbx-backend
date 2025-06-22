/**
 * NFT Marketplace Trading API Routes
 * Handles auction creation, bidding, and marketplace trading
 */

const express = require('express');
const NFTAuctionService = require('../services/NFTAuctionService');
const { auditLogger } = require('../services/auditLogger');

const router = express.Router();
let auctionService;

// Initialize auction service
const initializeAuctionService = async (socketIO = null) => {
  if (!auctionService) {
    auctionService = new NFTAuctionService();
    await auctionService.initialize(socketIO);
  }
  return auctionService;
};

// Middleware to ensure auction service is initialized
const ensureAuctionService = async (req, res, next) => {
  try {
    await initializeAuctionService();
    next();
  } catch (error) {
    console.error('[Auction Routes] Service initialization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Service initialization failed',
      message: error.message
    });
  }
};

/**
 * @route POST /api/marketplace/auctions
 * @desc Create a new auction
 * @access Private
 */
router.post('/auctions', ensureAuctionService, async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const auctionData = {
      ...req.body,
      seller_id: userId
    };

    // Validate required fields
    const requiredFields = ['nft_id', 'auction_type', 'starting_price', 'currency', 'duration_hours'];
    for (const field of requiredFields) {
      if (!auctionData[field]) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }

    // Validate auction type specific fields
    if (auctionData.auction_type === 'DUTCH_AUCTION') {
      const dutchFields = ['price_drop_interval', 'price_drop_amount', 'minimum_price'];
      for (const field of dutchFields) {
        if (!auctionData[field]) {
          return res.status(400).json({
            success: false,
            error: `${field} is required for Dutch auctions`
          });
        }
      }
    }

    const auction = await auctionService.createAuction(auctionData);

    // Log auction creation
    await auditLogger.logUserActivity(userId, 'AUCTION_CREATED', {
      auction_id: auction.id,
      nft_id: auction.nft_id,
      auction_type: auction.auction_type,
      starting_price: auction.starting_price,
      currency: auction.currency
    });

    res.status(201).json({
      success: true,
      data: auction
    });
  } catch (error) {
    console.error('[Auction Routes] Auction creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Auction creation failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/marketplace/auctions/:id/bids
 * @desc Place a bid on an auction
 * @access Private
 */
router.post('/auctions/:id/bids', ensureAuctionService, async (req, res) => {
  try {
    const { id } = req.params;
    const { bid_amount, bid_signature } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!bid_amount || bid_amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid bid amount is required'
      });
    }

    const result = await auctionService.placeBid(id, userId, bid_amount, bid_signature);

    // Log bid placement
    await auditLogger.logUserActivity(userId, 'BID_PLACED', {
      auction_id: id,
      bid_id: result.bid.id,
      bid_amount,
      currency: result.bid.currency,
      is_winning: result.isWinning
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Auction Routes] Bid placement failed:', error);
    res.status(500).json({
      success: false,
      error: 'Bid placement failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/marketplace/auctions
 * @desc Get active auctions with filters
 * @access Public
 */
router.get('/auctions', ensureAuctionService, async (req, res) => {
  try {
    const filters = {
      auction_type: req.query.auction_type,
      blockchain: req.query.blockchain,
      category_id: req.query.category_id,
      min_price: req.query.min_price ? parseFloat(req.query.min_price) : undefined,
      max_price: req.query.max_price ? parseFloat(req.query.max_price) : undefined,
      currency: req.query.currency,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'DESC',
      limit: req.query.limit || 20,
      offset: req.query.offset || 0
    };

    const result = await auctionService.getActiveAuctions(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Auction Routes] Get auctions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auctions',
      message: error.message
    });
  }
});

/**
 * @route GET /api/marketplace/auctions/:id
 * @desc Get auction details with bids
 * @access Public
 */
router.get('/auctions/:id', ensureAuctionService, async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await auctionService.getAuctionDetails(id);

    res.json({
      success: true,
      data: auction
    });
  } catch (error) {
    console.error('[Auction Routes] Get auction details failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auction details',
      message: error.message
    });
  }
});

/**
 * @route PUT /api/marketplace/auctions/:id/cancel
 * @desc Cancel an auction
 * @access Private
 */
router.put('/auctions/:id/cancel', ensureAuctionService, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const auction = await auctionService.cancelAuction(id, userId);

    // Log auction cancellation
    await auditLogger.logUserActivity(userId, 'AUCTION_CANCELLED', {
      auction_id: id,
      nft_id: auction.nft_id
    });

    res.json({
      success: true,
      data: auction
    });
  } catch (error) {
    console.error('[Auction Routes] Auction cancellation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Auction cancellation failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/marketplace/auctions/user/:userId
 * @desc Get user's auctions (selling)
 * @access Private
 */
router.get('/auctions/user/:userId', ensureAuctionService, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own auctions unless admin
    if (requestingUserId !== userId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { status = 'all', limit = 20, offset = 0 } = req.query;

    const whereClause = { seller_id: userId };
    if (status !== 'all') {
      whereClause.status = status;
    }

    const auctions = await db.nft_auctions.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.nfts,
          as: 'nft',
          include: [{ model: db.nft_collections, as: 'collection' }]
        },
        { model: db.users, as: 'highest_bidder' },
        { model: db.users, as: 'buyer' }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        auctions: auctions.rows,
        total: auctions.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('[Auction Routes] Get user auctions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user auctions',
      message: error.message
    });
  }
});

/**
 * @route GET /api/marketplace/bids/user/:userId
 * @desc Get user's bids
 * @access Private
 */
router.get('/bids/user/:userId', ensureAuctionService, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id || req.query.user_id;

    // Users can only view their own bids unless admin
    if (requestingUserId !== userId && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { status = 'all', limit = 20, offset = 0 } = req.query;

    const whereClause = { bidder_id: userId };
    if (status !== 'all') {
      whereClause.status = status;
    }

    const bids = await db.nft_bids.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.nft_auctions,
          as: 'auction',
          include: [
            {
              model: db.nfts,
              as: 'nft',
              include: [{ model: db.nft_collections, as: 'collection' }]
            },
            { model: db.users, as: 'seller' }
          ]
        }
      ],
      order: [['bid_timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        bids: bids.rows,
        total: bids.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('[Auction Routes] Get user bids failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user bids',
      message: error.message
    });
  }
});

/**
 * @route GET /api/marketplace/statistics
 * @desc Get marketplace statistics
 * @access Public
 */
router.get('/statistics', ensureAuctionService, async (req, res) => {
  try {
    const filters = {
      blockchain: req.query.blockchain,
      auction_type: req.query.auction_type,
      time_period: req.query.time_period || '7d'
    };

    const stats = await auctionService.getAuctionStatistics(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Auction Routes] Get statistics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

/**
 * @route GET /api/marketplace/trending
 * @desc Get trending NFTs and collections
 * @access Public
 */
router.get('/trending', ensureAuctionService, async (req, res) => {
  try {
    const { time_period = '24h', limit = 10 } = req.query;
    
    const timeFilter = auctionService.getTimeFilter(time_period);

    // Get trending NFTs by bid activity
    const trendingNFTs = await db.nft_auctions.findAll({
      where: {
        status: 'ACTIVE',
        created_at: {
          [Op.gte]: timeFilter
        }
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
        { model: db.users, as: 'seller' }
      ],
      order: [
        ['total_bids', 'DESC'],
        ['view_count', 'DESC']
      ],
      limit: parseInt(limit)
    });

    // Get trending collections by volume
    const trendingCollections = await db.nft_collections.findAll({
      attributes: [
        'id',
        'name',
        'logo_image_url',
        'blockchain',
        'total_volume',
        'floor_price',
        'total_sales'
      ],
      order: [
        ['total_volume', 'DESC'],
        ['total_sales', 'DESC']
      ],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        trending_nfts: trendingNFTs,
        trending_collections: trendingCollections,
        time_period
      }
    });
  } catch (error) {
    console.error('[Auction Routes] Get trending failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending data',
      message: error.message
    });
  }
});

/**
 * @route POST /api/marketplace/auctions/:id/watch
 * @desc Add auction to watchlist
 * @access Private
 */
router.post('/auctions/:id/watch', ensureAuctionService, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Increment watch count
    await db.nft_auctions.increment('watch_count', {
      where: { id }
    });

    // You could also create a watchlist table to track user-specific watches
    // For now, just increment the counter

    res.json({
      success: true,
      message: 'Auction added to watchlist'
    });
  } catch (error) {
    console.error('[Auction Routes] Add to watchlist failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to watchlist',
      message: error.message
    });
  }
});

/**
 * @route GET /api/marketplace/featured
 * @desc Get featured auctions
 * @access Public
 */
router.get('/featured', ensureAuctionService, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const featuredAuctions = await db.nft_auctions.findAll({
      where: {
        status: 'ACTIVE',
        is_featured: true,
        end_time: {
          [Op.gt]: new Date()
        }
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
        { model: db.users, as: 'seller' },
        { model: db.users, as: 'highest_bidder' }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit)
    });

    // Add time remaining for each auction
    const auctionsWithTimeRemaining = featuredAuctions.map(auction => {
      const now = new Date();
      const timeRemaining = auction.end_time.getTime() - now.getTime();
      
      return {
        ...auction.toJSON(),
        time_remaining: Math.max(0, timeRemaining)
      };
    });

    res.json({
      success: true,
      data: auctionsWithTimeRemaining
    });
  } catch (error) {
    console.error('[Auction Routes] Get featured auctions failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get featured auctions',
      message: error.message
    });
  }
});

module.exports = { router, initializeAuctionService };

