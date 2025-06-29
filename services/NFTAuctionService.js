/**
 * NFT Auction Service
 * Handles English auctions, Dutch auctions, and fixed-price sales
 */

const db = require('../models');
const { Op } = require('sequelize');

class NFTAuctionService {
  constructor() {
    this.activeAuctions = new Map(); // Cache for active auctions
    this.auctionTimers = new Map(); // Timers for auction endings
    this.dutchAuctionTimers = new Map(); // Timers for Dutch auction price drops
    this.bidQueue = new Map(); // Queue for processing bids
    this.socketIO = null; // Will be set by the server
  }

  /**
   * Initialize the auction service
   */
  async initialize(socketIO = null) {
    try {
      this.socketIO = socketIO;
      
      // Load active auctions from database
      await this.loadActiveAuctions();
      
      // Start auction monitoring
      this.startAuctionMonitoring();
      
      console.log('[NFTAuctionService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[NFTAuctionService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new auction
   */
  async createAuction(auctionData) {
    try {
      const {
        nft_id,
        seller_id,
        auction_type,
        starting_price,
        reserve_price,
        buyout_price,
        currency,
        blockchain_currency,
        duration_hours,
        price_drop_interval,
        price_drop_amount,
        minimum_price,
        platform_fee_percentage,
        royalty_fee_percentage
      } = auctionData;

      // Validate NFT ownership
      const nft = await db.nfts.findByPk(nft_id);
      if (!nft) {
        throw new Error('NFT not found');
      }

      if (nft.current_owner_id !== seller_id) {
        throw new Error('User is not the owner of this NFT');
      }

      if (nft.status !== 'MINTED') {
        throw new Error('NFT is not minted');
      }

      // Check if NFT is already in an active auction
      const existingAuction = await db.NFTAuction.findOne({
        where: {
          nft_id,
          status: ['ACTIVE', 'DRAFT']
        }
      });

      if (existingAuction) {
        throw new Error('NFT is already in an active auction');
      }

      // Calculate start and end times
      const start_time = new Date();
      const end_time = new Date(start_time.getTime() + (duration_hours * 60 * 60 * 1000));

      // Create auction
      const auction = await db.NFTAuction.create({
        nft_id,
        seller_id,
        auction_type,
        starting_price,
        reserve_price,
        current_price: starting_price,
        buyout_price,
        currency,
        blockchain_currency,
        start_time,
        end_time,
        duration_hours,
        price_drop_interval,
        price_drop_amount,
        minimum_price,
        platform_fee_percentage: platform_fee_percentage || 2.5,
        royalty_fee_percentage: royalty_fee_percentage || nft.royalty_percentage || 0,
        status: 'ACTIVE'
      });

      // Add to active auctions cache
      this.activeAuctions.set(auction.id, auction);

      // Set up auction timer
      this.setupAuctionTimer(auction);

      // Set up Dutch auction price drop timer if applicable
      if (auction_type === 'DUTCH_AUCTION') {
        this.setupDutchAuctionTimer(auction);
      }

      // Emit auction created event
      if (this.socketIO) {
        this.socketIO.emit('auction_created', {
          auction_id: auction.id,
          nft_id,
          auction_type,
          starting_price,
          end_time
        });
      }

      console.log(`[NFTAuctionService] Auction created: ${auction.id} for NFT ${nft_id}`);
      return auction;
    } catch (error) {
      console.error('[NFTAuctionService] Auction creation failed:', error);
      throw error;
    }
  }

  /**
   * Place a bid on an auction
   */
  async placeBid(auctionId, bidderId, bidAmount, bidSignature = null) {
    try {
      // Get auction with lock to prevent race conditions
      const auction = await db.NFTAuction.findByPk(auctionId, {
        lock: true,
        include: [
          { model: db.nfts, as: 'nft' },
          { model: db.users, as: 'seller' }
        ]
      });

      if (!auction) {
        throw new Error('Auction not found');
      }

      // Validate auction status and timing
      this.validateAuctionForBidding(auction);

      // Validate bid amount
      this.validateBidAmount(auction, bidAmount);

      // Check if bidder is not the seller
      if (bidderId === auction.seller_id) {
        throw new Error('Seller cannot bid on their own auction');
      }

      // For Dutch auctions, handle instant purchase
      if (auction.auction_type === 'DUTCH_AUCTION') {
        return await this.handleDutchAuctionPurchase(auction, bidderId, bidAmount);
      }

      // For fixed price sales, handle instant purchase
      if (auction.auction_type === 'FIXED_PRICE') {
        if (bidAmount !== auction.current_price) {
          throw new Error('Bid amount must equal the fixed price');
        }
        return await this.handleFixedPricePurchase(auction, bidderId, bidAmount);
      }

      // For English auctions, handle bidding
      return await this.handleEnglishAuctionBid(auction, bidderId, bidAmount, bidSignature);
    } catch (error) {
      console.error('[NFTAuctionService] Bid placement failed:', error);
      throw error;
    }
  }

  /**
   * Handle English auction bidding
   */
  async handleEnglishAuctionBid(auction, bidderId, bidAmount, bidSignature) {
    try {
      // Create bid record
      const bid = await db.nft_bids.create({
        auction_id: auction.id,
        bidder_id: bidderId,
        bid_amount: bidAmount,
        currency: auction.currency,
        status: 'ACTIVE',
        bid_signature: bidSignature
      });

      // Update previous highest bid status
      if (auction.highest_bidder_id) {
        await db.nft_bids.update(
          { status: 'OUTBID' },
          {
            where: {
              auction_id: auction.id,
              bidder_id: auction.highest_bidder_id,
              status: 'ACTIVE'
            }
          }
        );
      }

      // Update auction with new highest bid
      await auction.update({
        highest_bidder_id: bidderId,
        highest_bid_amount: bidAmount,
        total_bids: auction.total_bids + 1
      });

      // Handle auto-extension
      if (auction.auto_extend_enabled) {
        const timeLeft = auction.end_time.getTime() - Date.now();
        const extendThreshold = auction.extend_time_minutes * 60 * 1000;
        
        if (timeLeft < extendThreshold) {
          const newEndTime = new Date(Date.now() + extendThreshold);
          await auction.update({ end_time: newEndTime });
          
          // Update timer
          this.setupAuctionTimer(auction);
          
          // Emit extension event
          if (this.socketIO) {
            this.socketIO.emit('auction_extended', {
              auction_id: auction.id,
              new_end_time: newEndTime,
              extended_by_minutes: auction.extend_time_minutes
            });
          }
        }
      }

      // Update cache
      this.activeAuctions.set(auction.id, auction);

      // Emit bid placed event
      if (this.socketIO) {
        this.socketIO.emit('bid_placed', {
          auction_id: auction.id,
          bid_id: bid.id,
          bidder_id: bidderId,
          bid_amount: bidAmount,
          currency: auction.currency,
          total_bids: auction.total_bids
        });
      }

      console.log(`[NFTAuctionService] Bid placed: ${bidAmount} ${auction.currency} on auction ${auction.id}`);
      return {
        bid,
        auction,
        isWinning: true
      };
    } catch (error) {
      console.error('[NFTAuctionService] English auction bid failed:', error);
      throw error;
    }
  }

  /**
   * Handle Dutch auction purchase
   */
  async handleDutchAuctionPurchase(auction, buyerId, bidAmount) {
    try {
      // Verify bid amount matches current price
      if (bidAmount < auction.current_price) {
        throw new Error('Bid amount is below current Dutch auction price');
      }

      // Create winning bid
      const bid = await db.nft_bids.create({
        auction_id: auction.id,
        bidder_id: buyerId,
        bid_amount: auction.current_price,
        currency: auction.currency,
        status: 'WON'
      });

      // Complete the auction
      await this.completeAuction(auction.id, buyerId, auction.current_price);

      console.log(`[NFTAuctionService] Dutch auction purchase: ${auction.current_price} ${auction.currency}`);
      return {
        bid,
        auction,
        isWinning: true,
        completed: true
      };
    } catch (error) {
      console.error('[NFTAuctionService] Dutch auction purchase failed:', error);
      throw error;
    }
  }

  /**
   * Handle fixed price purchase
   */
  async handleFixedPricePurchase(auction, buyerId, bidAmount) {
    try {
      // Create winning bid
      const bid = await db.nft_bids.create({
        auction_id: auction.id,
        bidder_id: buyerId,
        bid_amount: bidAmount,
        currency: auction.currency,
        status: 'WON'
      });

      // Complete the auction
      await this.completeAuction(auction.id, buyerId, bidAmount);

      console.log(`[NFTAuctionService] Fixed price purchase: ${bidAmount} ${auction.currency}`);
      return {
        bid,
        auction,
        isWinning: true,
        completed: true
      };
    } catch (error) {
      console.error('[NFTAuctionService] Fixed price purchase failed:', error);
      throw error;
    }
  }

  /**
   * Complete an auction
   */
  async completeAuction(auctionId, winnerId, finalPrice) {
    try {
      const auction = await db.NFTAuction.findByPk(auctionId, {
        include: [{ model: db.nfts, as: 'nft' }]
      });

      if (!auction) {
        throw new Error('Auction not found');
      }

      // Update auction status
      await auction.update({
        status: 'SOLD',
        buyer_id: winnerId,
        final_sale_price: finalPrice,
        sale_timestamp: new Date()
      });

      // Transfer NFT ownership
      await auction.nft.update({
        current_owner_id: winnerId
      });

      // Create transaction record
      await db.nft_transactions.create({
        nft_id: auction.nft_id,
        transaction_type: 'SALE',
        from_user_id: auction.seller_id,
        to_user_id: winnerId,
        blockchain: auction.nft.blockchain,
        price: finalPrice,
        currency: auction.currency,
        platform_fee: (finalPrice * auction.platform_fee_percentage) / 100,
        royalty_fee: (finalPrice * auction.royalty_fee_percentage) / 100,
        auction_id: auction.id,
        status: 'CONFIRMED'
      });

      // Process royalty payments
      await this.processRoyaltyPayments(auction, finalPrice);

      // Remove from active auctions
      this.activeAuctions.delete(auctionId);
      
      // Clear timers
      if (this.auctionTimers.has(auctionId)) {
        clearTimeout(this.auctionTimers.get(auctionId));
        this.auctionTimers.delete(auctionId);
      }
      
      if (this.dutchAuctionTimers.has(auctionId)) {
        clearInterval(this.dutchAuctionTimers.get(auctionId));
        this.dutchAuctionTimers.delete(auctionId);
      }

      // Emit auction completed event
      if (this.socketIO) {
        this.socketIO.emit('auction_completed', {
          auction_id: auctionId,
          winner_id: winnerId,
          final_price: finalPrice,
          currency: auction.currency
        });
      }

      console.log(`[NFTAuctionService] Auction completed: ${auctionId} sold for ${finalPrice} ${auction.currency}`);
      return auction;
    } catch (error) {
      console.error('[NFTAuctionService] Auction completion failed:', error);
      throw error;
    }
  }

  /**
   * Cancel an auction
   */
  async cancelAuction(auctionId, userId) {
    try {
      const auction = await db.NFTAuction.findByPk(auctionId);
      
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.seller_id !== userId) {
        throw new Error('Only the seller can cancel the auction');
      }

      if (auction.status !== 'ACTIVE') {
        throw new Error('Auction is not active');
      }

      if (auction.total_bids > 0) {
        throw new Error('Cannot cancel auction with existing bids');
      }

      // Update auction status
      await auction.update({ status: 'CANCELLED' });

      // Remove from active auctions
      this.activeAuctions.delete(auctionId);
      
      // Clear timers
      if (this.auctionTimers.has(auctionId)) {
        clearTimeout(this.auctionTimers.get(auctionId));
        this.auctionTimers.delete(auctionId);
      }
      
      if (this.dutchAuctionTimers.has(auctionId)) {
        clearInterval(this.dutchAuctionTimers.get(auctionId));
        this.dutchAuctionTimers.delete(auctionId);
      }

      // Emit auction cancelled event
      if (this.socketIO) {
        this.socketIO.emit('auction_cancelled', {
          auction_id: auctionId
        });
      }

      console.log(`[NFTAuctionService] Auction cancelled: ${auctionId}`);
      return auction;
    } catch (error) {
      console.error('[NFTAuctionService] Auction cancellation failed:', error);
      throw error;
    }
  }

  /**
   * Get auction details with bids
   */
  async getAuctionDetails(auctionId) {
    try {
      const auction = await db.NFTAuction.findByPk(auctionId, {
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
          { model: db.users, as: 'highest_bidder' },
          { model: db.users, as: 'buyer' },
          {
            model: db.nft_bids,
            as: 'bids',
            include: [{ model: db.users, as: 'bidder' }],
            order: [['bid_timestamp', 'DESC']]
          }
        ]
      });

      if (!auction) {
        throw new Error('Auction not found');
      }

      // Calculate time remaining
      const now = new Date();
      const timeRemaining = auction.end_time.getTime() - now.getTime();
      const isActive = auction.status === 'ACTIVE' && timeRemaining > 0;

      return {
        ...auction.toJSON(),
        time_remaining: Math.max(0, timeRemaining),
        is_active: isActive,
        has_ended: timeRemaining <= 0,
        current_price_usd: await this.convertToUSD(auction.current_price, auction.currency)
      };
    } catch (error) {
      console.error('[NFTAuctionService] Get auction details failed:', error);
      throw error;
    }
  }

  /**
   * Get active auctions with filters
   */
  async getActiveAuctions(filters = {}) {
    try {
      const {
        auction_type,
        blockchain,
        category_id,
        min_price,
        max_price,
        currency,
        sort_by = 'created_at',
        sort_order = 'DESC',
        limit = 20,
        offset = 0
      } = filters;

      const whereClause = {
        status: 'ACTIVE',
        end_time: {
          [Op.gt]: new Date()
        }
      };

      if (auction_type) {
        whereClause.auction_type = auction_type;
      }

      if (min_price || max_price) {
        whereClause.current_price = {};
        if (min_price) whereClause.current_price[Op.gte] = min_price;
        if (max_price) whereClause.current_price[Op.lte] = max_price;
      }

      if (currency) {
        whereClause.currency = currency;
      }

      const includeClause = [
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
      ];

      // Add blockchain filter through NFT
      if (blockchain) {
        includeClause[0].where = { blockchain };
      }

      // Add category filter through collection
      if (category_id) {
        includeClause[0].include[0].where = { category_id };
      }

      const auctions = await db.NFTAuction.findAndCountAll({
        where: whereClause,
        include: includeClause,
        order: [[sort_by, sort_order]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Add time remaining and USD prices
      const auctionsWithExtras = await Promise.all(
        auctions.rows.map(async (auction) => {
          const now = new Date();
          const timeRemaining = auction.end_time.getTime() - now.getTime();
          
          return {
            ...auction.toJSON(),
            time_remaining: Math.max(0, timeRemaining),
            current_price_usd: await this.convertToUSD(auction.current_price, auction.currency)
          };
        })
      );

      return {
        auctions: auctionsWithExtras,
        total: auctions.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } catch (error) {
      console.error('[NFTAuctionService] Get active auctions failed:', error);
      throw error;
    }
  }

  /**
   * Validate auction for bidding
   */
  validateAuctionForBidding(auction) {
    if (auction.status !== 'ACTIVE') {
      throw new Error('Auction is not active');
    }

    const now = new Date();
    if (now < auction.start_time) {
      throw new Error('Auction has not started yet');
    }

    if (now > auction.end_time) {
      throw new Error('Auction has ended');
    }
  }

  /**
   * Validate bid amount
   */
  validateBidAmount(auction, bidAmount) {
    if (bidAmount <= 0) {
      throw new Error('Bid amount must be positive');
    }

    if (auction.auction_type === 'ENGLISH_AUCTION') {
      const minimumBid = auction.highest_bid_amount 
        ? auction.highest_bid_amount * 1.05 // 5% minimum increase
        : auction.starting_price;

      if (bidAmount < minimumBid) {
        throw new Error(`Bid must be at least ${minimumBid} ${auction.currency}`);
      }

      if (auction.reserve_price && bidAmount < auction.reserve_price) {
        throw new Error(`Bid must meet reserve price of ${auction.reserve_price} ${auction.currency}`);
      }
    }

    if (auction.auction_type === 'DUTCH_AUCTION') {
      if (bidAmount < auction.current_price) {
        throw new Error(`Bid must be at least current price of ${auction.current_price} ${auction.currency}`);
      }
    }

    if (auction.auction_type === 'FIXED_PRICE') {
      if (bidAmount !== auction.current_price) {
        throw new Error(`Bid must equal fixed price of ${auction.current_price} ${auction.currency}`);
      }
    }
  }

  /**
   * Load active auctions from database
   */
  async loadActiveAuctions() {
    try {
      const activeAuctions = await db.NFTAuction.findAll({
        where: {
          status: 'ACTIVE',
          end_time: {
            [Op.gt]: new Date()
          }
        }
      });

      for (const auction of activeAuctions) {
        this.activeAuctions.set(auction.id, auction);
        this.setupAuctionTimer(auction);
        
        if (auction.auction_type === 'DUTCH_AUCTION') {
          this.setupDutchAuctionTimer(auction);
        }
      }

      console.log(`[NFTAuctionService] Loaded ${activeAuctions.length} active auctions`);
    } catch (error) {
      console.error('[NFTAuctionService] Load active auctions failed:', error);
      throw error;
    }
  }

  /**
   * Setup auction timer for automatic ending
   */
  setupAuctionTimer(auction) {
    const timeUntilEnd = auction.end_time.getTime() - Date.now();
    
    if (timeUntilEnd > 0) {
      // Clear existing timer
      if (this.auctionTimers.has(auction.id)) {
        clearTimeout(this.auctionTimers.get(auction.id));
      }

      const timer = setTimeout(async () => {
        await this.endAuction(auction.id);
      }, timeUntilEnd);

      this.auctionTimers.set(auction.id, timer);
    }
  }

  /**
   * Setup Dutch auction price drop timer
   */
  setupDutchAuctionTimer(auction) {
    if (!auction.price_drop_interval || !auction.price_drop_amount) {
      return;
    }

    // Clear existing timer
    if (this.dutchAuctionTimers.has(auction.id)) {
      clearInterval(this.dutchAuctionTimers.get(auction.id));
    }

    const interval = setInterval(async () => {
      await this.dropDutchAuctionPrice(auction.id);
    }, auction.price_drop_interval * 60 * 1000); // Convert minutes to milliseconds

    this.dutchAuctionTimers.set(auction.id, interval);
  }

  /**
   * Drop Dutch auction price
   */
  async dropDutchAuctionPrice(auctionId) {
    try {
      const auction = await db.NFTAuction.findByPk(auctionId);
      
      if (!auction || auction.status !== 'ACTIVE') {
        // Clear timer if auction is no longer active
        if (this.dutchAuctionTimers.has(auctionId)) {
          clearInterval(this.dutchAuctionTimers.get(auctionId));
          this.dutchAuctionTimers.delete(auctionId);
        }
        return;
      }

      const newPrice = Math.max(
        auction.current_price - auction.price_drop_amount,
        auction.minimum_price
      );

      if (newPrice !== auction.current_price) {
        await auction.update({ current_price: newPrice });
        this.activeAuctions.set(auctionId, auction);

        // Emit price drop event
        if (this.socketIO) {
          this.socketIO.emit('dutch_auction_price_drop', {
            auction_id: auctionId,
            new_price: newPrice,
            currency: auction.currency
          });
        }

        console.log(`[NFTAuctionService] Dutch auction price dropped: ${auctionId} -> ${newPrice} ${auction.currency}`);
      }

      // If minimum price reached, stop price drops
      if (newPrice === auction.minimum_price) {
        if (this.dutchAuctionTimers.has(auctionId)) {
          clearInterval(this.dutchAuctionTimers.get(auctionId));
          this.dutchAuctionTimers.delete(auctionId);
        }
      }
    } catch (error) {
      console.error('[NFTAuctionService] Dutch auction price drop failed:', error);
    }
  }

  /**
   * End an auction automatically
   */
  async endAuction(auctionId) {
    try {
      const auction = await db.NFTAuction.findByPk(auctionId);
      
      if (!auction || auction.status !== 'ACTIVE') {
        return;
      }

      if (auction.highest_bidder_id && auction.highest_bid_amount) {
        // Complete auction with winning bid
        await this.completeAuction(auctionId, auction.highest_bidder_id, auction.highest_bid_amount);
      } else {
        // End auction without sale
        await auction.update({ status: 'EXPIRED' });
        this.activeAuctions.delete(auctionId);

        // Emit auction expired event
        if (this.socketIO) {
          this.socketIO.emit('auction_expired', {
            auction_id: auctionId
          });
        }

        console.log(`[NFTAuctionService] Auction expired: ${auctionId}`);
      }

      // Clear timers
      if (this.auctionTimers.has(auctionId)) {
        clearTimeout(this.auctionTimers.get(auctionId));
        this.auctionTimers.delete(auctionId);
      }
      
      if (this.dutchAuctionTimers.has(auctionId)) {
        clearInterval(this.dutchAuctionTimers.get(auctionId));
        this.dutchAuctionTimers.delete(auctionId);
      }
    } catch (error) {
      console.error('[NFTAuctionService] End auction failed:', error);
    }
  }

  /**
   * Process royalty payments
   */
  async processRoyaltyPayments(auction, salePrice) {
    try {
      const nft = await db.nfts.findByPk(auction.nft_id, {
        include: [{ model: db.nft_collections, as: 'collection' }]
      });

      if (!nft || !nft.royalty_percentage || nft.royalty_percentage === 0) {
        return;
      }

      const royaltyAmount = (salePrice * nft.royalty_percentage) / 100;
      const recipients = nft.royalty_recipients || [];

      if (recipients.length === 0) {
        // Default to creator
        recipients.push({
          user_id: nft.creator_id,
          address: 'creator_default',
          percentage: 100
        });
      }

      // Create royalty records for each recipient
      for (const recipient of recipients) {
        const recipientAmount = (royaltyAmount * recipient.percentage) / 100;
        
        await db.nft_royalties.create({
          nft_id: nft.id,
          collection_id: nft.collection_id,
          transaction_id: null, // Will be set when transaction is created
          recipient_id: recipient.user_id,
          recipient_address: recipient.address,
          royalty_percentage: nft.royalty_percentage,
          sale_price: salePrice,
          royalty_amount: recipientAmount,
          currency: auction.currency,
          blockchain: nft.blockchain,
          split_percentage: recipient.percentage,
          payment_status: 'PENDING'
        });
      }

      console.log(`[NFTAuctionService] Royalty payments processed: ${royaltyAmount} ${auction.currency}`);
    } catch (error) {
      console.error('[NFTAuctionService] Royalty payment processing failed:', error);
    }
  }

  /**
   * Convert price to USD (placeholder)
   */
  async convertToUSD(amount, currency) {
    // This would integrate with real price APIs
    const exchangeRates = {
      'USD': 1,
      'ETH': 2000,
      'BNB': 300,
      'AVAX': 25,
      'MATIC': 0.8,
      'XRP': 0.5,
      'XLM': 0.1,
      'SOL': 20,
      'XDC': 0.05
    };

    return amount * (exchangeRates[currency] || 1);
  }

  /**
   * Start auction monitoring
   */
  startAuctionMonitoring() {
    // Monitor for expired auctions every minute
    setInterval(async () => {
      try {
        const expiredAuctions = await db.NFTAuction.findAll({
          where: {
            status: 'ACTIVE',
            end_time: {
              [Op.lt]: new Date()
            }
          }
        });

        for (const auction of expiredAuctions) {
          await this.endAuction(auction.id);
        }
      } catch (error) {
        console.error('[NFTAuctionService] Auction monitoring error:', error);
      }
    }, 60000); // 1 minute
  }

  /**
   * Get auction statistics
   */
  async getAuctionStatistics(filters = {}) {
    try {
      const { blockchain, auction_type, time_period = '7d' } = filters;
      
      const timeFilter = this.getTimeFilter(time_period);
      const whereClause = {
        created_at: {
          [Op.gte]: timeFilter
        }
      };

      if (blockchain) {
        whereClause['$nft.blockchain$'] = blockchain;
      }

      if (auction_type) {
        whereClause.auction_type = auction_type;
      }

      const stats = await db.NFTAuction.findAll({
        where: whereClause,
        include: [{ model: db.nfts, as: 'nft' }],
        attributes: [
          'status',
          'auction_type',
          [db.sequelize.fn('COUNT', db.sequelize.col('NFTAuctions.id')), 'count'],
          [db.sequelize.fn('AVG', db.sequelize.col('final_sale_price')), 'avg_price'],
          [db.sequelize.fn('SUM', db.sequelize.col('final_sale_price')), 'total_volume']
        ],
        group: ['status', 'auction_type'],
        raw: true
      });

      return {
        statistics: stats,
        time_period,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[NFTAuctionService] Get statistics failed:', error);
      throw error;
    }
  }

  /**
   * Get time filter for statistics
   */
  getTimeFilter(period) {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = NFTAuctionService;

