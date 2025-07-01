const { databaseManager } = require('../data/databaseManager');
const config = require('../data/config');

/**
 * Database Security Middleware for DBX Platform
 * Implements query validation, connection security,
 * and performance monitoring for all database operations
 */

/**
 * Database connection security middleware
 */
const secureConnection = async (req, res, next) => {
  try {
    // Import Sequelize models for fallback
    const db = require('../models');
    
    // Check if database manager is initialized, fallback to Sequelize models
    if (!databaseManager.isInitialized) {
      // Try to use Sequelize models as fallback
      if (db && db.sequelize) {
        try {
          await db.sequelize.authenticate();
          console.log('[DB Security] Using Sequelize models as database connection');
          
          // Add Sequelize connection to request
          req.db = {
            primary: db.sequelize,
            readReplica: db.sequelize,
            sequelize: db.sequelize,
            models: db
          };
          
          return next();
        } catch (sequelizeError) {
          console.error('[DB Security] Sequelize connection failed:', sequelizeError);
          return res.status(503).json({
            success: false,
            error: 'Database service unavailable',
            code: 'DB_NOT_INITIALIZED',
            details: 'Both databaseManager and Sequelize unavailable'
          });
        }
      } else {
        return res.status(503).json({
          success: false,
          error: 'Database service unavailable',
          code: 'DB_NOT_INITIALIZED'
        });
      }
    }

    // Check database health
    const healthStatus = await databaseManager.checkHealth();
    
    if (healthStatus.primary !== 'healthy') {
      return res.status(503).json({
        success: false,
        error: 'Primary database unhealthy',
        code: 'DB_PRIMARY_UNHEALTHY'
      });
    }

    // Add database connection to request
    req.db = {
      primary: databaseManager.primaryConnection,
      readReplica: databaseManager.readReplicaConnection,
      manager: databaseManager
    };

    next();
  } catch (error) {
    console.error('[DB Security] Connection security check failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Database security check failed',
      code: 'DB_SECURITY_ERROR'
    });
  }
};

/**
 * Query validation middleware
 */
const validateQuery = (options = {}) => {
  return (req, res, next) => {
    try {
      // Validate query parameters
      if (req.body.query || req.query.sql) {
        // Prevent raw SQL queries from client
        return res.status(400).json({
          success: false,
          error: 'Raw SQL queries not allowed',
          code: 'RAW_QUERY_FORBIDDEN'
        });
      }

      // Validate pagination parameters
      if (req.query.page) {
        const page = parseInt(req.query.page);
        if (isNaN(page) || page < 1 || page > 1000) {
          return res.status(400).json({
            success: false,
            error: 'Invalid page parameter',
            code: 'INVALID_PAGINATION'
          });
        }
      }

      if (req.query.limit) {
        const limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          return res.status(400).json({
            success: false,
            error: 'Invalid limit parameter',
            code: 'INVALID_PAGINATION'
          });
        }
      }

      // Add validated pagination to request
      req.pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        offset: ((parseInt(req.query.page) || 1) - 1) * (parseInt(req.query.limit) || 20)
      };

      next();
    } catch (error) {
      console.error('[DB Security] Query validation failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Query validation failed',
        code: 'QUERY_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Transaction security middleware
 */
const secureTransaction = async (req, res, next) => {
  try {
    // Start database transaction for write operations
    if (req.method !== 'GET') {
      const transaction = await databaseManager.primaryConnection.transaction({
        isolationLevel: 'READ_COMMITTED',
        autocommit: false
      });

      req.transaction = transaction;

      // Auto-rollback on error
      res.on('error', async () => {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }
      });

      // Auto-commit on success
      const originalSend = res.send;
      res.send = function(data) {
        if (transaction && !transaction.finished) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            transaction.commit().then(() => {
              originalSend.call(this, data);
            }).catch((error) => {
              console.error('[DB Security] Transaction commit failed:', error);
              transaction.rollback();
              this.status(500).json({
                success: false,
                error: 'Transaction commit failed'
              });
            });
          } else {
            transaction.rollback().then(() => {
              originalSend.call(this, data);
            }).catch((error) => {
              console.error('[DB Security] Transaction rollback failed:', error);
              originalSend.call(this, data);
            });
          }
        } else {
          originalSend.call(this, data);
        }
      };
    }

    next();
  } catch (error) {
    console.error('[DB Security] Transaction security setup failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Transaction security setup failed',
      code: 'TRANSACTION_SECURITY_ERROR'
    });
  }
};

/**
 * Query performance monitoring middleware
 */
