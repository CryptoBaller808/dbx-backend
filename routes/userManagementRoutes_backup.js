/**
 * User Management & Compliance API Routes
 * Comprehensive user management, KYC review, and compliance tools
 */

const express = require('express');
const router = express.Router();
const UserManagementService = require('../services/UserManagementService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

let userManagementService;

// Rate limiting for sensitive operations
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const moderateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Initialize service
const initializeUserManagementService = (io) => {
  const db = require('../models');
  userManagementService = new UserManagementService(db, io);
  return userManagementService;
};

// Middleware to ensure service is initialized
const ensureServiceInitialized = (req, res, next) => {
  if (!userManagementService) {
    return res.status(500).json({
      success: false,
      message: 'User management service not initialized'
    });
  }
  next();
};

// User Management Routes

/**
 * @route GET /users
 * @desc Get all users with filtering and pagination
 * @access Admin, Moderator
 */
router.get('/users', 
  moderateRateLimit,
  authenticateToken, 
  requireRole(['admin', 'moderator']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        kycStatus: req.query.kycStatus,
        userTier: req.query.userTier,
        status: req.query.status,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      const result = await userManagementService.getAllUsers(filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /users/:userId
 * @desc Get detailed user profile
 * @access Admin, Moderator
 */
router.get('/users/:userId', 
  moderateRateLimit,
  authenticateToken, 
  requireRole(['admin', 'moderator']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await userManagementService.getUserProfile(userId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /users/:userId/status
 * @desc Update user status (suspend, ban, activate)
 * @access Admin
 */
router.put('/users/:userId/status', 
  strictRateLimit,
  authenticateToken, 
  requireRole(['admin']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, reason } = req.body;
      const adminId = req.user.id;

      if (!status || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Status and reason are required'
        });
      }

      const validStatuses = ['active', 'suspended', 'banned', 'inactive'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      const result = await userManagementService.updateUserStatus(userId, status, reason, adminId);
      
      res.json(result);
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user status',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /users/:userId/flag
 * @desc Flag user for suspicious activity
 * @access Admin, Moderator
 */
router.post('/users/:userId/flag', 
  strictRateLimit,
  authenticateToken, 
  requireRole(['admin', 'moderator']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { flagType, reason } = req.body;
      const adminId = req.user.id;

      if (!flagType || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Flag type and reason are required'
        });
      }

      const validFlagTypes = ['suspicious_activity', 'fraud', 'money_laundering', 'sanctions_check', 'other'];
      if (!validFlagTypes.includes(flagType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid flag type'
        });
      }

      const result = await userManagementService.flagUser(userId, flagType, reason, adminId);
      
      res.json(result);
    } catch (error) {
      console.error('Error flagging user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to flag user',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /users/:userId/role
 * @desc Assign role to user
 * @access Admin
 */
router.put('/users/:userId/role', 
  strictRateLimit,
  authenticateToken, 
  requireRole(['admin']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const adminId = req.user.id;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      const validRoles = ['user', 'moderator', 'admin', 'auditor', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
      }

      const result = await userManagementService.assignRole(userId, role, adminId);
      
      res.json(result);
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign role',
        error: error.message
      });
    }
  }
);

// KYC Management Routes

/**
 * @route GET /kyc/queue
 * @desc Get KYC applications queue
 * @access Admin, Auditor
 */
router.get('/kyc/queue', 
  moderateRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status || 'pending',
        priority: req.query.priority,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      const result = await userManagementService.getKYCQueue(filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching KYC queue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch KYC queue',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /kyc/applications/:applicationId
 * @desc Get detailed KYC application
 * @access Admin, Auditor
 */
router.get('/kyc/applications/:applicationId', 
  moderateRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const result = await userManagementService.getKYCApplication(applicationId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching KYC application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch KYC application',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /kyc/applications/:applicationId/review
 * @desc Review KYC application (approve/reject)
 * @access Admin, Auditor
 */
router.post('/kyc/applications/:applicationId/review', 
  strictRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { decision, comments } = req.body;
      const reviewerId = req.user.id;

      if (!decision || !comments) {
        return res.status(400).json({
          success: false,
          message: 'Decision and comments are required'
        });
      }

      if (!['approve', 'reject'].includes(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Decision must be either approve or reject'
        });
      }

      const result = await userManagementService.reviewKYCApplication(
        applicationId, 
        decision, 
        comments, 
        reviewerId
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error reviewing KYC application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to review KYC application',
        error: error.message
      });
    }
  }
);

// Compliance Routes

/**
 * @route GET /compliance/events
 * @desc Get compliance events with filtering
 * @access Admin, Auditor
 */
router.get('/compliance/events', 
  moderateRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        severity: req.query.severity,
        eventType: req.query.eventType,
        status: req.query.status,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      const result = await userManagementService.getComplianceEvents(filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching compliance events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch compliance events',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /compliance/events/:eventId/resolve
 * @desc Resolve compliance event
 * @access Admin, Auditor
 */
router.post('/compliance/events/:eventId/resolve', 
  strictRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { resolution, comments } = req.body;
      const adminId = req.user.id;

      if (!resolution || !comments) {
        return res.status(400).json({
          success: false,
          message: 'Resolution and comments are required'
        });
      }

      // Update compliance event
      const db = require('../models');
      await db.sequelize.query(`
        UPDATE compliance_events 
        SET status = 'resolved',
            resolution = :resolution,
            resolved_by = :adminId,
            resolved_at = NOW(),
            resolution_comments = :comments
        WHERE id = :eventId
      `, {
        replacements: { resolution, adminId, comments, eventId }
      });

      // Log the action
      await userManagementService.logAdminAction(adminId, 'compliance_event_resolved', {
        eventId,
        resolution,
        comments
      });
      
      res.json({
        success: true,
        message: 'Compliance event resolved successfully'
      });
    } catch (error) {
      console.error('Error resolving compliance event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve compliance event',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /compliance/manual-check
 * @desc Trigger manual compliance check
 * @access Admin
 */
router.post('/compliance/manual-check', 
  strictRateLimit,
  authenticateToken, 
  requireRole(['admin']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const { checkType } = req.body;
      const adminId = req.user.id;

      if (!checkType) {
        return res.status(400).json({
          success: false,
          message: 'Check type is required'
        });
      }

      const validCheckTypes = ['suspicious_activities', 'sanctions_check', 'aml_alerts'];
      if (!validCheckTypes.includes(checkType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid check type'
        });
      }

      // Trigger the appropriate check
      switch (checkType) {
        case 'suspicious_activities':
          await userManagementService.checkSuspiciousActivities();
          break;
        case 'sanctions_check':
          await userManagementService.performSanctionsCheck();
          break;
        case 'aml_alerts':
          await userManagementService.generateAMLAlerts();
          break;
      }

      // Log the action
      await userManagementService.logAdminAction(adminId, 'manual_compliance_check', {
        checkType
      });
      
      res.json({
        success: true,
        message: `${checkType} check completed successfully`
      });
    } catch (error) {
      console.error('Error performing manual compliance check:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform compliance check',
        error: error.message
      });
    }
  }
);

// Statistics Routes

/**
 * @route GET /statistics/users
 * @desc Get user statistics
 * @access Admin, Auditor, Viewer
 */
router.get('/statistics/users', 
  moderateRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor', 'viewer']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const stats = await userManagementService.getUserStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user statistics',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /statistics/compliance
 * @desc Get compliance statistics
 * @access Admin, Auditor, Viewer
 */
router.get('/statistics/compliance', 
  moderateRateLimit,
  authenticateToken, 
  requireRole(['admin', 'auditor', 'viewer']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const stats = await userManagementService.getComplianceStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching compliance statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch compliance statistics',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /health
 * @desc Health check for user management service
 * @access Admin
 */
router.get('/health', 
  authenticateToken, 
  requireRole(['admin']), 
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const db = require('../models');
      
      // Test database connection
      await db.sequelize.authenticate();
      
      // Get service status
      const status = {
        service: 'healthy',
        database: 'connected',
        timestamp: new Date(),
        uptime: process.uptime()
      };
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Service health check failed',
        error: error.message
      });
    }
  }
);

module.exports = {
  router,
  initializeUserManagementService
};

