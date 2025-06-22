/**
 * Order Book Manager for DBX Trading Engine
 * Manages multiple order books across different trading pairs and chains
 * Provides centralized order management and coordination
 */

const EventEmitter = require('events');
const { OrderBook, ORDER_TYPES, TIME_IN_FORCE, ORDER_SIDES, ORDER_STATUS } = require('./OrderBook');

/**
 * Trading Pair Class
 * Represents a trading pair with base and quote assets
 */
class TradingPair {
  constructor(baseAsset, quoteAsset, chainId, tickSize = 0.00000001, lotSize = 0.00000001) {
    this.baseAsset = baseAsset;
    this.quoteAsset = quoteAsset;
    this.chainId = chainId;
    this.symbol = `${baseAsset}/${quoteAsset}`;
    this.tickSize = tickSize; // Minimum price increment
    this.lotSize = lotSize;   // Minimum quantity increment
    this.isActive = true;
    this.minOrderValue = 0.001; // Minimum order value in quote asset
    this.maxOrderValue = 1000000; // Maximum order value in quote asset
    this.createdAt = Date.now();
  }

  validatePrice(price) {
    return price > 0 && (price % this.tickSize) === 0;
  }

  validateQuantity(quantity) {
    return quantity > 0 && (quantity % this.lotSize) === 0;
  }

  validateOrderValue(price, quantity) {
    const orderValue = price * quantity;
    return orderValue >= this.minOrderValue && orderValue <= this.maxOrderValue;
  }

  roundPrice(price) {
    return Math.round(price / this.tickSize) * this.tickSize;
  }

  roundQuantity(quantity) {
    return Math.round(quantity / this.lotSize) * this.lotSize;
  }

  toJSON() {
    return {
      baseAsset: this.baseAsset,
      quoteAsset: this.quoteAsset,
      chainId: this.chainId,
      symbol: this.symbol,
      tickSize: this.tickSize,
      lotSize: this.lotSize,
      isActive: this.isActive,
      minOrderValue: this.minOrderValue,
      maxOrderValue: this.maxOrderValue,
      createdAt: this.createdAt
    };
  }
}

/**
 * Order Book Manager
 * Central management system for all order books and trading pairs
 */
class OrderBookManager extends EventEmitter {
  constructor() {
    super();
    this.orderBooks = new Map(); // symbol -> OrderBook
    this.tradingPairs = new Map(); // symbol -> TradingPair
    this.userBalances = new Map(); // userId -> { chainId -> { asset -> balance } }
    this.orderHistory = new Map(); // orderId -> order
    this.tradeHistory = []; // Array of all trades
    this.dailyStats = new Map(); // symbol -> daily statistics
    this.isInitialized = false;
  }

