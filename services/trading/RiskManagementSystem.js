/**
 * Risk & Trade Management System for DBX Trading Platform
 * Real-time position monitoring, circuit breakers, and anti-manipulation protection
 * Comprehensive audit trails and risk assessment for all trading activities
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Risk Assessment Result
 */
class RiskAssessment {
  constructor(data) {
    this.id = uuidv4();
    this.userId = data.userId;
    this.symbol = data.symbol;
    this.orderType = data.orderType;
    this.quantity = data.quantity;
    this.price = data.price;
    this.side = data.side;
    this.riskScore = 0;
    this.riskLevel = 'LOW';
    this.warnings = [];
    this.violations = [];
    this.approved = true;
    this.timestamp = Date.now();
    this.assessmentTime = 0;
  }

  addWarning(type, message, severity = 'MEDIUM') {
    this.warnings.push({
      type,
      message,
      severity,
      timestamp: Date.now()
    });
    
    if (severity === 'HIGH') {
      this.riskScore += 30;
    } else if (severity === 'MEDIUM') {
      this.riskScore += 15;
    } else {
      this.riskScore += 5;
    }
    
    this.updateRiskLevel();
  }

  addViolation(type, message, severity = 'HIGH') {
    this.violations.push({
      type,
      message,
      severity,
      timestamp: Date.now()
    });
    
    this.riskScore += severity === 'CRITICAL' ? 100 : 50;
    this.approved = false;
    this.updateRiskLevel();
  }

  updateRiskLevel() {
    if (this.riskScore >= 80) {
      this.riskLevel = 'CRITICAL';
    } else if (this.riskScore >= 50) {
      this.riskLevel = 'HIGH';
    } else if (this.riskScore >= 25) {
      this.riskLevel = 'MEDIUM';
    } else {
      this.riskLevel = 'LOW';
    }
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      symbol: this.symbol,
      orderType: this.orderType,
      quantity: this.quantity,
      price: this.price,
      side: this.side,
      riskScore: this.riskScore,
      riskLevel: this.riskLevel,
      warnings: this.warnings,
      violations: this.violations,
      approved: this.approved,
      timestamp: this.timestamp,
      assessmentTime: this.assessmentTime
    };
  }
}

/**
 * Position Manager
 * Tracks user positions and enforces limits
 */
class PositionManager {
  constructor() {
    this.positions = new Map(); // userId:symbol -> position data
    this.userLimits = new Map(); // userId -> limits configuration
    this.defaultLimits = {
      maxPositionSize: 1000000, // $1M default
      maxDailyVolume: 10000000, // $10M daily
      maxOpenOrders: 100,
      maxLeverage: 10,
      marginRequirement: 0.1 // 10%
    };
  }

  /**
   * Get user position for symbol
   */
  getPosition(userId, symbol) {
    const key = `${userId}:${symbol}`;
    return this.positions.get(key) || {
      userId,
      symbol,
      quantity: 0,
      averagePrice: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      margin: 0,
      lastUpdate: Date.now()
    };
  }

  /**
   * Update position after trade
   */
  updatePosition(userId, symbol, trade) {
    const position = this.getPosition(userId, symbol);
    const key = `${userId}:${symbol}`;

    if (trade.side === 'BUY') {
      // Buying - increase position
      const newQuantity = position.quantity + trade.quantity;
      const newAveragePrice = newQuantity > 0 
        ? ((position.quantity * position.averagePrice) + (trade.quantity * trade.price)) / newQuantity
        : trade.price;

      position.quantity = newQuantity;
      position.averagePrice = newAveragePrice;
    } else {
      // Selling - decrease position
      const soldQuantity = Math.min(position.quantity, trade.quantity);
      const realizedPnL = soldQuantity * (trade.price - position.averagePrice);
      
      position.quantity -= soldQuantity;
      position.realizedPnL += realizedPnL;
      
      // If selling more than position, create short position
      if (trade.quantity > soldQuantity) {
        const shortQuantity = trade.quantity - soldQuantity;
        position.quantity = -shortQuantity;
        position.averagePrice = trade.price;
      }
    }

    position.lastUpdate = Date.now();
    this.positions.set(key, position);

    return position;
  }

