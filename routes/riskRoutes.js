/**
 * Risk Management API Routes for DBX Trading Platform
 * Provides comprehensive risk monitoring, circuit breaker management, and audit trail access
 */

const express = require('express');
const router = express.Router();
const { RiskManagementSystem } = require('../services/trading/RiskManagementSystem');

// Initialize risk management system (this would typically be injected)
let riskManagementSystem = null;

/**
 * Initialize risk management system
 */
const initializeRiskSystem = (marketDataManager, matchingEngine) => {
  if (!riskManagementSystem) {
    riskManagementSystem = new RiskManagementSystem(marketDataManager, matchingEngine);
  }
  return riskManagementSystem;
};

/**
 * Middleware to ensure risk system is initialized
 */
const ensureRiskSystem = (req, res, next) => {
  if (!riskManagementSystem) {
    return res.status(503).json({
      success: false,
      error: 'Risk management system not initialized'
    });
  }
  next();
};

/**
 * GET /api/risk/dashboard
 * Get comprehensive risk dashboard data
 */
router.get('/dashboard', ensureRiskSystem, async (req, res) => {
  try {
    const dashboardData = riskManagementSystem.getRiskDashboard();
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve risk dashboard data',
      details: error.message
    });
  }
});

/**
 * GET /api/risk/health
 * Get risk management system health status
 */
router.get('/health', ensureRiskSystem, async (req, res) => {
  try {
    const healthStatus = riskManagementSystem.getHealthStatus();
    
    res.json({
      success: true,
      data: healthStatus,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status',
      details: error.message
    });
  }
});

/**
 * POST /api/risk/assess-order
 * Assess risk for a potential order
 */
router.post('/assess-order', ensureRiskSystem, async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate required fields
    const requiredFields = ['userId', 'symbol', 'quantity', 'price', 'side', 'orderType'];
    const missingFields = requiredFields.filter(field => !orderData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        missingFields
      });
    }
    
    const assessment = await riskManagementSystem.assessOrderRisk(orderData);
    
    res.json({
      success: true,
      data: assessment.toJSON(),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Order assessment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess order risk',
      details: error.message
    });
  }
});

/**
 * GET /api/risk/positions/:userId
 * Get user positions and risk metrics
 */
router.get('/positions/:userId', ensureRiskSystem, async (req, res) => {
  try {
    const { userId } = req.params;
    const { symbol } = req.query;
    
    if (symbol) {
      // Get specific position
      const position = riskManagementSystem.positionManager.getPosition(userId, symbol);
      res.json({
        success: true,
        data: position,
        timestamp: Date.now()
      });
    } else {
      // Get all positions for user
      const positions = riskManagementSystem.positionManager.getUserPositions(userId);
      res.json({
        success: true,
        data: positions,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('[RiskRoutes] Positions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve positions',
      details: error.message
    });
  }
});

/**
 * GET /api/risk/circuit-breakers
 * Get active circuit breakers
 */
router.get('/circuit-breakers', ensureRiskSystem, async (req, res) => {
  try {
    const activeBreakers = riskManagementSystem.circuitBreakerSystem.getActiveBreakers();
    const breakerHistory = riskManagementSystem.circuitBreakerSystem.getBreakerHistory(50);
    
    res.json({
      success: true,
      data: {
        active: activeBreakers,
        history: breakerHistory,
        count: activeBreakers.length
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Circuit breakers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve circuit breaker data',
      details: error.message
    });
  }
});

/**
 * POST /api/risk/circuit-breakers/:symbol/reset
 * Reset circuit breaker for a symbol (admin only)
 */
router.post('/circuit-breakers/:symbol/reset', ensureRiskSystem, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { adminId } = req.body;
    
    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'Admin ID required for circuit breaker reset'
      });
    }
    
    const result = riskManagementSystem.circuitBreakerSystem.resetBreaker(symbol, adminId);
    
    res.json({
      success: true,
      data: result,
      message: `Circuit breaker reset for ${symbol}`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Circuit breaker reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset circuit breaker',
      details: error.message
    });
  }
});

/**
 * GET /api/risk/suspicious-activities
 * Get suspicious trading activities
 */