  /**
   * Initialize the order book manager
   */
  async initialize() {
    try {
      console.log('[OrderBookManager] Initializing order book manager...');
      
      // Initialize default trading pairs for each supported chain
      await this.initializeDefaultTradingPairs();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('[OrderBookManager] Order book manager initialized successfully');
      
      this.emit('initialized');
      return true;
      
    } catch (error) {
      console.error('[OrderBookManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Initialize default trading pairs for supported chains
   */
  async initializeDefaultTradingPairs() {
    const defaultPairs = [
      // Ethereum pairs
      { base: 'ETH', quote: 'USDT', chainId: 'ETHEREUM' },
      { base: 'ETH', quote: 'USDC', chainId: 'ETHEREUM' },
      { base: 'WBTC', quote: 'ETH', chainId: 'ETHEREUM' },
      
      // XDC pairs
      { base: 'XDC', quote: 'USDT', chainId: 'XDC' },
      { base: 'XDC', quote: 'USDC', chainId: 'XDC' },
      
      // Avalanche pairs
      { base: 'AVAX', quote: 'USDT', chainId: 'AVALANCHE' },
      { base: 'AVAX', quote: 'USDC', chainId: 'AVALANCHE' },
      
      // Polygon pairs
      { base: 'MATIC', quote: 'USDT', chainId: 'POLYGON' },
      { base: 'MATIC', quote: 'USDC', chainId: 'POLYGON' },
      
      // BSC pairs
      { base: 'BNB', quote: 'USDT', chainId: 'BSC' },
      { base: 'BNB', quote: 'USDC', chainId: 'BSC' },
      
      // Solana pairs
      { base: 'SOL', quote: 'USDT', chainId: 'SOLANA' },
      { base: 'SOL', quote: 'USDC', chainId: 'SOLANA' },
      
      // Stellar pairs
      { base: 'XLM', quote: 'USDT', chainId: 'STELLAR' },
      { base: 'XLM', quote: 'USDC', chainId: 'STELLAR' },
      
      // XRP pairs
      { base: 'XRP', quote: 'USDT', chainId: 'XRP' },
      { base: 'XRP', quote: 'USDC', chainId: 'XRP' }
    ];

    for (const pairConfig of defaultPairs) {
      await this.createTradingPair(
        pairConfig.base,
        pairConfig.quote,
        pairConfig.chainId
      );
    }
  }

  /**
   * Create a new trading pair and order book
   */
  async createTradingPair(baseAsset, quoteAsset, chainId, config = {}) {
    try {
      const tradingPair = new TradingPair(
        baseAsset,
        quoteAsset,
        chainId,
        config.tickSize,
        config.lotSize
      );

      const symbol = tradingPair.symbol;
      
      if (this.tradingPairs.has(symbol)) {
        throw new Error(`Trading pair ${symbol} already exists`);
      }

      // Create order book for this pair
      const orderBook = new OrderBook(symbol, chainId);
      
      // Set up order book event listeners
      this.setupOrderBookListeners(orderBook);
      
      // Store trading pair and order book
      this.tradingPairs.set(symbol, tradingPair);
      this.orderBooks.set(symbol, orderBook);
      
      // Initialize daily stats
      this.dailyStats.set(symbol, {
        volume: 0,
        high: 0,
        low: Infinity,
        open: 0,
        close: 0,
        trades: 0,
        priceChange: 0,
        priceChangePercent: 0
      });

      console.log(`[OrderBookManager] Created trading pair: ${symbol} on ${chainId}`);
      this.emit('tradingPairCreated', tradingPair.toJSON());
      
      return tradingPair;
      
    } catch (error) {
      console.error('[OrderBookManager] Error creating trading pair:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for order book events
   */
  setupOrderBookListeners(orderBook) {
    orderBook.on('orderAdded', (order) => {
      this.emit('orderAdded', order);
    });

    orderBook.on('orderCancelled', (order) => {
      this.emit('orderCancelled', order);
    });

    orderBook.on('orderExecuted', (order) => {
      this.emit('orderExecuted', order);
    });

    orderBook.on('trade', (trade) => {
      this.tradeHistory.push(trade);
      this.updateDailyStats(trade);
      this.emit('trade', trade);
    });

    orderBook.on('bookUpdated', (snapshot) => {
      this.emit('bookUpdated', snapshot);
    });
  }

  /**
   * Set up global event listeners
   */
  setupEventListeners() {
    // Clean up old trade history periodically
    setInterval(() => {
      this.cleanupOldTrades();
    }, 60000); // Every minute

    // Update daily stats reset
    setInterval(() => {
      this.resetDailyStats();
    }, 86400000); // Every 24 hours
  }

  /**
   * Place a new order
   */
  async placeOrder(orderData) {
    try {
      if (!this.isInitialized) {
        throw new Error('Order book manager not initialized');
      }

      const { symbol } = orderData;
      const orderBook = this.orderBooks.get(symbol);
      const tradingPair = this.tradingPairs.get(symbol);

      if (!orderBook || !tradingPair) {
        throw new Error(`Trading pair ${symbol} not found`);
      }

      if (!tradingPair.isActive) {
        throw new Error(`Trading pair ${symbol} is not active`);
      }

      // Validate trading pair constraints
      if (orderData.type === ORDER_TYPES.LIMIT) {
        if (!tradingPair.validatePrice(orderData.price)) {
          orderData.price = tradingPair.roundPrice(orderData.price);
        }
      }

      if (!tradingPair.validateQuantity(orderData.quantity)) {
        orderData.quantity = tradingPair.roundQuantity(orderData.quantity);
      }

      // Check user balance
      const balanceCheck = await this.checkUserBalance(orderData);
      if (!balanceCheck.success) {
        throw new Error(balanceCheck.reason);
      }

      // Place order in the order book
      const result = await orderBook.addOrder(orderData);
      
      if (result.success) {
        // Store order in history
        this.orderHistory.set(result.order.id, result.order);
        
        // Reserve user balance
        await this.reserveUserBalance(orderData);
      }

      return result;

    } catch (error) {
      console.error('[OrderBookManager] Error placing order:', error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId, userId) {
    try {
      const order = this.orderHistory.get(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      const orderBook = this.orderBooks.get(order.symbol);
      if (!orderBook) {
        throw new Error('Order book not found');
      }

      const result = await orderBook.cancelOrder(orderId, userId);
      
      if (result.success) {
        // Release reserved balance
        await this.releaseUserBalance(order);
      }

      return result;

    } catch (error) {
      console.error('[OrderBookManager] Error cancelling order:', error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Get order book snapshot for a symbol
   */
  getOrderBook(symbol, depth = 10) {
    const orderBook = this.orderBooks.get(symbol);
    if (!orderBook) {
      throw new Error(`Order book for ${symbol} not found`);
    }
    return orderBook.getBookSnapshot(depth);
  }

  /**
   * Get all trading pairs
   */
  getTradingPairs() {
    return Array.from(this.tradingPairs.values()).map(pair => pair.toJSON());
  }

  /**
   * Get user orders
   */
  getUserOrders(userId, symbol = null) {
    if (symbol) {
      const orderBook = this.orderBooks.get(symbol);
      return orderBook ? orderBook.getUserOrders(userId) : [];
    }

    // Get orders from all order books
    const allOrders = [];
    for (const orderBook of this.orderBooks.values()) {
      allOrders.push(...orderBook.getUserOrders(userId));
    }
    return allOrders;
  }

  /**
   * Get trade history
   */
  getTradeHistory(symbol = null, limit = 100) {
    let trades = this.tradeHistory;
    
    if (symbol) {
      trades = trades.filter(trade => trade.symbol === symbol);
    }
    
    return trades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get user trade history
   */
  getUserTradeHistory(userId, symbol = null, limit = 100) {
    let trades = this.tradeHistory.filter(trade => 
      trade.takerUserId === userId || trade.makerUserId === userId
    );
    
    if (symbol) {
      trades = trades.filter(trade => trade.symbol === symbol);
    }
    
    return trades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get market statistics
   */
  getMarketStats(symbol = null) {
    if (symbol) {
      const stats = this.dailyStats.get(symbol);
      const orderBook = this.orderBooks.get(symbol);
      const bestBidAsk = orderBook ? orderBook.getBestBidAsk() : null;
      
      return {
        symbol,
        ...stats,
        ...bestBidAsk,
        timestamp: Date.now()
      };
    }

    // Get stats for all symbols
    const allStats = {};
    for (const [symbol, stats] of this.dailyStats.entries()) {
      const orderBook = this.orderBooks.get(symbol);
      const bestBidAsk = orderBook ? orderBook.getBestBidAsk() : null;
      
      allStats[symbol] = {
        symbol,
        ...stats,
        ...bestBidAsk,
        timestamp: Date.now()
      };
    }
    
    return allStats;
  }

  /**
   * Check user balance for order placement
   */
  async checkUserBalance(orderData) {
    // This would integrate with the wallet service to check actual balances
    // For now, we'll assume sufficient balance
    return { success: true };
  }

  /**
   * Reserve user balance for order
   */
  async reserveUserBalance(orderData) {
    // This would integrate with the wallet service to reserve balance
    // Implementation would depend on the wallet service architecture
    return true;
  }

  /**
   * Release reserved user balance
   */
  async releaseUserBalance(order) {
    // This would integrate with the wallet service to release reserved balance
    // Implementation would depend on the wallet service architecture
    return true;
  }

  /**
   * Update daily statistics
   */
  updateDailyStats(trade) {
    const stats = this.dailyStats.get(trade.symbol);
    if (!stats) return;

    stats.volume += trade.quantity;
    stats.high = Math.max(stats.high, trade.price);
    stats.low = Math.min(stats.low, trade.price);
    stats.close = trade.price;
    stats.trades += 1;

    if (stats.open === 0) {
      stats.open = trade.price;
    }

    // Calculate price change
    if (stats.open > 0) {
      stats.priceChange = stats.close - stats.open;
      stats.priceChangePercent = (stats.priceChange / stats.open) * 100;
    }
  }

  /**
   * Reset daily statistics (called daily)
   */
  resetDailyStats() {
    const now = new Date();
    const isNewDay = now.getHours() === 0 && now.getMinutes() === 0;
    
    if (isNewDay) {
      for (const [symbol, stats] of this.dailyStats.entries()) {
        const previousClose = stats.close;
        this.dailyStats.set(symbol, {
          volume: 0,
          high: 0,
          low: Infinity,
          open: previousClose,
          close: previousClose,
          trades: 0,
          priceChange: 0,
          priceChangePercent: 0
        });
      }
      console.log('[OrderBookManager] Daily stats reset');
    }
  }

  /**
   * Clean up old trade history
   */
  cleanupOldTrades() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = Date.now() - maxAge;
    
    this.tradeHistory = this.tradeHistory.filter(trade => trade.timestamp > cutoff);
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      tradingPairs: this.tradingPairs.size,
      orderBooks: this.orderBooks.size,
      totalOrders: Array.from(this.orderBooks.values()).reduce((sum, book) => sum + book.orders.size, 0),
      totalTrades: this.tradeHistory.length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * Emergency stop all trading
   */
  emergencyStop() {
    console.log('[OrderBookManager] EMERGENCY STOP - Halting all trading');
    
    for (const tradingPair of this.tradingPairs.values()) {
      tradingPair.isActive = false;
    }
    
    this.emit('emergencyStop');
  }

  /**
   * Resume trading
   */
  resumeTrading() {
    console.log('[OrderBookManager] Resuming trading');
    
    for (const tradingPair of this.tradingPairs.values()) {
      tradingPair.isActive = true;
    }
    
    this.emit('tradingResumed');
  }
}

module.exports = {
  OrderBookManager,
  TradingPair
};

