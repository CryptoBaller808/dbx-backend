/**
 * Cross-Chain Arbitrage & Liquidity Management System for DBX Trading Platform
 * Detects price disparities across multiple chains and external exchanges
 * Provides automated arbitrage opportunities and liquidity optimization
 */

const EventEmitter = require('events');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Arbitrage Opportunity
 */
class ArbitrageOpportunity {
  constructor(data) {
    this.id = uuidv4();
    this.symbol = data.symbol;
    this.buyExchange = data.buyExchange;
    this.sellExchange = data.sellExchange;
    this.buyPrice = data.buyPrice;
    this.sellPrice = data.sellPrice;
    this.profit = data.sellPrice - data.buyPrice;
    this.profitPercentage = ((data.sellPrice - data.buyPrice) / data.buyPrice) * 100;
    this.volume = data.volume;
    this.estimatedProfit = this.profit * data.volume;
    this.timestamp = Date.now();
    this.status = 'DETECTED';
    this.executionTime = null;
    this.actualProfit = null;
  }

  isViable(minProfitPercentage = 0.1, minVolume = 100) {
    return this.profitPercentage >= minProfitPercentage && this.volume >= minVolume;
  }

  toJSON() {
    return {
      id: this.id,
      symbol: this.symbol,
      buyExchange: this.buyExchange,
      sellExchange: this.sellExchange,
      buyPrice: this.buyPrice,
      sellPrice: this.sellPrice,
      profit: this.profit,
      profitPercentage: this.profitPercentage,
      volume: this.volume,
      estimatedProfit: this.estimatedProfit,
      timestamp: this.timestamp,
      status: this.status,
      executionTime: this.executionTime,
      actualProfit: this.actualProfit
    };
  }
}

/**
 * External Exchange API Integrations
 */