const monitorPerformance = (req, res, next) => {
  // Add query performance tracking
  req.queryMetrics = {
    startTime: Date.now(),
    queries: []
  };

  // Override database query methods to track performance
  if (req.db) {
    const originalQuery = req.db.manager.executeQuery;
    req.db.manager.executeQuery = async function(sql, options = {}) {
      const queryStart = Date.now();
      
      try {
        const result = await originalQuery.call(this, sql, options);
        const queryTime = Date.now() - queryStart;
        
        req.queryMetrics.queries.push({
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          executionTime: queryTime,
          timestamp: new Date().toISOString()
        });
        
        return result;
      } catch (error) {
        const queryTime = Date.now() - queryStart;
        
        req.queryMetrics.queries.push({
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          executionTime: queryTime,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      }
    };
  }

  // Add performance metrics to response headers
  const originalSend = res.send;
  res.send = function(data) {
    const totalTime = Date.now() - req.queryMetrics.startTime;
    const queryCount = req.queryMetrics.queries.length;
    const totalQueryTime = req.queryMetrics.queries.reduce((sum, q) => sum + q.executionTime, 0);
    
    this.set({
      'X-DB-Query-Count': queryCount,
      'X-DB-Query-Time': totalQueryTime,
      'X-DB-Total-Time': totalTime
    });
    
    // Log slow requests
    if (totalTime > 5000) { // 5 seconds
      console.warn(`[DB Performance] Slow request: ${req.method} ${req.path} - ${totalTime}ms`);
      console.warn(`[DB Performance] Queries: ${JSON.stringify(req.queryMetrics.queries, null, 2)}`);
    }
    
    originalSend.call(this, data);
  };

  next();
};

/**
 * Database health check endpoint middleware
 */
const healthCheck = async (req, res, next) => {
  try {
    const healthStatus = await databaseManager.checkHealth();
    const poolStatus = databaseManager.getPoolStatus();
    
    res.json({
      success: true,
      health: healthStatus,
      pools: poolStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DB Health] Health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Database health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Data encryption middleware for sensitive fields
 */
const encryptSensitiveData = (sensitiveFields = []) => {
  return (req, res, next) => {
    try {
      // Encrypt sensitive fields in request body
      if (req.body && sensitiveFields.length > 0) {
        for (const field of sensitiveFields) {
          if (req.body[field]) {
            req.body[field] = config.encryption.encrypt(req.body[field]);
          }
        }
      }

      // Override response to decrypt sensitive fields
      const originalSend = res.send;
      res.send = function(data) {
        try {
          if (typeof data === 'string') {
            data = JSON.parse(data);
          }

          // Decrypt sensitive fields in response
          if (data && data.data) {
            if (Array.isArray(data.data)) {
              data.data = data.data.map(item => decryptFields(item, sensitiveFields));
            } else {
              data.data = decryptFields(data.data, sensitiveFields);
            }
          }

          originalSend.call(this, JSON.stringify(data));
        } catch (error) {
          console.error('[DB Security] Data encryption/decryption failed:', error);
          originalSend.call(this, data);
        }
      };

      next();
    } catch (error) {
      console.error('[DB Security] Encryption middleware failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Data encryption failed',
        code: 'ENCRYPTION_ERROR'
      });
    }
  };
};

/**
 * Helper function to decrypt fields
 */
const decryptFields = (item, sensitiveFields) => {
  if (!item || typeof item !== 'object') return item;

  const decryptedItem = { ...item };
  
  for (const field of sensitiveFields) {
    if (decryptedItem[field] && typeof decryptedItem[field] === 'object') {
      decryptedItem[field] = config.encryption.decrypt(decryptedItem[field]);
    }
  }

  return decryptedItem;
};

/**
 * Connection pool monitoring middleware
 */
const monitorConnectionPool = (req, res, next) => {
  // Add pool status to response headers
  const poolStatus = databaseManager.getPoolStatus();
  
  res.set({
    'X-DB-Pool-Primary-Active': poolStatus.primary?.active || 0,
    'X-DB-Pool-Primary-Idle': poolStatus.primary?.idle || 0,
    'X-DB-Pool-Primary-Total': poolStatus.primary?.total || 0
  });

  if (poolStatus.readReplica) {
    res.set({
      'X-DB-Pool-Replica-Active': poolStatus.readReplica.active || 0,
      'X-DB-Pool-Replica-Idle': poolStatus.readReplica.idle || 0,
      'X-DB-Pool-Replica-Total': poolStatus.readReplica.total || 0
    });
  }

  // Warn if pool utilization is high
  if (poolStatus.primary && poolStatus.primary.active / poolStatus.primary.max > 0.8) {
    console.warn('[DB Pool] High primary pool utilization:', poolStatus.primary);
  }

  next();
};

module.exports = {
  secureConnection,
  validateQuery,
  secureTransaction,
  monitorPerformance,
  healthCheck,
  encryptSensitiveData,
  monitorConnectionPool
};

