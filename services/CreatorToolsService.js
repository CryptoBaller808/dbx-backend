/**
 * Creator Tools Service
 * Comprehensive creator dashboard and management tools
 */

const db = require('../models');
const { Op } = require('sequelize');

class CreatorToolsService {
  constructor() {
    this.analyticsCache = new Map();
    this.royaltyProcessors = new Map();
    this.verificationQueue = new Map();
    this.socketIO = null;
  }

  /**
   * Initialize the creator tools service
   */
  async initialize(socketIO = null) {
    try {
      this.socketIO = socketIO;
      
      // Start analytics caching
      this.startAnalyticsCaching();
      
      // Initialize royalty processors
      this.initializeRoyaltyProcessors();
      
      console.log('[CreatorToolsService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[CreatorToolsService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get creator dashboard data
   */
  async getCreatorDashboard(creatorId, timeframe = '30d') {
    try {
      const timeFilter = this.getTimeFilter(timeframe);
      
      // Get creator's collections
      const collections = await db.nft_collections.findAll({
        where: { creator_id: creatorId },
        include: [
          {
            model: db.nfts,
            as: 'nfts',
            include: [
              { model: db.nft_transactions, as: 'transactions' },
              { model: db.nft_auctions, as: 'auctions' }
            ]
          }
        ]
      });

      // Calculate overview statistics
      const overview = await this.calculateCreatorOverview(creatorId, timeFilter);
      
      // Get recent activity
      const recentActivity = await this.getCreatorActivity(creatorId, 10);
      
      // Get revenue analytics
      const revenueAnalytics = await this.getRevenueAnalytics(creatorId, timeFilter);
      
      // Get top performing NFTs
      const topNFTs = await this.getTopPerformingNFTs(creatorId, timeFilter, 5);
      
      // Get marketplace insights
      const marketplaceInsights = await this.getMarketplaceInsights(creatorId, timeFilter);

      return {
        creator_id: creatorId,
        timeframe,
        overview,
        collections: collections.map(c => this.formatCollectionSummary(c)),
        recent_activity: recentActivity,
        revenue_analytics: revenueAnalytics,
        top_nfts: topNFTs,
        marketplace_insights: marketplaceInsights,
        last_updated: new Date()
      };
    } catch (error) {
      console.error('[CreatorToolsService] Get creator dashboard failed:', error);
      throw error;
    }
  }

  /**
   * Calculate creator overview statistics
   */
  async calculateCreatorOverview(creatorId, timeFilter) {
    try {
      // Total NFTs created
      const totalNFTs = await db.nfts.count({
        where: { creator_id: creatorId }
      });

      // Total collections
      const totalCollections = await db.nft_collections.count({
        where: { creator_id: creatorId }
      });

      // Total sales in timeframe
      const salesData = await db.nft_transactions.findAll({
        where: {
          transaction_type: 'SALE',
          created_at: { [Op.gte]: timeFilter }
        },
        include: [{
          model: db.nfts,
          as: 'nft',
          where: { creator_id: creatorId }
        }],
        attributes: [
          [db.sequelize.fn('COUNT', db.sequelize.col('nft_transactions.id')), 'total_sales'],
          [db.sequelize.fn('SUM', db.sequelize.col('price')), 'total_volume'],
          [db.sequelize.fn('AVG', db.sequelize.col('price')), 'average_price']
        ],
        raw: true
      });

      // Total royalties earned
      const royaltiesData = await db.nft_royalties.findAll({
        where: {
          recipient_id: creatorId,
          created_at: { [Op.gte]: timeFilter },
          payment_status: 'PAID'
        },
        attributes: [
          [db.sequelize.fn('SUM', db.sequelize.col('royalty_amount')), 'total_royalties'],
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'royalty_payments']
        ],
        raw: true
      });

      // Active auctions
      const activeAuctions = await db.nft_auctions.count({
        where: {
          seller_id: creatorId,
          status: 'ACTIVE'
        }
      });

      // Floor price (lowest listed price)
      const floorPrice = await db.nft_auctions.findOne({
        where: {
          seller_id: creatorId,
          status: 'ACTIVE'
        },
        include: [{
          model: db.nfts,
          as: 'nft',
          where: { creator_id: creatorId }
        }],
        order: [['current_price', 'ASC']],
        attributes: ['current_price', 'currency']
      });

      return {
        total_nfts: totalNFTs,
        total_collections: totalCollections,
        total_sales: parseInt(salesData[0]?.total_sales || 0),
        total_volume: parseFloat(salesData[0]?.total_volume || 0),
        average_price: parseFloat(salesData[0]?.average_price || 0),
        total_royalties: parseFloat(royaltiesData[0]?.total_royalties || 0),
        royalty_payments: parseInt(royaltiesData[0]?.royalty_payments || 0),
        active_auctions: activeAuctions,
        floor_price: floorPrice ? {
          amount: floorPrice.current_price,
          currency: floorPrice.currency
        } : null
      };
    } catch (error) {
      console.error('[CreatorToolsService] Calculate overview failed:', error);
      throw error;
    }
  }

  /**
   * Get creator activity feed
   */
  async getCreatorActivity(creatorId, limit = 20) {
    try {
      const activities = [];

      // NFT mints
      const mints = await db.nfts.findAll({
        where: {
          creator_id: creatorId,
          status: 'MINTED'
        },
        order: [['created_at', 'DESC']],
        limit: Math.floor(limit / 4),
        include: [{ model: db.nft_collections, as: 'collection' }]
      });

      mints.forEach(nft => {
        activities.push({
          type: 'MINT',
          timestamp: nft.created_at,
          data: {
            nft_id: nft.id,
            nft_name: nft.name,
            collection_name: nft.collection.name,
            blockchain: nft.blockchain
          }
        });
      });

      // Sales
      const sales = await db.nft_transactions.findAll({
        where: {
          transaction_type: 'SALE'
        },
        include: [{
          model: db.nfts,
          as: 'nft',
          where: { creator_id: creatorId },
          include: [{ model: db.nft_collections, as: 'collection' }]
        }],
        order: [['created_at', 'DESC']],
        limit: Math.floor(limit / 4)
      });

      sales.forEach(sale => {
        activities.push({
          type: 'SALE',
          timestamp: sale.created_at,
          data: {
            nft_id: sale.nft.id,
            nft_name: sale.nft.name,
            collection_name: sale.nft.collection.name,
            price: sale.price,
            currency: sale.currency,
            buyer_id: sale.to_user_id
          }
        });
      });

      // Royalty payments
      const royalties = await db.nft_royalties.findAll({
        where: {
          recipient_id: creatorId,
          payment_status: 'PAID'
        },
        order: [['created_at', 'DESC']],
        limit: Math.floor(limit / 4),
        include: [{
          model: db.nfts,
          as: 'nft',
          include: [{ model: db.nft_collections, as: 'collection' }]
        }]
      });

      royalties.forEach(royalty => {
        activities.push({
          type: 'ROYALTY',
          timestamp: royalty.created_at,
          data: {
            nft_id: royalty.nft.id,
            nft_name: royalty.nft.name,
            collection_name: royalty.nft.collection.name,
            royalty_amount: royalty.royalty_amount,
            currency: royalty.currency,
            sale_price: royalty.sale_price
          }
        });
      });

      // Collection creations
      const collections = await db.nft_collections.findAll({
        where: { creator_id: creatorId },
        order: [['created_at', 'DESC']],
        limit: Math.floor(limit / 4)
      });

      collections.forEach(collection => {
        activities.push({
          type: 'COLLECTION_CREATED',
          timestamp: collection.created_at,
          data: {
            collection_id: collection.id,
            collection_name: collection.name,
            blockchain: collection.blockchain,
            max_supply: collection.max_supply
          }
        });
      });

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return activities.slice(0, limit);
    } catch (error) {
      console.error('[CreatorToolsService] Get creator activity failed:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(creatorId, timeFilter) {
    try {
      // Primary sales revenue
      const primarySales = await db.nft_transactions.findAll({
        where: {
          transaction_type: 'SALE',
          from_user_id: creatorId,
          created_at: { [Op.gte]: timeFilter }
        },
        attributes: [
          [db.sequelize.fn('DATE', db.sequelize.col('created_at')), 'date'],
          [db.sequelize.fn('SUM', db.sequelize.col('price')), 'revenue'],
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'sales_count']
        ],
        group: [db.sequelize.fn('DATE', db.sequelize.col('created_at'))],
        order: [[db.sequelize.fn('DATE', db.sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      // Royalty revenue
      const royaltyRevenue = await db.nft_royalties.findAll({
        where: {
          recipient_id: creatorId,
          payment_status: 'PAID',
          created_at: { [Op.gte]: timeFilter }
        },
        attributes: [
          [db.sequelize.fn('DATE', db.sequelize.col('created_at')), 'date'],
          [db.sequelize.fn('SUM', db.sequelize.col('royalty_amount')), 'royalty_revenue'],
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'royalty_count']
        ],
        group: [db.sequelize.fn('DATE', db.sequelize.col('created_at'))],
        order: [[db.sequelize.fn('DATE', db.sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      // Combine and format data
      const revenueByDate = new Map();
      
      primarySales.forEach(sale => {
        const date = sale.date;
        if (!revenueByDate.has(date)) {
          revenueByDate.set(date, {
            date,
            primary_revenue: 0,
            royalty_revenue: 0,
            total_revenue: 0,
            sales_count: 0,
            royalty_count: 0
          });
        }
        const data = revenueByDate.get(date);
        data.primary_revenue = parseFloat(sale.revenue || 0);
        data.sales_count = parseInt(sale.sales_count || 0);
        data.total_revenue = data.primary_revenue + data.royalty_revenue;
      });

      royaltyRevenue.forEach(royalty => {
        const date = royalty.date;
        if (!revenueByDate.has(date)) {
          revenueByDate.set(date, {
            date,
            primary_revenue: 0,
            royalty_revenue: 0,
            total_revenue: 0,
            sales_count: 0,
            royalty_count: 0
          });
        }
        const data = revenueByDate.get(date);
        data.royalty_revenue = parseFloat(royalty.royalty_revenue || 0);
        data.royalty_count = parseInt(royalty.royalty_count || 0);
        data.total_revenue = data.primary_revenue + data.royalty_revenue;
      });

      const chartData = Array.from(revenueByDate.values()).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      // Calculate totals
      const totals = chartData.reduce((acc, day) => ({
        primary_revenue: acc.primary_revenue + day.primary_revenue,
        royalty_revenue: acc.royalty_revenue + day.royalty_revenue,
        total_revenue: acc.total_revenue + day.total_revenue,
        sales_count: acc.sales_count + day.sales_count,
        royalty_count: acc.royalty_count + day.royalty_count
      }), {
        primary_revenue: 0,
        royalty_revenue: 0,
        total_revenue: 0,
        sales_count: 0,
        royalty_count: 0
      });

      return {
        chart_data: chartData,
        totals,
        revenue_breakdown: {
          primary_percentage: totals.total_revenue > 0 ? 
            (totals.primary_revenue / totals.total_revenue) * 100 : 0,
          royalty_percentage: totals.total_revenue > 0 ? 
            (totals.royalty_revenue / totals.total_revenue) * 100 : 0
        }
      };
    } catch (error) {
      console.error('[CreatorToolsService] Get revenue analytics failed:', error);
      throw error;
    }
  }

  /**
   * Get top performing NFTs
   */
  async getTopPerformingNFTs(creatorId, timeFilter, limit = 10) {
    try {
      const topNFTs = await db.nfts.findAll({
        where: { creator_id: creatorId },
        include: [
          {
            model: db.nft_transactions,
            as: 'transactions',
            where: {
              transaction_type: 'SALE',
              created_at: { [Op.gte]: timeFilter }
            },
            required: false
          },
          {
            model: db.nft_collections,
            as: 'collection'
          },
          {
            model: db.nft_auctions,
            as: 'auctions',
            required: false
          }
        ],
        attributes: [
          'id',
          'name',
          'image_url',
          'blockchain',
          [db.sequelize.fn('COUNT', db.sequelize.col('transactions.id')), 'sales_count'],
          [db.sequelize.fn('SUM', db.sequelize.col('transactions.price')), 'total_volume'],
          [db.sequelize.fn('MAX', db.sequelize.col('transactions.price')), 'highest_sale'],
          [db.sequelize.fn('AVG', db.sequelize.col('transactions.price')), 'average_price']
        ],
        group: ['nfts.id', 'collection.id'],
        order: [[db.sequelize.fn('SUM', db.sequelize.col('transactions.price')), 'DESC']],
        limit,
        raw: false
      });

      return topNFTs.map(nft => ({
        id: nft.id,
        name: nft.name,
        image_url: nft.image_url,
        blockchain: nft.blockchain,
        collection_name: nft.collection?.name,
        sales_count: parseInt(nft.dataValues.sales_count || 0),
        total_volume: parseFloat(nft.dataValues.total_volume || 0),
        highest_sale: parseFloat(nft.dataValues.highest_sale || 0),
        average_price: parseFloat(nft.dataValues.average_price || 0),
        current_listing: nft.auctions?.find(a => a.status === 'ACTIVE')
      }));
    } catch (error) {
      console.error('[CreatorToolsService] Get top performing NFTs failed:', error);
      throw error;
    }
  }

  /**
   * Get marketplace insights
   */
  async getMarketplaceInsights(creatorId, timeFilter) {
    try {
      // Creator's market share
      const creatorVolume = await db.nft_transactions.sum('price', {
        where: {
          transaction_type: 'SALE',
          created_at: { [Op.gte]: timeFilter }
        },
        include: [{
          model: db.nfts,
          as: 'nft',
          where: { creator_id: creatorId }
        }]
      });

      const totalMarketVolume = await db.nft_transactions.sum('price', {
        where: {
          transaction_type: 'SALE',
          created_at: { [Op.gte]: timeFilter }
        }
      });

      const marketShare = totalMarketVolume > 0 ? (creatorVolume / totalMarketVolume) * 100 : 0;

      // Blockchain distribution
      const blockchainDistribution = await db.nfts.findAll({
        where: { creator_id: creatorId },
        attributes: [
          'blockchain',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'nft_count']
        ],
        group: ['blockchain'],
        raw: true
      });

      // Category performance
      const categoryPerformance = await db.nft_collections.findAll({
        where: { creator_id: creatorId },
        include: [{
          model: db.nfts,
          as: 'nfts',
          include: [{
            model: db.nft_transactions,
            as: 'transactions',
            where: {
              transaction_type: 'SALE',
              created_at: { [Op.gte]: timeFilter }
            },
            required: false
          }]
        }],
        attributes: [
          'category_id',
          [db.sequelize.fn('SUM', db.sequelize.col('nfts.transactions.price')), 'category_volume'],
          [db.sequelize.fn('COUNT', db.sequelize.col('nfts.transactions.id')), 'category_sales']
        ],
        group: ['category_id'],
        raw: true
      });

      // Collector insights
      const topCollectors = await db.nft_transactions.findAll({
        where: {
          transaction_type: 'SALE',
          created_at: { [Op.gte]: timeFilter }
        },
        include: [{
          model: db.nfts,
          as: 'nft',
          where: { creator_id: creatorId }
        }],
        attributes: [
          'to_user_id',
          [db.sequelize.fn('COUNT', db.sequelize.col('nft_transactions.id')), 'purchases'],
          [db.sequelize.fn('SUM', db.sequelize.col('price')), 'total_spent']
        ],
        group: ['to_user_id'],
        order: [[db.sequelize.fn('SUM', db.sequelize.col('price')), 'DESC']],
        limit: 5,
        raw: true
      });

      return {
        market_share: marketShare,
        creator_volume: creatorVolume || 0,
        total_market_volume: totalMarketVolume || 0,
        blockchain_distribution: blockchainDistribution,
        category_performance: categoryPerformance,
        top_collectors: topCollectors
      };
    } catch (error) {
      console.error('[CreatorToolsService] Get marketplace insights failed:', error);
      throw error;
    }
  }

  /**
   * Manage royalty settings
   */
  async manageRoyaltySettings(creatorId, settingsData) {
    try {
      const {
        collection_id,
        nft_id,
        royalty_percentage,
        recipients,
        auto_distribution = true
      } = settingsData;

      // Validate royalty percentage
      if (royalty_percentage < 0 || royalty_percentage > 20) {
        throw new Error('Royalty percentage must be between 0% and 20%');
      }

      // Validate recipients total percentage
      const totalPercentage = recipients.reduce((sum, r) => sum + r.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error('Recipient percentages must total 100%');
      }

      if (collection_id) {
        // Update collection royalty settings
        await db.nft_collections.update({
          default_royalty_percentage: royalty_percentage,
          royalty_recipients: recipients,
          auto_royalty_distribution: auto_distribution
        }, {
          where: {
            id: collection_id,
            creator_id: creatorId
          }
        });

        // Update all NFTs in collection if they don't have custom settings
        await db.nfts.update({
          royalty_percentage,
          royalty_recipients: recipients
        }, {
          where: {
            collection_id,
            creator_id: creatorId,
            custom_royalty_settings: false
          }
        });
      }

      if (nft_id) {
        // Update specific NFT royalty settings
        await db.nfts.update({
          royalty_percentage,
          royalty_recipients: recipients,
          custom_royalty_settings: true
        }, {
          where: {
            id: nft_id,
            creator_id: creatorId
          }
        });
      }

      // Log royalty settings change
      console.log(`[CreatorToolsService] Royalty settings updated for creator ${creatorId}`);
      
      return {
        success: true,
        royalty_percentage,
        recipients,
        auto_distribution
      };
    } catch (error) {
      console.error('[CreatorToolsService] Manage royalty settings failed:', error);
      throw error;
    }
  }

  /**
   * Get royalty earnings report
   */
  async getRoyaltyEarningsReport(creatorId, timeframe = '30d') {
    try {
      const timeFilter = this.getTimeFilter(timeframe);

      // Get all royalty payments
      const royaltyPayments = await db.nft_royalties.findAll({
        where: {
          recipient_id: creatorId,
          created_at: { [Op.gte]: timeFilter }
        },
        include: [
          {
            model: db.nfts,
            as: 'nft',
            include: [{ model: db.nft_collections, as: 'collection' }]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Group by status
      const paymentsByStatus = royaltyPayments.reduce((acc, payment) => {
        const status = payment.payment_status;
        if (!acc[status]) acc[status] = [];
        acc[status].push(payment);
        return acc;
      }, {});

      // Calculate totals
      const totals = {
        pending: 0,
        paid: 0,
        failed: 0,
        total_payments: royaltyPayments.length
      };

      Object.keys(paymentsByStatus).forEach(status => {
        const amount = paymentsByStatus[status].reduce((sum, p) => sum + parseFloat(p.royalty_amount), 0);
        totals[status.toLowerCase()] = amount;
      });

      // Group by collection
      const collectionBreakdown = royaltyPayments.reduce((acc, payment) => {
        const collectionId = payment.nft.collection_id;
        const collectionName = payment.nft.collection.name;
        
        if (!acc[collectionId]) {
          acc[collectionId] = {
            collection_id: collectionId,
            collection_name: collectionName,
            total_royalties: 0,
            payment_count: 0,
            payments: []
          };
        }
        
        acc[collectionId].total_royalties += parseFloat(payment.royalty_amount);
        acc[collectionId].payment_count += 1;
        acc[collectionId].payments.push(payment);
        
        return acc;
      }, {});

      // Group by blockchain
      const blockchainBreakdown = royaltyPayments.reduce((acc, payment) => {
        const blockchain = payment.blockchain;
        
        if (!acc[blockchain]) {
          acc[blockchain] = {
            blockchain,
            total_royalties: 0,
            payment_count: 0
          };
        }
        
        acc[blockchain].total_royalties += parseFloat(payment.royalty_amount);
        acc[blockchain].payment_count += 1;
        
        return acc;
      }, {});

      return {
        timeframe,
        totals,
        payments_by_status: paymentsByStatus,
        collection_breakdown: Object.values(collectionBreakdown),
        blockchain_breakdown: Object.values(blockchainBreakdown),
        recent_payments: royaltyPayments.slice(0, 20)
      };
    } catch (error) {
      console.error('[CreatorToolsService] Get royalty earnings report failed:', error);
      throw error;
    }
  }

  /**
   * Submit creator verification request
   */
  async submitVerificationRequest(creatorId, verificationData) {
    try {
      const {
        verification_type = 'CREATOR',
        documents,
        social_links,
        portfolio_links,
        bio,
        additional_info
      } = verificationData;

      // Check if verification request already exists
      const existingRequest = await db.creator_verifications.findOne({
        where: {
          creator_id: creatorId,
          status: ['PENDING', 'UNDER_REVIEW']
        }
      });

      if (existingRequest) {
        throw new Error('Verification request already pending');
      }

      // Create verification request
      const verificationRequest = await db.creator_verifications.create({
        creator_id: creatorId,
        verification_type,
        documents: JSON.stringify(documents),
        social_links: JSON.stringify(social_links),
        portfolio_links: JSON.stringify(portfolio_links),
        bio,
        additional_info,
        status: 'PENDING',
        submitted_at: new Date()
      });

      // Add to verification queue
      this.verificationQueue.set(verificationRequest.id, verificationRequest);

      // Emit verification submitted event
      if (this.socketIO) {
        this.socketIO.emit('verification_submitted', {
          creator_id: creatorId,
          verification_id: verificationRequest.id,
          verification_type
        });
      }

      console.log(`[CreatorToolsService] Verification request submitted for creator ${creatorId}`);
      return verificationRequest;
    } catch (error) {
      console.error('[CreatorToolsService] Submit verification request failed:', error);
      throw error;
    }
  }

  /**
   * Get creator verification status
   */
  async getVerificationStatus(creatorId) {
    try {
      const verification = await db.creator_verifications.findOne({
        where: { creator_id: creatorId },
        order: [['created_at', 'DESC']]
      });

      if (!verification) {
        return {
          is_verified: false,
          verification_status: 'NOT_SUBMITTED',
          verification_type: null,
          submitted_at: null,
          reviewed_at: null,
          rejection_reason: null
        };
      }

      return {
        is_verified: verification.status === 'APPROVED',
        verification_status: verification.status,
        verification_type: verification.verification_type,
        submitted_at: verification.submitted_at,
        reviewed_at: verification.reviewed_at,
        rejection_reason: verification.rejection_reason,
        verification_badge: verification.status === 'APPROVED' ? verification.verification_type : null
      };
    } catch (error) {
      console.error('[CreatorToolsService] Get verification status failed:', error);
      throw error;
    }
  }

  /**
   * Format collection summary
   */
  formatCollectionSummary(collection) {
    const nfts = collection.nfts || [];
    const totalSales = nfts.reduce((sum, nft) => {
      return sum + (nft.transactions?.filter(t => t.transaction_type === 'SALE').length || 0);
    }, 0);
    
    const totalVolume = nfts.reduce((sum, nft) => {
      return sum + (nft.transactions?.filter(t => t.transaction_type === 'SALE')
        .reduce((vol, t) => vol + parseFloat(t.price || 0), 0) || 0);
    }, 0);

    const activeListings = nfts.reduce((sum, nft) => {
      return sum + (nft.auctions?.filter(a => a.status === 'ACTIVE').length || 0);
    }, 0);

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      logo_image_url: collection.logo_image_url,
      blockchain: collection.blockchain,
      total_nfts: nfts.length,
      minted_nfts: nfts.filter(n => n.status === 'MINTED').length,
      total_sales: totalSales,
      total_volume: totalVolume,
      active_listings: activeListings,
      floor_price: collection.floor_price,
      royalty_percentage: collection.default_royalty_percentage,
      created_at: collection.created_at
    };
  }

  /**
   * Start analytics caching
   */
  startAnalyticsCaching() {
    // Cache analytics data every 15 minutes
    setInterval(async () => {
      try {
        // This would cache frequently accessed analytics data
        console.log('[CreatorToolsService] Refreshing analytics cache...');
      } catch (error) {
        console.error('[CreatorToolsService] Analytics caching error:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes
  }

  /**
   * Initialize royalty processors
   */
  initializeRoyaltyProcessors() {
    // Initialize processors for different blockchains
    const blockchains = ['ETH', 'BNB', 'AVAX', 'MATIC', 'XDC', 'SOL', 'XRP', 'XLM'];
    
    blockchains.forEach(blockchain => {
      this.royaltyProcessors.set(blockchain, {
        blockchain,
        isActive: true,
        lastProcessed: new Date(),
        pendingPayments: 0
      });
    });

    console.log(`[CreatorToolsService] Initialized ${blockchains.length} royalty processors`);
  }

  /**
   * Get time filter for analytics
   */
  getTimeFilter(period) {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = CreatorToolsService;

