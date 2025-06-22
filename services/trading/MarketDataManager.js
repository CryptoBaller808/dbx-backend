/**
 * Real-Time Market Data Infrastructure for DBX Trading Platform
 * WebSocket-based live feeds for order book depth, trades, and market statistics
 * Supports candlestick data, VWAP calculations, and real-time price feeds
 */

const EventEmitter = require('events');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

/**
 * Candlestick Data Structure
 */
class Candlestick {
  constructor(symbol, interval, openTime) {
    this.symbol = symbol;
    this.interval = interval;
    this.openTime = openTime;
    this.closeTime = openTime + this.getIntervalMs(interval) - 1;
    this.open = 0;
    this.high = 0;
    this.low = Infinity;
    this.close = 0;
    this.volume = 0;
    this.trades = 0;
    this.quoteVolume = 0;
    this.isComplete = false;
  }

  getIntervalMs(interval) {
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[interval] || 60 * 1000;
  }

  addTrade(price, quantity, timestamp) {
    if (timestamp < this.openTime || timestamp > this.closeTime) {
      return false; // Trade doesn't belong to this candlestick
    }

    if (this.open === 0) {
      this.open = price;
    }

    this.high = Math.max(this.high, price);
    this.low = Math.min(this.low, price);
    this.close = price;
    this.volume += quantity;
    this.quoteVolume += price * quantity;
    this.trades++;

    return true;
  }

  complete() {
    this.isComplete = true;
    if (this.low === Infinity) {
      this.low = this.open;
    }
  }

  toJSON() {
    return {
      symbol: this.symbol,
      interval: this.interval,
      openTime: this.openTime,
      closeTime: this.closeTime,
      open: this.open,
      high: this.high,
      low: this.low,
      close: this.close,
      volume: this.volume,
      trades: this.trades,
      quoteVolume: this.quoteVolume,
      isComplete: this.isComplete
    };
  }
}

/**
 * VWAP Calculator
 * Volume-Weighted Average Price calculation
 */
class VWAPCalculator {
  constructor(symbol, windowSize = 24 * 60 * 60 * 1000) { // 24 hours default
    this.symbol = symbol;
    this.windowSize = windowSize;
    this.trades = [];
    this.currentVWAP = 0;
    this.totalVolume = 0;
    this.totalValue = 0;
  }

  addTrade(price, quantity, timestamp) {
    // Remove old trades outside the window
    const cutoff = timestamp - this.windowSize;
    this.trades = this.trades.filter(trade => trade.timestamp > cutoff);

    // Add new trade
    this.trades.push({ price, quantity, timestamp, value: price * quantity });

    // Recalculate VWAP
    this.recalculate();
  }

  recalculate() {
    this.totalVolume = 0;
    this.totalValue = 0;

    for (const trade of this.trades) {
      this.totalVolume += trade.quantity;
      this.totalValue += trade.value;
    }

    this.currentVWAP = this.totalVolume > 0 ? this.totalValue / this.totalVolume : 0;
  }

  getVWAP() {
    return {
      symbol: this.symbol,
      vwap: this.currentVWAP,
      volume: this.totalVolume,
      trades: this.trades.length,
      timestamp: Date.now()
    };
  }
}

/**
 * Market Data Manager
 * Manages real-time market data feeds and calculations
 */