  /**
   * Calculate unrealized PnL
   */
  calculateUnrealizedPnL(userId, symbol, currentPrice) {
    const position = this.getPosition(userId, symbol);
    
    if (position.quantity === 0) return 0;
    
    const unrealizedPnL = position.quantity * (currentPrice - position.averagePrice);
    position.unrealizedPnL = unrealizedPnL;
    
    return unrealizedPnL;
  }

  /**
   * Check position limits
   */
  checkPositionLimits(userId, symbol, newTrade) {
    const limits = this.getUserLimits(userId);
    const position = this.getPosition(userId, symbol);
    const violations = [];

    // Calculate new position after trade
    let newQuantity = position.quantity;
    if (newTrade.side === 'BUY') {
      newQuantity += newTrade.quantity;
    } else {
      newQuantity -= newTrade.quantity;
    }

    const newPositionValue = Math.abs(newQuantity * newTrade.price);

    // Check maximum position size
    if (newPositionValue > limits.maxPositionSize) {
      violations.push({
        type: 'MAX_POSITION_SIZE',
        message: `Position size ${newPositionValue} exceeds limit ${limits.maxPositionSize}`,
        severity: 'HIGH'
      });
    }

    // Check margin requirements
    const requiredMargin = newPositionValue * limits.marginRequirement;
    const availableMargin = this.getAvailableMargin(userId);
    
    if (requiredMargin > availableMargin) {
      violations.push({
        type: 'INSUFFICIENT_MARGIN',
        message: `Required margin ${requiredMargin} exceeds available ${availableMargin}`,
        severity: 'CRITICAL'
      });
    }

    return violations;
  }

  /**
   * Get user limits
   */
  getUserLimits(userId) {
    return this.limits.get(userId) || this.defaultLimits;
  }

  /**
   * Set user limits
   */
  setUserLimits(userId, limits) {
    this.limits.set(userId, { ...this.defaultLimits, ...limits });
  }

  /**
   * Get available margin (simplified)
   */
  getAvailableMargin(userId) {
    // This would integrate with the actual balance system
    // For now, returning a mock value
    return 100000; // $100K default
  }

  /**
   * Get all positions for user
   */
  getUserPositions(userId) {
    const userPositions = [];
    
    for (const [key, position] of this.positions.entries()) {
      if (key.startsWith(`${userId}:`)) {
        userPositions.push(position);
      }
    }

    return userPositions;
  }

  /**
   * Get position statistics
   */
  getPositionStats(userId) {
    const positions = this.getUserPositions(userId);
    
    return {
      totalPositions: positions.length,
      totalValue: positions.reduce((sum, pos) => sum + Math.abs(pos.quantity * pos.averagePrice), 0),
      totalUnrealizedPnL: positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0),
      totalRealizedPnL: positions.reduce((sum, pos) => sum + pos.realizedPnL, 0),
      timestamp: Date.now()
    };
  }

  /**
   * Get user limits
   */
  getUserLimits(userId) {
    return this.userLimits.get(userId) || {
      maxPositionSize: 1000000, // $1M default
      maxDailyVolume: 10000000, // $10M default
      maxOrderSize: 100000, // $100K default
      riskLevel: 'MEDIUM'
    };
  }

  /**
   * Set user limits (admin function)
   */
  setUserLimits(userId, limits) {
    const currentLimits = this.getUserLimits(userId);
    const newLimits = { ...currentLimits, ...limits };
    
    this.userLimits.set(userId, newLimits);
    
    console.log(`[PositionManager] User limits updated for ${userId}`);
    
    return {
      userId,
      limits: newLimits,
      timestamp: Date.now()
    };
  }
}

/**
 * Circuit Breaker System
 * Automatic trading halts for market protection
 */