router.get('/suspicious-activities', ensureRiskSystem, async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    let activities = riskManagementSystem.antiManipulationSystem.getSuspiciousActivities(parseInt(limit));
    
    // Filter by status if provided
    if (status) {
      activities = activities.filter(activity => activity.status === status);
    }
    
    const stats = riskManagementSystem.antiManipulationSystem.getStats();
    
    res.json({
      success: true,
      data: {
        activities,
        stats,
        count: activities.length
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Suspicious activities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve suspicious activities',
      details: error.message
    });
  }
});

/**
 * POST /api/risk/suspicious-activities/:activityId/review
 * Review and update suspicious activity status
 */
router.post('/suspicious-activities/:activityId/review', ensureRiskSystem, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { reviewerId, status, notes } = req.body;
    
    if (!reviewerId || !status) {
      return res.status(400).json({
        success: false,
        error: 'Reviewer ID and status are required'
      });
    }
    
    const result = riskManagementSystem.antiManipulationSystem.reviewActivity(
      activityId, 
      reviewerId, 
      status, 
      notes
    );
    
    res.json({
      success: true,
      data: result,
      message: 'Activity review updated',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Activity review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update activity review',
      details: error.message
    });
  }
});

/**
 * GET /api/risk/user-profile/:userId
 * Get user risk profile and behavior analysis
 */
router.get('/user-profile/:userId', ensureRiskSystem, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userProfile = riskManagementSystem.antiManipulationSystem.getUserRiskProfile(userId);
    const userPositions = riskManagementSystem.positionManager.getUserPositions(userId);
    const userLimits = riskManagementSystem.positionManager.getUserLimits(userId);
    
    res.json({
      success: true,
      data: {
        profile: userProfile,
        positions: userPositions,
        limits: userLimits
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] User profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user risk profile',
      details: error.message
    });
  }
});

/**
 * POST /api/risk/user-limits/:userId
 * Update user risk limits (admin only)
 */
router.post('/user-limits/:userId', ensureRiskSystem, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limits, adminId } = req.body;
    
    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'Admin ID required for limit updates'
      });
    }
    
    const result = riskManagementSystem.positionManager.setUserLimits(userId, limits);
    
    res.json({
      success: true,
      data: result,
      message: 'User limits updated',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] User limits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user limits',
      details: error.message
    });
  }
});

/**
 * GET /api/risk/statistics
 * Get comprehensive risk management statistics
 */
router.get('/statistics', ensureRiskSystem, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const riskStats = {
      system: riskManagementSystem.stats,
      positions: {
        totalPositions: riskManagementSystem.positionManager.positions.size,
        totalUsers: new Set(Array.from(riskManagementSystem.positionManager.positions.keys())
          .map(key => key.split(':')[0])).size
      },
      circuitBreakers: {
        active: riskManagementSystem.circuitBreakerSystem.getActiveBreakers().length,
        totalTriggered: riskManagementSystem.circuitBreakerSystem.getBreakerHistory().length
      },
      manipulation: riskManagementSystem.antiManipulationSystem.getStats(),
      performance: riskManagementSystem.getHealthStatus().performance
    };
    
    res.json({
      success: true,
      data: riskStats,
      timeframe,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve risk statistics',
      details: error.message
    });
  }
});

/**
 * POST /api/risk/start
 * Start risk management system (admin only)
 */
router.post('/start', async (req, res) => {
  try {
    const { adminId } = req.body;
    
    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'Admin ID required to start risk system'
      });
    }
    
    if (!riskManagementSystem) {
      return res.status(503).json({
        success: false,
        error: 'Risk management system not initialized'
      });
    }
    
    await riskManagementSystem.start();
    
    res.json({
      success: true,
      message: 'Risk management system started',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Start system error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start risk management system',
      details: error.message
    });
  }
});

/**
 * POST /api/risk/stop
 * Stop risk management system (admin only)
 */
router.post('/stop', ensureRiskSystem, async (req, res) => {
  try {
    const { adminId } = req.body;
    
    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'Admin ID required to stop risk system'
      });
    }
    
    riskManagementSystem.stop();
    
    res.json({
      success: true,
      message: 'Risk management system stopped',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[RiskRoutes] Stop system error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop risk management system',
      details: error.message
    });
  }
});

// Export router and initialization function
module.exports = {
  router,
  initializeRiskSystem
};

