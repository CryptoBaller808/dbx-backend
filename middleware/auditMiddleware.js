const AuditLogger = require('../services/auditLogger');

/**
 * Audit Logging Middleware for DBX Platform
 * Automatically logs all API requests and responses for compliance and monitoring
 */

/**
 * Main audit logging middleware
 */
const auditMiddleware = (options = {}) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Skip audit logging for health checks and static assets
    if (shouldSkipAudit(req)) {
      return next();
    }
    
    // Store original send method
    const originalSend = res.send;
    
    // Override send method to capture response
    res.send = function(data) {
      const responseTime = Date.now() - startTime;
      
      // Log API access asynchronously
      setImmediate(() => {
        AuditLogger.logAPIAccess(req, res, responseTime);
      });
      
      // Call original send method
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Authentication audit middleware
 */
const auditAuth = (eventType) => {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send;
    
    res.send = function(data) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Log authentication event asynchronously
      setImmediate(() => {
        AuditLogger.logUserAuth(eventType, req, req.user, {
          success,
          response_code: res.statusCode,
          error_message: !success ? responseData.message || responseData.error : null
        });
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Transaction audit middleware
 */
const auditTransaction = (eventType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Extract transaction data from request and response
      const transactionData = {
        ...req.body,
        ...responseData.data,
        success,
        response_code: res.statusCode,
        error_message: !success ? responseData.message || responseData.error : null
      };
      
      // Log transaction event asynchronously
      setImmediate(() => {
        AuditLogger.logTransaction(eventType, req, req.user, transactionData);
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * NFT audit middleware
 */
const auditNFT = (eventType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Extract NFT data from request and response
      const nftData = {
        ...req.body,
        ...responseData.data,
        success,
        response_code: res.statusCode,
        error_message: !success ? responseData.message || responseData.error : null
      };
      
      // Log NFT event asynchronously
      setImmediate(() => {
        AuditLogger.logNFT(eventType, req, req.user, nftData);
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Admin action audit middleware
 */
const auditAdmin = (eventType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Extract admin action data
      const actionData = {
        ...req.body,
        target_user_id: req.params.userId || req.body.userId,
        resource_type: getResourceTypeFromPath(req.originalUrl),
        resource_id: req.params.id || req.body.id,
        success,
        response_code: res.statusCode,
        error_message: !success ? responseData.message || responseData.error : null
      };
      
      // Log admin action asynchronously
      setImmediate(() => {
        AuditLogger.logAdminAction(eventType, req, req.user, actionData);
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Security event audit middleware
 */
const auditSecurity = (eventType, details = {}) => {
  return async (req, res, next) => {
    // Log security event immediately
    setImmediate(() => {
      AuditLogger.logSecurityEvent(eventType, req, {
        ...details,
        user_id: req.user?.id,
        user_email: req.user?.email,
        request_body: req.body,
        query_params: req.query
      });
    });
    
    next();
  };
};

/**
 * MFA audit middleware
 */
const auditMFA = (eventType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Log MFA event asynchronously
      setImmediate(() => {
        AuditLogger.logUserAuth(eventType, req, req.user, {
          success,
          response_code: res.statusCode,
          mfa_method: req.body.method || 'TOTP',
          error_message: !success ? responseData.message || responseData.error : null
        });
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Rate limit audit middleware
 */
const auditRateLimit = () => {
  return async (req, res, next) => {
    // Check if rate limit was hit
    if (res.statusCode === 429) {
      setImmediate(() => {
        AuditLogger.logSecurityEvent('SECURITY_RATE_LIMIT_HIT', req, {
          description: 'Rate limit exceeded',
          endpoint: req.originalUrl,
          method: req.method,
          user_id: req.user?.id,
          user_email: req.user?.email
        });
      });
    }
    
    next();
  };
};

/**
 * Validation failure audit middleware
 */
const auditValidationFailure = () => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Check if this is a validation error
      if (res.statusCode === 400) {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (responseData.error && responseData.error.includes('validation')) {
          setImmediate(() => {
            AuditLogger.logSecurityEvent('SECURITY_VALIDATION_FAILED', req, {
              description: 'Input validation failed',
              validation_errors: responseData.errors || responseData.error,
              user_id: req.user?.id,
              user_email: req.user?.email
            });
          });
        }
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Helper functions
 */
function shouldSkipAudit(req) {
  const skipPaths = [
    '/health',
    '/api/health',
    '/favicon.ico',
    '/static/',
    '/assets/',
    '/ping'
  ];
  
  return skipPaths.some(path => req.originalUrl.includes(path));
}

function getResourceTypeFromPath(path) {
  if (path.includes('/users')) return 'USER';
  if (path.includes('/transactions')) return 'TRANSACTION';
  if (path.includes('/nft')) return 'NFT';
  if (path.includes('/settings')) return 'SETTINGS';
  if (path.includes('/admin')) return 'ADMIN';
  return 'UNKNOWN';
}

/**
 * Audit log query middleware for admin dashboard
 */
const auditLogQuery = async (req, res, next) => {
  try {
    const { audit_logs } = require('../models');
    const { Op } = require('sequelize');
    
    // Parse query parameters
    const {
      event_type,
      severity,
      user_id,
      start_date,
      end_date,
      ip_address,
      status,
      page = 1,
      limit = 50
    } = req.query;
    
    // Build where clause
    const where = {};
    
    if (event_type) where.event_type = event_type;
    if (severity) where.severity = severity;
    if (user_id) where.user_id = user_id;
    if (ip_address) where.ip_address = ip_address;
    if (status) where.status = status;
    
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }
    
    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Query audit logs
    const { count, rows } = await audit_logs.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      include: [{
        model: require('../models').users,
        as: 'user',
        attributes: ['id', 'email', 'wallet'],
        required: false
      }]
    });
    
    // Add query results to request
    req.auditLogs = {
      logs: rows.map(log => log.toSafeJSON()),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit))
      }
    };
    
    next();
  } catch (error) {
    console.error('[Audit Middleware] Query failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query audit logs'
    });
  }
};

module.exports = {
  auditMiddleware,
  auditAuth,
  auditTransaction,
  auditNFT,
  auditAdmin,
  auditSecurity,
  auditMFA,
  auditRateLimit,
  auditValidationFailure,
  auditLogQuery
};