class CircuitBreakerSystem extends EventEmitter {
  constructor(marketDataManager) {
    super();
    this.marketDataManager = marketDataManager;
    this.breakers = new Map(); // symbol -> breaker state
    this.config = {
      priceChangeThreshold: 10, // 10% price change
      volumeThreshold: 1000000, // $1M volume spike
      timeWindow: 300000, // 5 minutes
      cooldownPeriod: 900000 // 15 minutes
    };
    this.isMonitoring = false;
  }

  /**
   * Start circuit breaker monitoring
   */
  start() {
    if (this.isMonitoring) return;

    console.log('[CircuitBreakerSystem] Starting circuit breaker monitoring...');
    this.isMonitoring = true;

    // Monitor price changes every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkCircuitBreakers();
    }, 30000);

    // Listen for trade events
    this.marketDataManager.on('trade', (trade) => {
      this.checkTradeForBreaker(trade);
    });
  }

  /**
   * Stop circuit breaker monitoring
   */
  stop() {
    if (!this.isMonitoring) return;

    console.log('[CircuitBreakerSystem] Stopping circuit breaker monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Check all circuit breakers
   */
  checkCircuitBreakers() {
    const tickers = this.marketDataManager.getAllTickers();

    for (const ticker of tickers) {
      this.checkPriceBreaker(ticker);
      this.checkVolumeBreaker(ticker);
    }

    // Check for breaker cooldowns
    this.checkCooldowns();
  }

  /**
   * Check price-based circuit breaker
   */
  checkPriceBreaker(ticker) {
    const { symbol, priceChangePercent } = ticker;
    
    if (Math.abs(priceChangePercent) >= this.config.priceChangeThreshold) {
      this.triggerBreaker(symbol, 'PRICE_CHANGE', {
        priceChange: priceChangePercent,
        threshold: this.config.priceChangeThreshold,
        ticker
      });
    }
  }

  /**
   * Check volume-based circuit breaker
   */
  checkVolumeBreaker(ticker) {
    const { symbol, quoteVolume } = ticker;
    
    if (quoteVolume >= this.config.volumeThreshold) {
      // Check if this is unusual volume (simplified)
      const averageVolume = this.getAverageVolume(symbol);
      const volumeSpike = (quoteVolume / averageVolume) * 100;
      
      if (volumeSpike >= 500) { // 5x normal volume
        this.triggerBreaker(symbol, 'VOLUME_SPIKE', {
          currentVolume: quoteVolume,
          averageVolume,
          spike: volumeSpike,
          ticker
        });
      }
    }
  }

  /**
   * Check individual trade for circuit breaker
   */
  checkTradeForBreaker(trade) {
    // Check for large single trades
    const tradeValue = trade.quantity * trade.price;
    
    if (tradeValue >= this.config.volumeThreshold / 10) { // 10% of volume threshold
      this.triggerBreaker(trade.symbol, 'LARGE_TRADE', {
        tradeValue,
        threshold: this.config.volumeThreshold / 10,
        trade
      });
    }
  }

  /**
   * Trigger circuit breaker
   */
  triggerBreaker(symbol, type, data) {
    const breakerId = `${symbol}:${type}`;
    const existingBreaker = this.breakers.get(breakerId);

    // Don't trigger if already active
    if (existingBreaker && existingBreaker.active) {
      return;
    }

    const breaker = {
      id: uuidv4(),
      symbol,
      type,
      data,
      active: true,
      triggeredAt: Date.now(),
      expiresAt: Date.now() + this.config.cooldownPeriod
    };

    this.breakers.set(breakerId, breaker);

    console.log(`[CircuitBreakerSystem] Circuit breaker triggered: ${symbol} - ${type}`);

    // Emit breaker event
    this.emit('breakerTriggered', breaker);

    // Halt trading for this symbol
    this.haltTrading(symbol, breaker);
  }

  /**
   * Halt trading for symbol
   */
  haltTrading(symbol, breaker) {
    // This would integrate with the matching engine to halt trading
    console.log(`[CircuitBreakerSystem] Trading halted for ${symbol}`);
    
    this.emit('tradingHalted', {
      symbol,
      reason: breaker.type,
      duration: this.config.cooldownPeriod,
      timestamp: Date.now()
    });
  }

  /**
   * Resume trading for symbol
   */
  resumeTrading(symbol) {
    console.log(`[CircuitBreakerSystem] Trading resumed for ${symbol}`);
    
    this.emit('tradingResumed', {
      symbol,
      timestamp: Date.now()
    });
  }

  /**
   * Check for expired breakers
   */
  checkCooldowns() {
    const now = Date.now();

    for (const [breakerId, breaker] of this.breakers.entries()) {
      if (breaker.active && now >= breaker.expiresAt) {
        breaker.active = false;
        this.resumeTrading(breaker.symbol);
        
        this.emit('breakerExpired', breaker);
      }
    }
  }

  /**
   * Get average volume for symbol (simplified)
   */
  getAverageVolume(symbol) {
    // This would calculate from historical data
    // For now, returning a mock value
    return 100000; // $100K average
  }

  /**
   * Get active breakers
   */
  getActiveBreakers() {
    return Array.from(this.breakers.values())
      .filter(breaker => breaker.active);
  }

  /**
   * Get breaker history
   */
  getBreakerHistory(limit = 50) {
    return Array.from(this.breakers.values())
      .sort((a, b) => b.triggeredAt - a.triggeredAt)
      .slice(0, limit);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[CircuitBreakerSystem] Configuration updated:', this.config);
  }

  /**
   * Reset circuit breaker for symbol (admin function)
   */
  resetBreaker(symbol, adminId) {
    const breakersToReset = [];
    
    for (const [breakerId, breaker] of this.breakers.entries()) {
      if (breaker.symbol === symbol && breaker.active) {
        breaker.active = false;
        breaker.resetBy = adminId;
        breaker.resetAt = Date.now();
        breakersToReset.push(breaker);
      }
    }
    
    if (breakersToReset.length > 0) {
      this.resumeTrading(symbol);
      
      console.log(`[CircuitBreakerSystem] Circuit breaker reset for ${symbol} by admin ${adminId}`);
      
      this.emit('breakerReset', {
        symbol,
        adminId,
        breakers: breakersToReset,
        timestamp: Date.now()
      });
    }
    
    return {
      symbol,
      resetCount: breakersToReset.length,
      adminId,
      timestamp: Date.now()
    };
  }
}

/**
 * Anti-Manipulation Detection System
 */
class AntiManipulationSystem extends EventEmitter {
  constructor() {
    super();
    this.suspiciousActivities = new Map();
    this.userBehaviorProfiles = new Map();
    this.detectionRules = new Map();
    this.isMonitoring = false;
    this.setupDetectionRules();
  }

  /**
   * Setup detection rules
   */
  setupDetectionRules() {
    // Wash trading detection
    this.detectionRules.set('WASH_TRADING', {
      name: 'Wash Trading Detection',
      check: (activity) => this.checkWashTrading(activity),
      severity: 'HIGH',
      threshold: 0.8
    });

    // Pump and dump detection
    this.detectionRules.set('PUMP_DUMP', {
      name: 'Pump and Dump Detection',
      check: (activity) => this.checkPumpDump(activity),
      severity: 'CRITICAL',
      threshold: 0.9
    });

    // Spoofing detection
    this.detectionRules.set('SPOOFING', {
      name: 'Order Spoofing Detection',
      check: (activity) => this.checkSpoofing(activity),
      severity: 'HIGH',
      threshold: 0.7
    });

    // Layering detection
    this.detectionRules.set('LAYERING', {
      name: 'Order Layering Detection',
      check: (activity) => this.checkLayering(activity),
      severity: 'MEDIUM',
      threshold: 0.6
    });
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isMonitoring) return;

    console.log('[AntiManipulationSystem] Starting manipulation detection...');
    this.isMonitoring = true;

    // Analyze user behavior every minute
    this.analysisInterval = setInterval(() => {
      this.analyzeUserBehavior();
    }, 60000);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) return;

    console.log('[AntiManipulationSystem] Stopping manipulation detection...');
    this.isMonitoring = false;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }

  /**
   * Analyze trade for manipulation
   */
  analyzeTrade(trade) {
    const userId = trade.userId || trade.takerUserId;
    if (!userId) return;

    // Update user behavior profile
    this.updateUserProfile(userId, trade);

    // Check for suspicious patterns
    const suspicionScore = this.calculateSuspicionScore(userId, trade);
    
    if (suspicionScore > 0.5) {
      this.flagSuspiciousActivity(userId, trade, suspicionScore);
    }
  }

  /**
   * Update user behavior profile
   */
  updateUserProfile(userId, trade) {
    let profile = this.userBehaviorProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        trades: [],
        orders: [],
        patterns: {},
        riskScore: 0,
        lastUpdate: Date.now()
      };
    }

    // Add trade to profile
    profile.trades.push({
      ...trade,
      timestamp: Date.now()
    });

    // Keep only last 1000 trades
    if (profile.trades.length > 1000) {
      profile.trades = profile.trades.slice(-1000);
    }

    profile.lastUpdate = Date.now();
    this.userBehaviorProfiles.set(userId, profile);
  }

  /**
   * Calculate suspicion score
   */
  calculateSuspicionScore(userId, trade) {
    let totalScore = 0;
    let ruleCount = 0;

    for (const [ruleId, rule] of this.detectionRules.entries()) {
      try {
        const score = rule.check({ userId, trade, profile: this.userBehaviorProfiles.get(userId) });
        totalScore += score;
        ruleCount++;
      } catch (error) {
        console.error(`[AntiManipulationSystem] Rule ${ruleId} error:`, error);
      }
    }

    return ruleCount > 0 ? totalScore / ruleCount : 0;
  }

  /**
   * Check for wash trading
   */
  checkWashTrading(activity) {
    const { userId, trade, profile } = activity;
    if (!profile || profile.trades.length < 10) return 0;

    const recentTrades = profile.trades.slice(-50);
    let suspiciousCount = 0;

    // Look for trades at similar prices within short time windows
    for (let i = 0; i < recentTrades.length - 1; i++) {
      const trade1 = recentTrades[i];
      const trade2 = recentTrades[i + 1];

      // Check if trades are on opposite sides with similar prices
      if (trade1.side !== trade2.side && 
          Math.abs(trade1.price - trade2.price) / trade1.price < 0.001 && // <0.1% price difference
          Math.abs(trade1.timestamp - trade2.timestamp) < 300000) { // Within 5 minutes
        suspiciousCount++;
      }
    }

    return Math.min(suspiciousCount / 10, 1); // Normalize to 0-1
  }

  /**
   * Check for pump and dump
   */
  checkPumpDump(activity) {
    const { userId, trade, profile } = activity;
    if (!profile || profile.trades.length < 20) return 0;

    const recentTrades = profile.trades.slice(-100);
    const symbol = trade.symbol;
    const symbolTrades = recentTrades.filter(t => t.symbol === symbol);

    if (symbolTrades.length < 10) return 0;

    // Look for pattern: many buys followed by many sells
    const buyTrades = symbolTrades.filter(t => t.side === 'BUY');
    const sellTrades = symbolTrades.filter(t => t.side === 'SELL');

    // Check if there's a concentration of buys followed by sells
    const buyVolume = buyTrades.reduce((sum, t) => sum + t.quantity, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.quantity, 0);

    if (buyVolume > 0 && sellVolume > buyVolume * 0.8) {
      // Check timing pattern
      const avgBuyTime = buyTrades.reduce((sum, t) => sum + t.timestamp, 0) / buyTrades.length;
      const avgSellTime = sellTrades.reduce((sum, t) => sum + t.timestamp, 0) / sellTrades.length;

      if (avgSellTime > avgBuyTime) {
        return Math.min((sellVolume / buyVolume), 1);
      }
    }

    return 0;
  }

  /**
   * Check for spoofing
   */
  checkSpoofing(activity) {
    const { userId, profile } = activity;
    if (!profile || profile.orders.length < 5) return 0;

    // This would check for large orders that are quickly cancelled
    // For now, returning a mock score
    return 0;
  }

  /**
   * Check for layering
   */
  checkLayering(activity) {
    const { userId, profile } = activity;
    if (!profile || profile.orders.length < 10) return 0;

    // This would check for multiple orders at different price levels
    // For now, returning a mock score
    return 0;
  }

  /**
   * Flag suspicious activity
   */
  flagSuspiciousActivity(userId, trade, suspicionScore) {
    const activityId = uuidv4();
    const activity = {
      id: activityId,
      userId,
      trade,
      suspicionScore,
      detectedRules: this.getTriggeredRules(userId, trade),
      timestamp: Date.now(),
      status: 'FLAGGED',
      reviewed: false
    };

    this.suspiciousActivities.set(activityId, activity);

    console.log(`[AntiManipulationSystem] Suspicious activity flagged: User ${userId} - Score ${suspicionScore.toFixed(3)}`);

    this.emit('suspiciousActivity', activity);

    // Auto-escalate high-risk activities
    if (suspicionScore > 0.8) {
      this.escalateActivity(activityId);
    }
  }

  /**
   * Get triggered rules for activity
   */
  getTriggeredRules(userId, trade) {
    const triggeredRules = [];

    for (const [ruleId, rule] of this.detectionRules.entries()) {
      try {
        const score = rule.check({ userId, trade, profile: this.userBehaviorProfiles.get(userId) });
        if (score >= rule.threshold) {
          triggeredRules.push({
            ruleId,
            name: rule.name,
            score,
            severity: rule.severity
          });
        }
      } catch (error) {
        console.error(`[AntiManipulationSystem] Rule check error:`, error);
      }
    }

    return triggeredRules;
  }

  /**
   * Escalate high-risk activity
   */
  escalateActivity(activityId) {
    const activity = this.suspiciousActivities.get(activityId);
    if (!activity) return;

    activity.status = 'ESCALATED';
    
    console.log(`[AntiManipulationSystem] Activity escalated: ${activityId}`);
    
    this.emit('activityEscalated', activity);
  }

  /**
   * Analyze all user behavior
   */
  analyzeUserBehavior() {
    for (const [userId, profile] of this.userBehaviorProfiles.entries()) {
      // Calculate overall risk score for user
      const riskScore = this.calculateUserRiskScore(profile);
      profile.riskScore = riskScore;

      if (riskScore > 0.7) {
        this.flagHighRiskUser(userId, riskScore);
      }
    }
  }

  /**
   * Calculate user risk score
   */
  calculateUserRiskScore(profile) {
    if (profile.trades.length === 0) return 0;

    const recentTrades = profile.trades.slice(-100);
    let totalSuspicion = 0;

    for (const trade of recentTrades) {
      totalSuspicion += this.calculateSuspicionScore(profile.userId, trade);
    }

    return Math.min(totalSuspicion / recentTrades.length, 1);
  }

  /**
   * Flag high-risk user
   */
  flagHighRiskUser(userId, riskScore) {
    console.log(`[AntiManipulationSystem] High-risk user flagged: ${userId} - Score ${riskScore.toFixed(3)}`);
    
    this.emit('highRiskUser', {
      userId,
      riskScore,
      timestamp: Date.now()
    });
  }

  /**
   * Get suspicious activities
   */
  getSuspiciousActivities(limit = 50) {
    return Array.from(this.suspiciousActivities.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get user risk profile
   */
  getUserRiskProfile(userId) {
    return this.userBehaviorProfiles.get(userId);
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      totalUsers: this.userBehaviorProfiles.size,
      suspiciousActivities: this.suspiciousActivities.size,
      highRiskUsers: Array.from(this.userBehaviorProfiles.values())
        .filter(profile => profile.riskScore > 0.7).length,
      detectionRules: this.detectionRules.size,
      isMonitoring: this.isMonitoring,
      timestamp: Date.now()
    };
  }

  /**
   * Review suspicious activity (admin function)
   */
  reviewActivity(activityId, reviewerId, status, notes) {
    const activity = this.suspiciousActivities.get(activityId);
    
    if (!activity) {
      throw new Error(`Activity ${activityId} not found`);
    }
    
    activity.status = status;
    activity.reviewed = true;
    activity.reviewedBy = reviewerId;
    activity.reviewedAt = Date.now();
    activity.reviewNotes = notes;
    
    this.suspiciousActivities.set(activityId, activity);
    
    console.log(`[AntiManipulationSystem] Activity ${activityId} reviewed by ${reviewerId}: ${status}`);
    
    this.emit('activityReviewed', {
      activityId,
      reviewerId,
      status,
      notes,
      timestamp: Date.now()
    });
    
    return activity;
  }
}