class ExternalExchangeManager {
  constructor() {
    this.exchanges = new Map();
    this.rateLimits = new Map();
    this.lastRequests = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize external exchange connections
   */
  async initialize() {
    try {
      console.log('[ExternalExchangeManager] Initializing external exchange connections...');

      // Initialize Binance API
      await this.initializeBinance();

      // Initialize Uniswap API
      await this.initializeUniswap();

      // Initialize XSwap API (placeholder)
      await this.initializeXSwap();

      // Initialize other DEX APIs
      await this.initializePancakeSwap();
      await this.initializeQuickSwap();

      this.isInitialized = true;
      console.log('[ExternalExchangeManager] External exchanges initialized successfully');

      return true;

    } catch (error) {
      console.error('[ExternalExchangeManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Initialize Binance API connection
   */
  async initializeBinance() {
    const binanceConfig = {
      name: 'Binance',
      baseUrl: 'https://api.binance.com/api/v3',
      rateLimit: 1200, // requests per minute
      endpoints: {
        ticker: '/ticker/24hr',
        orderBook: '/depth',
        trades: '/trades'
      },
      symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'AVAXUSDT', 'MATICUSDT', 'BNBUSDT']
    };

    this.exchanges.set('binance', binanceConfig);
    this.rateLimits.set('binance', { count: 0, resetTime: Date.now() + 60000 });

    // Test connection
    try {
      const response = await this.makeRequest('binance', '/ping');
      console.log('[ExternalExchangeManager] Binance connection successful');
    } catch (error) {
      console.warn('[ExternalExchangeManager] Binance connection failed:', error.message);
    }
  }

  /**
   * Initialize Uniswap API connection
   */
  async initializeUniswap() {
    const uniswapConfig = {
      name: 'Uniswap',
      baseUrl: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
      rateLimit: 1000,
      endpoints: {
        pools: '/graphql',
        tokens: '/graphql'
      },
      supportedTokens: ['WETH', 'USDC', 'USDT', 'WBTC', 'UNI']
    };

    this.exchanges.set('uniswap', uniswapConfig);
    this.rateLimits.set('uniswap', { count: 0, resetTime: Date.now() + 60000 });

    console.log('[ExternalExchangeManager] Uniswap configuration loaded');
  }

  /**
   * Initialize XSwap API connection (placeholder)
   */
  async initializeXSwap() {
    const xswapConfig = {
      name: 'XSwap',
      baseUrl: 'https://api.xswap.com/v1', // Placeholder URL
      rateLimit: 600,
      endpoints: {
        ticker: '/ticker',
        orderBook: '/orderbook',
        trades: '/trades'
      },
      supportedTokens: ['XDC', 'USDT', 'WETH']
    };

    this.exchanges.set('xswap', xswapConfig);
    this.rateLimits.set('xswap', { count: 0, resetTime: Date.now() + 60000 });

    console.log('[ExternalExchangeManager] XSwap configuration loaded');
  }

  /**
   * Initialize PancakeSwap API connection
   */
  async initializePancakeSwap() {
    const pancakeConfig = {
      name: 'PancakeSwap',
      baseUrl: 'https://api.pancakeswap.info/api/v2',
      rateLimit: 800,
      endpoints: {
        tokens: '/tokens',
        pairs: '/pairs'
      },
      supportedTokens: ['BNB', 'CAKE', 'USDT', 'BUSD', 'ETH']
    };

    this.exchanges.set('pancakeswap', pancakeConfig);
    this.rateLimits.set('pancakeswap', { count: 0, resetTime: Date.now() + 60000 });

    console.log('[ExternalExchangeManager] PancakeSwap configuration loaded');
  }

  /**
   * Initialize QuickSwap API connection
   */
  async initializeQuickSwap() {
    const quickswapConfig = {
      name: 'QuickSwap',
      baseUrl: 'https://api.quickswap.exchange/v1',
      rateLimit: 600,
      endpoints: {
        pairs: '/pairs',
        tokens: '/tokens'
      },
      supportedTokens: ['MATIC', 'QUICK', 'USDC', 'WETH', 'USDT']
    };

    this.exchanges.set('quickswap', quickswapConfig);
    this.rateLimits.set('quickswap', { count: 0, resetTime: Date.now() + 60000 });

    console.log('[ExternalExchangeManager] QuickSwap configuration loaded');
  }

  /**
   * Make rate-limited API request
   */
  async makeRequest(exchangeName, endpoint, params = {}) {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) {
      throw new Error(`Exchange ${exchangeName} not found`);
    }

    // Check rate limit
    if (!this.checkRateLimit(exchangeName)) {
      throw new Error(`Rate limit exceeded for ${exchangeName}`);
    }

    try {
      const url = `${exchange.baseUrl}${endpoint}`;
      const response = await axios.get(url, { params, timeout: 5000 });
      
      // Update rate limit counter
      this.updateRateLimit(exchangeName);
      
      return response.data;

    } catch (error) {
      console.error(`[ExternalExchangeManager] Request failed for ${exchangeName}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if request is within rate limit
   */
  checkRateLimit(exchangeName) {
    const rateLimit = this.rateLimits.get(exchangeName);
    const now = Date.now();

    // Reset counter if minute has passed
    if (now > rateLimit.resetTime) {
      rateLimit.count = 0;
      rateLimit.resetTime = now + 60000;
    }

    const exchange = this.exchanges.get(exchangeName);
    return rateLimit.count < exchange.rateLimit;
  }

  /**
   * Update rate limit counter
   */
  updateRateLimit(exchangeName) {
    const rateLimit = this.rateLimits.get(exchangeName);
    rateLimit.count++;
  }

  /**
   * Get ticker data from external exchange
   */
  async getTicker(exchangeName, symbol) {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) {
      throw new Error(`Exchange ${exchangeName} not found`);
    }

    switch (exchangeName) {
      case 'binance':
        return await this.getBinanceTicker(symbol);
      
      case 'uniswap':
        return await this.getUniswapPrice(symbol);
      
      default:
        throw new Error(`Ticker not implemented for ${exchangeName}`);
    }
  }

  /**
   * Get Binance ticker data
   */
  async getBinanceTicker(symbol) {
    try {
      const data = await this.makeRequest('binance', '/ticker/24hr', { symbol });
      
      return {
        exchange: 'binance',
        symbol: symbol,
        price: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume),
        change: parseFloat(data.priceChangePercent),
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('[ExternalExchangeManager] Binance ticker error:', error);
      return null;
    }
  }

  /**
   * Get Uniswap price data (simplified)
   */
  async getUniswapPrice(symbol) {
    try {
      // This would use GraphQL to query Uniswap pools
      // For now, returning mock data
      return {
        exchange: 'uniswap',
        symbol: symbol,
        price: 0, // Would be calculated from pool data
        volume: 0,
        change: 0,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('[ExternalExchangeManager] Uniswap price error:', error);
      return null;
    }
  }

  /**
   * Get all supported exchanges
   */
  getSupportedExchanges() {
    return Array.from(this.exchanges.keys());
  }

  /**
   * Get exchange configuration
   */
  getExchangeConfig(exchangeName) {
    return this.exchanges.get(exchangeName);
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    const status = {};
    
    for (const [exchangeName, rateLimit] of this.rateLimits.entries()) {
      const exchange = this.exchanges.get(exchangeName);
      status[exchangeName] = {
        current: rateLimit.count,
        limit: exchange.rateLimit,
        resetTime: rateLimit.resetTime,
        remaining: exchange.rateLimit - rateLimit.count
      };
    }

    return status;
  }
}

/**
 * Arbitrage Detection Engine
 */
class ArbitrageDetectionEngine extends EventEmitter {
  constructor(marketDataManager, externalExchangeManager) {
    super();
    this.marketDataManager = marketDataManager;
    this.externalExchangeManager = externalExchangeManager;
    this.opportunities = new Map(); // opportunityId -> ArbitrageOpportunity
    this.priceCache = new Map(); // exchange:symbol -> price data
    this.detectionInterval = null;
    this.isRunning = false;
    this.config = {
      minProfitPercentage: 0.1, // 0.1% minimum profit
      minVolume: 100, // Minimum volume for arbitrage
      maxOpportunities: 100, // Maximum opportunities to track
      detectionFrequency: 5000, // 5 seconds
      priceValidityWindow: 30000 // 30 seconds
    };
    this.stats = {
      opportunitiesDetected: 0,
      opportunitiesExecuted: 0,
      totalProfit: 0,
      averageProfit: 0
    };
  }

  /**
   * Start arbitrage detection
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Arbitrage detection is already running');
    }

    console.log('[ArbitrageDetectionEngine] Starting arbitrage detection...');

    this.isRunning = true;

    // Start price monitoring
    this.startPriceMonitoring();

    // Start opportunity detection
    this.startOpportunityDetection();

    console.log('[ArbitrageDetectionEngine] Arbitrage detection started');
    this.emit('started');
  }

  /**
   * Stop arbitrage detection
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('[ArbitrageDetectionEngine] Stopping arbitrage detection...');

    this.isRunning = false;

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    console.log('[ArbitrageDetectionEngine] Arbitrage detection stopped');
    this.emit('stopped');
  }

  /**
   * Start price monitoring from external exchanges
   */
  startPriceMonitoring() {
    const updatePrices = async () => {
      if (!this.isRunning) return;

      try {
        const exchanges = this.externalExchangeManager.getSupportedExchanges();
        const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'AVAXUSDT', 'MATICUSDT', 'BNBUSDT'];

        for (const exchange of exchanges) {
          for (const symbol of symbols) {
            try {
              const ticker = await this.externalExchangeManager.getTicker(exchange, symbol);
              if (ticker) {
                this.updatePriceCache(exchange, symbol, ticker);
              }
            } catch (error) {
              // Continue with other symbols/exchanges on error
              console.warn(`[ArbitrageDetectionEngine] Price update failed for ${exchange}:${symbol}`);
            }
          }
        }

        // Also update internal exchange prices
        this.updateInternalPrices();

      } catch (error) {
        console.error('[ArbitrageDetectionEngine] Price monitoring error:', error);
      }
    };

    // Update prices every 10 seconds
    setInterval(updatePrices, 10000);
    
    // Initial price update
    updatePrices();
  }

  /**
   * Update internal exchange prices
   */
  updateInternalPrices() {
    try {
      const tickers = this.marketDataManager.getAllTickers();
      
      for (const ticker of tickers) {
        this.updatePriceCache('dbx', ticker.symbol, {
          exchange: 'dbx',
          symbol: ticker.symbol,
          price: ticker.price,
          volume: ticker.volume,
          change: ticker.priceChangePercent,
          timestamp: ticker.lastUpdate
        });
      }

    } catch (error) {
      console.error('[ArbitrageDetectionEngine] Internal price update error:', error);
    }
  }

  /**
   * Update price cache
   */
  updatePriceCache(exchange, symbol, priceData) {
    const key = `${exchange}:${symbol}`;
    this.priceCache.set(key, priceData);

    // Clean up old price data
    this.cleanupPriceCache();
  }

  /**
   * Clean up old price data
   */
  cleanupPriceCache() {
    const now = Date.now();
    const validityWindow = this.config.priceValidityWindow;

    for (const [key, priceData] of this.priceCache.entries()) {
      if (now - priceData.timestamp > validityWindow) {
        this.priceCache.delete(key);
      }
    }
  }

  /**
   * Start opportunity detection
   */
  startOpportunityDetection() {
    this.detectionInterval = setInterval(() => {
      this.detectArbitrageOpportunities();
    }, this.config.detectionFrequency);

    // Initial detection
    this.detectArbitrageOpportunities();
  }

  /**
   * Detect arbitrage opportunities
   */
  detectArbitrageOpportunities() {
    try {
      const symbols = this.getCommonSymbols();
      
      for (const symbol of symbols) {
        this.detectOpportunitiesForSymbol(symbol);
      }

      // Clean up old opportunities
      this.cleanupOpportunities();

    } catch (error) {
      console.error('[ArbitrageDetectionEngine] Opportunity detection error:', error);
    }
  }

  /**
   * Get symbols that are available on multiple exchanges
   */
  getCommonSymbols() {
    const symbolExchanges = new Map();

    // Count exchanges for each symbol
    for (const [key, priceData] of this.priceCache.entries()) {
      const [exchange, symbol] = key.split(':');
      
      if (!symbolExchanges.has(symbol)) {
        symbolExchanges.set(symbol, new Set());
      }
      symbolExchanges.get(symbol).add(exchange);
    }

    // Return symbols available on 2+ exchanges
    return Array.from(symbolExchanges.entries())
      .filter(([symbol, exchanges]) => exchanges.size >= 2)
      .map(([symbol, exchanges]) => symbol);
  }

  /**
   * Detect opportunities for a specific symbol
   */
  detectOpportunitiesForSymbol(symbol) {
    const prices = this.getPricesForSymbol(symbol);
    
    if (prices.length < 2) return;

    // Find best buy and sell prices
    const sortedByPrice = prices.sort((a, b) => a.price - b.price);
    const lowestPrice = sortedByPrice[0];
    const highestPrice = sortedByPrice[sortedByPrice.length - 1];

    // Calculate potential profit
    const profit = highestPrice.price - lowestPrice.price;
    const profitPercentage = (profit / lowestPrice.price) * 100;

    // Check if opportunity is viable
    if (profitPercentage >= this.config.minProfitPercentage) {
      const opportunity = new ArbitrageOpportunity({
        symbol: symbol,
        buyExchange: lowestPrice.exchange,
        sellExchange: highestPrice.exchange,
        buyPrice: lowestPrice.price,
        sellPrice: highestPrice.price,
        volume: Math.min(lowestPrice.volume, highestPrice.volume)
      });

      if (opportunity.isViable(this.config.minProfitPercentage, this.config.minVolume)) {
        this.addOpportunity(opportunity);
      }
    }
  }

  /**
   * Get prices for a symbol from all exchanges
   */
  getPricesForSymbol(symbol) {
    const prices = [];

    for (const [key, priceData] of this.priceCache.entries()) {
      const [exchange, priceSymbol] = key.split(':');
      
      if (priceSymbol === symbol && priceData.price > 0) {
        prices.push(priceData);
      }
    }

    return prices;
  }

  /**
   * Add new arbitrage opportunity
   */
  addOpportunity(opportunity) {
    // Check if similar opportunity already exists
    const existingKey = `${opportunity.symbol}:${opportunity.buyExchange}:${opportunity.sellExchange}`;
    
    for (const [id, existing] of this.opportunities.entries()) {
      const existingKey2 = `${existing.symbol}:${existing.buyExchange}:${existing.sellExchange}`;
      
      if (existingKey === existingKey2) {
        // Update existing opportunity
        this.opportunities.set(id, opportunity);
        this.emit('opportunityUpdated', opportunity);
        return;
      }
    }

    // Add new opportunity
    this.opportunities.set(opportunity.id, opportunity);
    this.stats.opportunitiesDetected++;

    console.log(`[ArbitrageDetectionEngine] New arbitrage opportunity detected: ${opportunity.symbol} - ${opportunity.profitPercentage.toFixed(4)}% profit`);

    this.emit('opportunityDetected', opportunity);

    // Limit number of tracked opportunities
    if (this.opportunities.size > this.config.maxOpportunities) {
      const oldestId = this.opportunities.keys().next().value;
      this.opportunities.delete(oldestId);
    }
  }

  /**
   * Clean up old opportunities
   */
  cleanupOpportunities() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [id, opportunity] of this.opportunities.entries()) {
      if (now - opportunity.timestamp > maxAge) {
        this.opportunities.delete(id);
      }
    }
  }

  /**
   * Get current arbitrage opportunities
   */
  getOpportunities(limit = 20) {
    return Array.from(this.opportunities.values())
      .sort((a, b) => b.profitPercentage - a.profitPercentage)
      .slice(0, limit)
      .map(opp => opp.toJSON());
  }

  /**
   * Get opportunity by ID
   */
  getOpportunity(opportunityId) {
    const opportunity = this.opportunities.get(opportunityId);
    return opportunity ? opportunity.toJSON() : null;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[ArbitrageDetectionEngine] Configuration updated:', this.config);
  }

  /**
   * Get detection statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentOpportunities: this.opportunities.size,
      priceDataPoints: this.priceCache.size,
      isRunning: this.isRunning,
      config: this.config,
      timestamp: Date.now()
    };
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      isRunning: this.isRunning,
      opportunities: this.opportunities.size,
      priceDataAge: this.getAveragePriceDataAge(),
      detectionRate: this.stats.opportunitiesDetected / Math.max((Date.now() - this.startTime) / 60000, 1), // per minute
      timestamp: Date.now()
    };
  }

  /**
   * Get average age of price data
   */
  getAveragePriceDataAge() {
    if (this.priceCache.size === 0) return 0;

    const now = Date.now();
    let totalAge = 0;

    for (const priceData of this.priceCache.values()) {
      totalAge += now - priceData.timestamp;
    }

    return totalAge / this.priceCache.size;
  }
}

module.exports = {
  ArbitrageDetectionEngine,
  ExternalExchangeManager,
  ArbitrageOpportunity
};