class MarketDataManager extends EventEmitter {
  constructor(orderBookManager, matchingEngine) {
    super();
    this.orderBookManager = orderBookManager;
    this.matchingEngine = matchingEngine;
    this.candlesticks = new Map(); // symbol:interval -> Candlestick[]
    this.vwapCalculators = new Map(); // symbol -> VWAPCalculator
    this.tickerData = new Map(); // symbol -> ticker data
    this.subscribers = new Map(); // connectionId -> subscription info
    this.intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];
    this.isInitialized = false;
  }

  /**
   * Initialize market data manager
   */
  async initialize() {
    try {
      console.log('[MarketDataManager] Initializing market data manager...');

      // Initialize candlestick data for all trading pairs
      this.initializeCandlesticks();

      // Initialize VWAP calculators
      this.initializeVWAPCalculators();

      // Initialize ticker data
      this.initializeTickerData();

      // Set up event listeners
      this.setupEventListeners();

      // Start periodic updates
      this.startPeriodicUpdates();

      this.isInitialized = true;
      console.log('[MarketDataManager] Market data manager initialized successfully');

      return true;

    } catch (error) {
      console.error('[MarketDataManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Initialize candlestick data structures
   */
  initializeCandlesticks() {
    const tradingPairs = this.orderBookManager.getTradingPairs();

    for (const pair of tradingPairs) {
      for (const interval of this.intervals) {
        const key = `${pair.symbol}:${interval}`;
        this.candlesticks.set(key, []);
      }
    }
  }

  /**
   * Initialize VWAP calculators
   */
  initializeVWAPCalculators() {
    const tradingPairs = this.orderBookManager.getTradingPairs();

    for (const pair of tradingPairs) {
      this.vwapCalculators.set(pair.symbol, new VWAPCalculator(pair.symbol));
    }
  }

  /**
   * Initialize ticker data
   */
  initializeTickerData() {
    const tradingPairs = this.orderBookManager.getTradingPairs();

    for (const pair of tradingPairs) {
      this.tickerData.set(pair.symbol, {
        symbol: pair.symbol,
        price: 0,
        priceChange: 0,
        priceChangePercent: 0,
        volume: 0,
        quoteVolume: 0,
        high: 0,
        low: Infinity,
        open: 0,
        close: 0,
        trades: 0,
        lastUpdate: Date.now()
      });
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for trades from matching engine
    this.matchingEngine.on('tradeExecuted', (data) => {
      this.processTrade(data.trade);
    });

    // Listen for order book updates
    this.orderBookManager.on('bookUpdated', (snapshot) => {
      this.processOrderBookUpdate(snapshot);
    });

    // Listen for order events
    this.orderBookManager.on('orderAdded', (order) => {
      this.broadcastOrderUpdate('orderAdded', order);
    });

    this.orderBookManager.on('orderCancelled', (order) => {
      this.broadcastOrderUpdate('orderCancelled', order);
    });
  }

  /**
   * Process trade for market data updates
   */
  processTrade(trade) {
    const { symbol, price, quantity, timestamp } = trade;

    // Update candlestick data
    this.updateCandlesticks(symbol, price, quantity, timestamp);

    // Update VWAP
    this.updateVWAP(symbol, price, quantity, timestamp);

    // Update ticker data
    this.updateTickerData(symbol, price, quantity, timestamp);

    // Broadcast trade update
    this.broadcastTrade(trade);
  }

  /**
   * Update candlestick data
   */
  updateCandlesticks(symbol, price, quantity, timestamp) {
    for (const interval of this.intervals) {
      const key = `${symbol}:${interval}`;
      const candlesticks = this.candlesticks.get(key);

      if (!candlesticks) continue;

      // Get current candlestick or create new one
      let currentCandle = candlesticks[candlesticks.length - 1];
      const intervalMs = new Candlestick(symbol, interval, 0).getIntervalMs(interval);
      const candleOpenTime = Math.floor(timestamp / intervalMs) * intervalMs;

      if (!currentCandle || currentCandle.openTime !== candleOpenTime) {
        // Complete previous candlestick
        if (currentCandle && !currentCandle.isComplete) {
          currentCandle.complete();
          this.broadcastCandlestick(currentCandle);
        }

        // Create new candlestick
        currentCandle = new Candlestick(symbol, interval, candleOpenTime);
        candlesticks.push(currentCandle);

        // Keep only last 1000 candlesticks
        if (candlesticks.length > 1000) {
          candlesticks.shift();
        }
      }

      // Add trade to current candlestick
      currentCandle.addTrade(price, quantity, timestamp);

      // Broadcast updated candlestick
      this.broadcastCandlestick(currentCandle);
    }
  }

  /**
   * Update VWAP calculation
   */
  updateVWAP(symbol, price, quantity, timestamp) {
    const calculator = this.vwapCalculators.get(symbol);
    if (calculator) {
      calculator.addTrade(price, quantity, timestamp);
      this.broadcastVWAP(calculator.getVWAP());
    }
  }

  /**
   * Update ticker data
   */
  updateTickerData(symbol, price, quantity, timestamp) {
    const ticker = this.tickerData.get(symbol);
    if (!ticker) return;

    // Update price data
    const previousPrice = ticker.close || ticker.price;
    ticker.price = price;
    ticker.close = price;

    if (ticker.open === 0) {
      ticker.open = price;
    }

    ticker.high = Math.max(ticker.high, price);
    ticker.low = Math.min(ticker.low === Infinity ? price : ticker.low, price);

    // Update volume data
    ticker.volume += quantity;
    ticker.quoteVolume += price * quantity;
    ticker.trades++;

    // Calculate price change
    if (previousPrice > 0) {
      ticker.priceChange = price - previousPrice;
      ticker.priceChangePercent = (ticker.priceChange / previousPrice) * 100;
    }

    ticker.lastUpdate = timestamp;

    // Broadcast ticker update
    this.broadcastTicker(ticker);
  }

  /**
   * Process order book update
   */
  processOrderBookUpdate(snapshot) {
    this.broadcastOrderBook(snapshot);
  }

  /**
   * Start periodic updates
   */
  startPeriodicUpdates() {
    // Update tickers every second
    setInterval(() => {
      this.broadcastAllTickers();
    }, 1000);

    // Complete candlesticks at interval boundaries
    setInterval(() => {
      this.completeCandlesticks();
    }, 60000); // Check every minute

    // Clean up old data
    setInterval(() => {
      this.cleanupOldData();
    }, 300000); // Every 5 minutes
  }

  /**
   * Complete candlesticks at interval boundaries
   */
  completeCandlesticks() {
    const now = Date.now();

    for (const [key, candlesticks] of this.candlesticks.entries()) {
      const [symbol, interval] = key.split(':');
      const intervalMs = new Candlestick(symbol, interval, 0).getIntervalMs(interval);

      for (const candle of candlesticks) {
        if (!candle.isComplete && now > candle.closeTime) {
          candle.complete();
          this.broadcastCandlestick(candle);
        }
      }
    }
  }

  /**
   * Clean up old data
   */
  cleanupOldData() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = Date.now() - maxAge;

    // Clean up old candlesticks
    for (const [key, candlesticks] of this.candlesticks.entries()) {
      const filtered = candlesticks.filter(candle => candle.openTime > cutoff);
      this.candlesticks.set(key, filtered);
    }
  }

  /**
   * Broadcasting methods
   */
  broadcastTrade(trade) {
    this.broadcast('trade', trade);
  }

  broadcastOrderBook(snapshot) {
    this.broadcast('orderBook', snapshot);
  }

  broadcastTicker(ticker) {
    this.broadcast('ticker', ticker);
  }

  broadcastAllTickers() {
    const allTickers = Array.from(this.tickerData.values());
    this.broadcast('tickers', allTickers);
  }

  broadcastCandlestick(candlestick) {
    this.broadcast('candlestick', candlestick.toJSON());
  }

  broadcastVWAP(vwapData) {
    this.broadcast('vwap', vwapData);
  }

  broadcastOrderUpdate(type, order) {
    this.broadcast('orderUpdate', { type, order });
  }

  /**
   * Generic broadcast method
   */
  broadcast(type, data) {
    const message = {
      type,
      data,
      timestamp: Date.now()
    };

    this.emit('broadcast', message);

    // Also emit specific event type
    this.emit(type, data);
  }

  /**
   * Get historical candlestick data
   */
  getCandlesticks(symbol, interval, limit = 100) {
    const key = `${symbol}:${interval}`;
    const candlesticks = this.candlesticks.get(key) || [];
    
    return candlesticks
      .slice(-limit)
      .map(candle => candle.toJSON());
  }

  /**
   * Get current ticker data
   */
  getTicker(symbol) {
    return this.tickerData.get(symbol);
  }

  /**
   * Get all tickers
   */
  getAllTickers() {
    return Array.from(this.tickerData.values());
  }

  /**
   * Get current VWAP
   */
  getVWAP(symbol) {
    const calculator = this.vwapCalculators.get(symbol);
    return calculator ? calculator.getVWAP() : null;
  }

  /**
   * Get market statistics
   */
  getMarketStats(symbol = null) {
    if (symbol) {
      const ticker = this.getTicker(symbol);
      const vwap = this.getVWAP(symbol);
      const orderBook = this.orderBookManager.getOrderBook(symbol, 1);

      return {
        ticker,
        vwap,
        bestBid: orderBook.bids[0]?.price || null,
        bestAsk: orderBook.asks[0]?.price || null,
        spread: orderBook.bids[0] && orderBook.asks[0] 
          ? orderBook.asks[0].price - orderBook.bids[0].price 
          : null,
        timestamp: Date.now()
      };
    }

    // Get stats for all symbols
    const allStats = {};
    for (const ticker of this.getAllTickers()) {
      allStats[ticker.symbol] = this.getMarketStats(ticker.symbol);
    }

    return allStats;
  }

  /**
   * Subscribe to market data updates
   */
  subscribe(connectionId, subscriptions) {
    this.subscribers.set(connectionId, {
      subscriptions,
      timestamp: Date.now()
    });
  }

  /**
   * Unsubscribe from market data updates
   */
  unsubscribe(connectionId) {
    this.subscribers.delete(connectionId);
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      subscribers: this.subscribers.size,
      candlestickSeries: this.candlesticks.size,
      vwapCalculators: this.vwapCalculators.size,
      tickers: this.tickerData.size,
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now()
    };
  }
}

/**
 * WebSocket Market Data Server
 * Handles WebSocket connections for real-time market data
 */
class MarketDataWebSocketServer extends EventEmitter {
  constructor(marketDataManager, port = 8080) {
    super();
    this.marketDataManager = marketDataManager;
    this.port = port;
    this.wss = null;
    this.connections = new Map(); // connectionId -> WebSocket
    this.isRunning = false;
  }

  /**
   * Start WebSocket server
   */
  start() {
    if (this.isRunning) {
      throw new Error('WebSocket server is already running');
    }

    this.wss = new WebSocket.Server({ 
      port: this.port,
      perMessageDeflate: false // Disable compression for lower latency
    });

    this.setupWebSocketHandlers();
    this.setupMarketDataListeners();

    this.isRunning = true;
    console.log(`[MarketDataWebSocket] WebSocket server started on port ${this.port}`);
  }

  /**
   * Stop WebSocket server
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    // Close all connections
    for (const ws of this.connections.values()) {
      ws.close();
    }

    this.wss.close();
    this.isRunning = false;
    console.log('[MarketDataWebSocket] WebSocket server stopped');
  }

  /**
   * Set up WebSocket connection handlers
   */
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, request) => {
      const connectionId = uuidv4();
      this.connections.set(connectionId, ws);

      console.log(`[MarketDataWebSocket] New connection: ${connectionId}`);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'welcome',
        connectionId,
        timestamp: Date.now()
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(connectionId, ws, message);
        } catch (error) {
          console.error('[MarketDataWebSocket] Error parsing message:', error);
          this.sendError(ws, 'Invalid JSON message');
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`[MarketDataWebSocket] Connection closed: ${connectionId}`);
        this.connections.delete(connectionId);
        this.marketDataManager.unsubscribe(connectionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[MarketDataWebSocket] Connection error ${connectionId}:`, error);
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(connectionId, ws, message) {
    const { type, data } = message;

    switch (type) {
      case 'subscribe':
        this.handleSubscribe(connectionId, ws, data);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(connectionId, ws, data);
        break;

      case 'getOrderBook':
        this.handleGetOrderBook(ws, data);
        break;

      case 'getTicker':
        this.handleGetTicker(ws, data);
        break;

      case 'getCandlesticks':
        this.handleGetCandlesticks(ws, data);
        break;

      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  /**
   * Handle subscription requests
   */
  handleSubscribe(connectionId, ws, data) {
    const { streams } = data;
    
    this.marketDataManager.subscribe(connectionId, streams);
    
    this.sendMessage(ws, {
      type: 'subscribed',
      streams,
      timestamp: Date.now()
    });
  }

  /**
   * Handle unsubscription requests
   */
  handleUnsubscribe(connectionId, ws, data) {
    this.marketDataManager.unsubscribe(connectionId);
    
    this.sendMessage(ws, {
      type: 'unsubscribed',
      timestamp: Date.now()
    });
  }

  /**
   * Handle order book requests
   */
  handleGetOrderBook(ws, data) {
    const { symbol, depth = 10 } = data;
    
    try {
      const orderBook = this.marketDataManager.orderBookManager.getOrderBook(symbol, depth);
      this.sendMessage(ws, {
        type: 'orderBook',
        data: orderBook,
        timestamp: Date.now()
      });
    } catch (error) {
      this.sendError(ws, error.message);
    }
  }

  /**
   * Handle ticker requests
   */
  handleGetTicker(ws, data) {
    const { symbol } = data;
    
    if (symbol) {
      const ticker = this.marketDataManager.getTicker(symbol);
      this.sendMessage(ws, {
        type: 'ticker',
        data: ticker,
        timestamp: Date.now()
      });
    } else {
      const tickers = this.marketDataManager.getAllTickers();
      this.sendMessage(ws, {
        type: 'tickers',
        data: tickers,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle candlestick requests
   */
  handleGetCandlesticks(ws, data) {
    const { symbol, interval, limit = 100 } = data;
    
    const candlesticks = this.marketDataManager.getCandlesticks(symbol, interval, limit);
    this.sendMessage(ws, {
      type: 'candlesticks',
      data: {
        symbol,
        interval,
        candlesticks
      },
      timestamp: Date.now()
    });
  }

  /**
   * Set up market data event listeners
   */
  setupMarketDataListeners() {
    this.marketDataManager.on('broadcast', (message) => {
      this.broadcastToSubscribers(message);
    });
  }

  /**
   * Broadcast message to all subscribers
   */
  broadcastToSubscribers(message) {
    for (const [connectionId, ws] of this.connections.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    }
  }

  /**
   * Send message to WebSocket connection
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  sendError(ws, error) {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      connections: this.connections.size,
      timestamp: Date.now()
    };
  }
}

module.exports = {
  MarketDataManager,
  MarketDataWebSocketServer,
  Candlestick,
  VWAPCalculator
};