/**
 * Risk & Trade Management System
 * Main coordinator for all risk management components
 */
class RiskManagementSystem extends EventEmitter {
  constructor(marketDataManager, matchingEngine) {
    super();
    this.marketDataManager = marketDataManager;
    this.matchingEngine = matchingEngine;
    this.positionManager = new PositionManager();
    this.circuitBreakerSystem = new CircuitBreakerSystem(marketDataManager);
    this.antiManipulationSystem = new AntiManipulationSystem();
    this.isRunning = false;
    this.stats = {
      assessmentsPerformed: 0,
      tradesBlocked: 0,
      riskViolations: 0,
      startTime: Date.now()
    };
  }

  /**
   * Start risk management system
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Risk management system is already running');
    }

    console.log('[RiskManagementSystem] Starting risk management system...');

    // Start subsystems
    this.circuitBreakerSystem.start();
    this.antiManipulationSystem.start();

    // Set up event listeners
    this.setupEventListeners();

    this.isRunning = true;
    this.stats.startTime = Date.now();

    console.log('[RiskManagementSystem] Risk management system started');
    this.emit('started');
  }

  /**
   * Stop risk management system
   */
  stop() {
    if (!this.isRunning) return;

    console.log('[RiskManagementSystem] Stopping risk management system...');

    // Stop subsystems
    this.circuitBreakerSystem.stop();
    this.antiManipulationSystem.stop();

    this.isRunning = false;

    console.log('[RiskManagementSystem] Risk management system stopped');
    this.emit('stopped');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for trade executions
    this.matchingEngine.on('tradeExecuted', (data) => {
      this.processTradeRisk(data.trade);
    });

    // Listen for circuit breaker events
    this.circuitBreakerSystem.on('breakerTriggered', (breaker) => {
      this.handleCircuitBreaker(breaker);
    });

    // Listen for suspicious activities
    this.antiManipulationSystem.on('suspiciousActivity', (activity) => {
      this.handleSuspiciousActivity(activity);
    });
  }

