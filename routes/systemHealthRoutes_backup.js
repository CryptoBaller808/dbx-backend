/**
 * System Health Monitoring API Routes
 * Comprehensive system health monitoring, alerting, and performance tracking
 */

const express = require('express');
const router = express.Router();
const SystemHealthMonitoringService = require('../services/SystemHealthMonitoringService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

let healthMonitoringService;

// Rate limiting for monitoring endpoints
const monitoringRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute
  message: 'Too many monitoring requests from this IP, please try again later.'
});

// Initialize service
const initializeHealthMonitoringService = (io) => {
  const db = require('../models');
  healthMonitoringService = new SystemHealthMonitoringService(db, io);
  return healthMonitoringService;
};

// Middleware to ensure service is initialized
const ensureServiceInitialized = (req, res, next) => {
  if (!healthMonitoringService) {
    return res.status(500).json({
      success: false,
      message: 'Health monitoring service not initialized'
    });
  }
  next();
};

// System Health Routes

/**
 * @route GET /health/status
 * @desc Get current system health status
 * @access Admin, Auditor, Viewer
 */
router.get('/health/status', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor', 'viewer']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const status = healthMonitoringService.getCurrentStatus();
      
      if (!status) {
        return res.status(503).json({
          success: false,
          message: 'Health data not available yet'
        });
      }
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error fetching system health status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system health status',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /health/check
 * @desc Trigger manual health check
 * @access Admin
 */
router.post('/health/check', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const healthData = await healthMonitoringService.performHealthChecks();
      
      res.json({
        success: true,
        message: 'Health check completed',
        data: healthData
      });
    } catch (error) {
      console.error('Error performing health check:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform health check',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /health/metrics/history
 * @desc Get system metrics history
 * @access Admin, Auditor, Viewer
 */
router.get('/health/metrics/history', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor', 'viewer']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;
      
      const validTimeRanges = ['1h', '24h', '7d', '30d'];
      if (!validTimeRanges.includes(timeRange)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time range. Valid options: 1h, 24h, 7d, 30d'
        });
      }

      const metrics = await healthMonitoringService.getMetricsHistory(timeRange);
      
      res.json({
        success: true,
        data: {
          timeRange,
          metrics,
          count: metrics.length
        }
      });
    } catch (error) {
      console.error('Error fetching metrics history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch metrics history',
        error: error.message
      });
    }
  }
);

// Alert Management Routes

/**
 * @route GET /alerts
 * @desc Get recent alerts
 * @access Admin, Auditor, Viewer
 */
router.get('/alerts', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor', 'viewer']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const alerts = healthMonitoringService.getRecentAlerts(parseInt(limit));
      
      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length
        }
      });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alerts',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /alerts/:alertId/resolve
 * @desc Resolve an alert
 * @access Admin, Auditor
 */
router.post('/alerts/:alertId/resolve', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { alertId } = req.params;
      const { resolution } = req.body;
      const adminId = req.user.id;

      if (!resolution) {
        return res.status(400).json({
          success: false,
          message: 'Resolution description is required'
        });
      }

      const resolvedAlert = await healthMonitoringService.resolveAlert(alertId, adminId, resolution);
      
      res.json({
        success: true,
        message: 'Alert resolved successfully',
        data: resolvedAlert
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve alert',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /alerts/statistics
 * @desc Get alert statistics
 * @access Admin, Auditor, Viewer
 */
router.get('/alerts/statistics', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor', 'viewer']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;
      
      const validTimeRanges = ['1h', '24h', '7d', '30d'];
      if (!validTimeRanges.includes(timeRange)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time range. Valid options: 1h, 24h, 7d, 30d'
        });
      }

      const statistics = await healthMonitoringService.getAlertStatistics(timeRange);
      
      res.json({
        success: true,
        data: {
          timeRange,
          statistics
        }
      });
    } catch (error) {
      console.error('Error fetching alert statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alert statistics',
        error: error.message
      });
    }
  }
);

// Configuration Routes

/**
 * @route PUT /alerts/thresholds
 * @desc Update alert thresholds
 * @access Admin
 */
router.put('/alerts/thresholds', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { thresholds } = req.body;

      if (!thresholds || typeof thresholds !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Valid thresholds object is required'
        });
      }

      // Validate threshold values
      const validThresholds = ['cpu_usage', 'memory_usage', 'disk_usage', 'api_response_time', 'database_latency', 'error_rate'];
      const invalidThresholds = Object.keys(thresholds).filter(key => !validThresholds.includes(key));
      
      if (invalidThresholds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid threshold keys: ${invalidThresholds.join(', ')}`
        });
      }

      healthMonitoringService.updateAlertThresholds(thresholds);
      
      res.json({
        success: true,
        message: 'Alert thresholds updated successfully',
        data: { thresholds }
      });
    } catch (error) {
      console.error('Error updating alert thresholds:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update alert thresholds',
        error: error.message
      });
    }
  }
);

// Performance Monitoring Routes

/**
 * @route POST /performance/api-metrics
 * @desc Record API performance metrics
 * @access Internal (middleware use)
 */
router.post('/performance/api-metrics', 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { responseTime, success } = req.body;

      if (typeof responseTime !== 'number' || typeof success !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Valid responseTime (number) and success (boolean) are required'
        });
      }

      healthMonitoringService.recordAPIMetrics(responseTime, success);
      
      res.json({
        success: true,
        message: 'API metrics recorded'
      });
    } catch (error) {
      console.error('Error recording API metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record API metrics',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /performance/reset-metrics
 * @desc Reset performance metrics
 * @access Admin
 */
router.post('/performance/reset-metrics', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      healthMonitoringService.resetMetrics();
      
      res.json({
        success: true,
        message: 'Performance metrics reset successfully'
      });
    } catch (error) {
      console.error('Error resetting metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset metrics',
        error: error.message
      });
    }
  }
);

// System Information Routes

/**
 * @route GET /system/info
 * @desc Get basic system information
 * @access Admin, Auditor, Viewer
 */
router.get('/system/info', 
  monitoringRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor', 'viewer']), 
  async (req, res) => {
    try {
      const os = require('os');
      
      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        node_version: process.version,
        memory: {
          total: os.totalmem(),
          free: os.freemem()
        },
        cpu: {
          model: os.cpus()[0]?.model || 'Unknown',
          cores: os.cpus().length,
          speed: os.cpus()[0]?.speed || 0
        },
        network: os.networkInterfaces()
      };
      
      res.json({
        success: true,
        data: systemInfo
      });
    } catch (error) {
      console.error('Error fetching system info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system information',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /health
 * @desc Health check endpoint for the monitoring service itself
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const status = {
      service: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      monitoring_active: !!healthMonitoringService
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

module.exports = {
  router,
  initializeHealthMonitoringService
};

