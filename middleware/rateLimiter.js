/**
 * rateLimiter.js
 * Stage 7.1: Rate Limiting for Live Execution
 * 
 * Tracks and enforces trade limits per wallet address
 */

const executionConfig = require('../config/executionConfig');

// In-memory store for trade counts (per wallet address)
// Format: { walletAddress: { count: number, resetTime: timestamp } }
const tradeCounts = new Map();

/**
 * Clean up expired entries (older than 1 hour)
 */
function cleanup() {
  const now = Date.now();
  for (const [wallet, data] of tradeCounts.entries()) {
    if (now >= data.resetTime) {
      tradeCounts.delete(wallet);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

/**
 * Check if wallet has exceeded rate limit
 * @param {string} walletAddress - Wallet address
 * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
 */
function checkRateLimit(walletAddress) {
  const maxTrades = executionConfig.maxTradesPerHour;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  if (!tradeCounts.has(walletAddress)) {
    // First trade for this wallet
    return {
      allowed: true,
      remaining: maxTrades - 1,
      resetTime: now + oneHour
    };
  }
  
  const data = tradeCounts.get(walletAddress);
  
  // Check if reset time has passed
  if (now >= data.resetTime) {
    // Reset counter
    return {
      allowed: true,
      remaining: maxTrades - 1,
      resetTime: now + oneHour
    };
  }
  
  // Check if limit exceeded
  if (data.count >= maxTrades) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: data.resetTime,
      retryAfter: Math.ceil((data.resetTime - now) / 1000) // seconds
    };
  }
  
  // Within limit
  return {
    allowed: true,
    remaining: maxTrades - data.count - 1,
    resetTime: data.resetTime
  };
}

/**
 * Record a trade for a wallet
 * @param {string} walletAddress - Wallet address
 */
function recordTrade(walletAddress) {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  if (!tradeCounts.has(walletAddress)) {
    tradeCounts.set(walletAddress, {
      count: 1,
      resetTime: now + oneHour
    });
  } else {
    const data = tradeCounts.get(walletAddress);
    
    // Check if reset time has passed
    if (now >= data.resetTime) {
      // Reset counter
      tradeCounts.set(walletAddress, {
        count: 1,
        resetTime: now + oneHour
      });
    } else {
      // Increment counter
      data.count++;
    }
  }
}

/**
 * Express middleware to enforce rate limiting
 */
function rateLimitMiddleware(req, res, next) {
  const { walletAddress, executionMode } = req.body;
  
  // Only apply rate limiting to live execution
  if (executionMode !== 'live') {
    return next();
  }
  
  if (!walletAddress) {
    return res.status(400).json({
      success: false,
      errorCode: 'WALLET_NOT_CONNECTED',
      message: 'Wallet address is required for live execution'
    });
  }
  
  // QA Bypass: Skip rate limiting if QA bypass flag is enabled
  if (process.env.LIVE_EXECUTION_QA_BYPASS === 'true') {
    console.log(`[LiveExecute] QA rate-limit bypass active for wallet ${walletAddress}`);
    return next();
  }
  
  const limit = checkRateLimit(walletAddress);
  
  if (!limit.allowed) {
    return res.status(429).json({
      success: false,
      errorCode: 'LIVE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Maximum ${executionConfig.maxTradesPerHour} trades per hour.`,
      retryAfter: limit.retryAfter,
      resetTime: limit.resetTime
    });
  }
  
  // Attach rate limit info to request for logging
  req.rateLimit = limit;
  
  next();
}

module.exports = {
  checkRateLimit,
  recordTrade,
  rateLimitMiddleware
};