  /**
   * Assess order risk before execution
   */
  async assessOrderRisk(orderData) {
    const startTime = process.hrtime.bigint();
    
    try {
      const assessment = new RiskAssessment(orderData);

      // Check position limits
      const positionViolations = this.positionManager.checkPositionLimits(
        orderData.userId,
        orderData.symbol,
        orderData
      );

      for (const violation of positionViolations) {
        assessment.addViolation(violation.type, violation.message, violation.severity);
      }

      // Check for circuit breakers
      const activeBreakers = this.circuitBreakerSystem.getActiveBreakers()
        .filter(breaker => breaker.symbol === orderData.symbol);

      if (activeBreakers.length > 0) {
        assessment.addViolation(
          'CIRCUIT_BREAKER_ACTIVE',
          `Trading halted for ${orderData.symbol}`,
          'CRITICAL'
        );
      }

      // Check user risk profile
      const userProfile = this.antiManipulationSystem.getUserRiskProfile(orderData.userId);
      if (userProfile && userProfile.riskScore > 0.8) {
        assessment.addWarning(
          'HIGH_RISK_USER',
          `User has high risk score: ${userProfile.riskScore.toFixed(3)}`,
          'HIGH'
        );
      }

      // Calculate assessment time
      const endTime = process.hrtime.bigint();
      assessment.assessmentTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Update statistics
      this.stats.assessmentsPerformed++;
      if (!assessment.approved) {
        this.stats.tradesBlocked++;
      }
      if (assessment.violations.length > 0) {
        this.stats.riskViolations++;
      }

      return assessment;

    } catch (error) {
      console.error('[RiskManagementSystem] Risk assessment error:', error);
      
      // Return rejection on error
      const assessment = new RiskAssessment(orderData);
      assessment.addViolation('SYSTEM_ERROR', error.message, 'CRITICAL');
      return assessment;
    }
  }

  /**
   * Process trade risk after execution
   */
  processTradeRisk(trade) {
    try {
      // Update positions
      this.positionManager.updatePosition(trade.takerUserId, trade.symbol, trade);
      if (trade.makerUserId) {
        this.positionManager.updatePosition(trade.makerUserId, trade.symbol, {
          ...trade,
          side: trade.side === 'BUY' ? 'SELL' : 'BUY' // Opposite side for maker
        });
      }

      // Analyze for manipulation
      this.antiManipulationSystem.analyzeTrade(trade);

    } catch (error) {
      console.error('[RiskManagementSystem] Trade risk processing error:', error);
    }
  }

  /**
   * Handle circuit breaker activation
   */
  handleCircuitBreaker(breaker) {
    console.log(`[RiskManagementSystem] Circuit breaker activated: ${breaker.symbol} - ${breaker.type}`);
    
    this.emit('circuitBreakerActivated', breaker);
  }

  /**
   * Handle suspicious activity detection
   */
  handleSuspiciousActivity(activity) {
    console.log(`[RiskManagementSystem] Suspicious activity detected: User ${activity.userId}`);
    
    this.emit('suspiciousActivityDetected', activity);
  }

  /**
   * Get comprehensive risk dashboard data
   */
  getRiskDashboard() {
    return {
      system: {
        isRunning: this.isRunning,
        uptime: Date.now() - this.stats.startTime,
        stats: this.stats
      },
      positions: {
        totalPositions: this.positionManager.positions.size,
        // Additional position metrics would go here
      },
      circuitBreakers: {
        active: this.circuitBreakerSystem.getActiveBreakers().length,
        history: this.circuitBreakerSystem.getBreakerHistory(10)
      },
      manipulation: {
        suspiciousActivities: this.antiManipulationSystem.getSuspiciousActivities(10),
        stats: this.antiManipulationSystem.getStats()
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    return {
      status: this.isRunning ? 'HEALTHY' : 'STOPPED',
      subsystems: {
        positionManager: 'HEALTHY',
        circuitBreakers: this.circuitBreakerSystem.isMonitoring ? 'HEALTHY' : 'STOPPED',
        antiManipulation: this.antiManipulationSystem.isMonitoring ? 'HEALTHY' : 'STOPPED'
      },
      performance: {
        avgAssessmentTime: this.stats.assessmentsPerformed > 0 
          ? this.stats.totalAssessmentTime / this.stats.assessmentsPerformed 
          : 0,
        blockRate: this.stats.assessmentsPerformed > 0 
          ? (this.stats.tradesBlocked / this.stats.assessmentsPerformed) * 100 
          : 0
      },
      timestamp: Date.now()
    };
  }
}

module.exports = {
  RiskManagementSystem,
  PositionManager,
  CircuitBreakerSystem,
  AntiManipulationSystem,
  RiskAssessment
};

