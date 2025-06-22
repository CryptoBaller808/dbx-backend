const express = require('express');
const { auditLogQuery } = require('../middleware/auditMiddleware');
const { audit_logs } = require('../models');
const AuditLogger = require('../services/auditLogger');
const router = express.Router();

/**
 * Audit Log Management Routes for DBX Platform
 * Provides comprehensive audit log querying and reporting capabilities
 */

/**
 * GET /api/audit/logs
 * Query audit logs with filtering and pagination
 */
router.get('/logs', auditLogQuery, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.auditLogs.logs,
      pagination: req.auditLogs.pagination
    });
  } catch (error) {
    console.error('[Audit Routes] Failed to get audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs'
    });
  }
});

/**
 * GET /api/audit/logs/:id
 * Get specific audit log by ID
 */
router.get('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const auditLog = await audit_logs.findByPk(id, {
      include: [{
        model: require('../models').users,
        as: 'user',
        attributes: ['id', 'email', 'wallet'],
        required: false
      }]
    });
    
    if (!auditLog) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }
    
    res.json({
      success: true,
      data: auditLog.toSafeJSON()
    });
  } catch (error) {
    console.error('[Audit Routes] Failed to get audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit log'
    });
  }
});

/**
 * GET /api/audit/suspicious
 * Get suspicious activity logs
 */
router.get('/suspicious', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const suspiciousLogs = await audit_logs.findSuspiciousActivity(timeframe);
    
    res.json({
      success: true,
      data: suspiciousLogs.map(log => log.toSafeJSON()),
      count: suspiciousLogs.length
    });
  } catch (error) {
    console.error('[Audit Routes] Failed to get suspicious activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve suspicious activity'
    });
  }
});

/**
 * GET /api/audit/compliance/:category
 * Generate compliance report for specific category
 */
router.get('/compliance/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      });
    }
    
    const validCategories = ['FINANCIAL', 'SECURITY', 'PRIVACY', 'OPERATIONAL', 'REGULATORY'];
    if (!validCategories.includes(category.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid compliance category'
      });
    }
    
    const complianceReport = await audit_logs.getComplianceReport(
      category.toUpperCase(),
      new Date(start_date),
      new Date(end_date)
    );
    
    // Generate summary statistics
    const summary = {
      total_events: complianceReport.length,
      event_types: {},
      severity_breakdown: {},
      status_breakdown: {},
      user_activity: {},
      daily_breakdown: {}
    };
    
    complianceReport.forEach(log => {
      // Event types
      summary.event_types[log.event_type] = (summary.event_types[log.event_type] || 0) + 1;
      
      // Severity breakdown
      summary.severity_breakdown[log.severity] = (summary.severity_breakdown[log.severity] || 0) + 1;
      
      // Status breakdown
      summary.status_breakdown[log.status] = (summary.status_breakdown[log.status] || 0) + 1;
      
      // User activity
      if (log.user_email) {
        summary.user_activity[log.user_email] = (summary.user_activity[log.user_email] || 0) + 1;
      }
      
      // Daily breakdown
      const date = log.created_at.toISOString().split('T')[0];
      summary.daily_breakdown[date] = (summary.daily_breakdown[date] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        category: category.toUpperCase(),
        period: {
          start_date,
          end_date
        },
        summary,
        logs: complianceReport.map(log => log.toSafeJSON())
      }
    });
  } catch (error) {
    console.error('[Audit Routes] Failed to generate compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report'
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit log statistics and metrics
 */
router.get('/stats', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    // Calculate time range
    const timeMap = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    
    const hours = timeMap[timeframe] || 24;
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    // Get statistics
    const { Op } = require('sequelize');
    const { sequelize } = require('../models');
    
    const stats = await audit_logs.findAll({
      where: {
        created_at: {
          [Op.gte]: since
        }
      },
      attributes: [
        'event_type',
        'severity',
        'status',
        'compliance_category',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['event_type', 'severity', 'status', 'compliance_category'],
      raw: true
    });
    
    // Get top users by activity
    const topUsers = await audit_logs.findAll({
      where: {
        created_at: {
          [Op.gte]: since
        },
        user_email: {
          [Op.ne]: null
        }
      },
      attributes: [
        'user_email',
        [sequelize.fn('COUNT', '*'), 'activity_count']
      ],
      group: ['user_email'],
      order: [[sequelize.fn('COUNT', '*'), 'DESC']],
      limit: 10,
      raw: true
    });
    
    // Get top IP addresses
    const topIPs = await audit_logs.findAll({
      where: {
        created_at: {
          [Op.gte]: since
        }
      },
      attributes: [
        'ip_address',
        [sequelize.fn('COUNT', '*'), 'request_count']
      ],
      group: ['ip_address'],
      order: [[sequelize.fn('COUNT', '*'), 'DESC']],
      limit: 10,
      raw: true
    });
    
    // Get error rate
    const totalLogs = await audit_logs.count({
      where: {
        created_at: {
          [Op.gte]: since
        }
      }
    });
    
    const errorLogs = await audit_logs.count({
      where: {
        created_at: {
          [Op.gte]: since
        },
        status: 'FAILED'
      }
    });
    
    const errorRate = totalLogs > 0 ? (errorLogs / totalLogs * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
        timeframe,
        period: {
          since: since.toISOString(),
          until: new Date().toISOString()
        },
        overview: {
          total_events: totalLogs,
          error_events: errorLogs,
          error_rate: `${errorRate}%`
        },
        breakdown: stats,
        top_users: topUsers,
        top_ips: topIPs
      }
    });
  } catch (error) {
    console.error('[Audit Routes] Failed to get audit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit statistics'
    });
  }
});

/**
 * GET /api/audit/user/:userId
 * Get audit logs for specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50, event_type } = req.query;
    
    const where = { user_id: userId };
    if (event_type) where.event_type = event_type;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
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
    
    res.json({
      success: true,
      data: rows.map(log => log.toSafeJSON()),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Audit Routes] Failed to get user audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user audit logs'
    });
  }
});

/**
 * POST /api/audit/export
 * Export audit logs to CSV format
 */
router.post('/export', async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      event_types = [],
      severity_levels = [],
      user_ids = []
    } = req.body;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      });
    }
    
    const { Op } = require('sequelize');
    const where = {
      created_at: {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      }
    };
    
    if (event_types.length > 0) where.event_type = { [Op.in]: event_types };
    if (severity_levels.length > 0) where.severity = { [Op.in]: severity_levels };
    if (user_ids.length > 0) where.user_id = { [Op.in]: user_ids };
    
    const logs = await audit_logs.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 10000, // Limit export size
      include: [{
        model: require('../models').users,
        as: 'user',
        attributes: ['id', 'email', 'wallet'],
        required: false
      }]
    });
    
    // Convert to CSV format
    const csvHeaders = [
      'ID', 'Event Type', 'Severity', 'User Email', 'IP Address', 
      'Action', 'Status', 'Created At', 'Description'
    ];
    
    const csvRows = logs.map(log => [
      log.id,
      log.event_type,
      log.severity,
      log.user_email || '',
      log.ip_address || '',
      log.action,
      log.status,
      log.created_at.toISOString(),
      log.description || ''
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${start_date}_${end_date}.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('[Audit Routes] Failed to export audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs'
    });
  }
});

/**
 * DELETE /api/audit/cleanup
 * Clean up old audit logs based on retention policy
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const { dry_run = false } = req.query;
    
    const { Op } = require('sequelize');
    
    // Find logs that have exceeded their retention period
    const expiredLogs = await audit_logs.findAll({
      where: {
        created_at: {
          [Op.lt]: sequelize.literal('DATE_SUB(NOW(), INTERVAL retention_period_days DAY)')
        },
        is_archived: false
      },
      attributes: ['id', 'event_type', 'created_at', 'retention_period_days'],
      limit: dry_run ? 100 : 1000
    });
    
    if (dry_run) {
      res.json({
        success: true,
        message: 'Dry run completed',
        data: {
          logs_to_cleanup: expiredLogs.length,
          sample_logs: expiredLogs.map(log => ({
            id: log.id,
            event_type: log.event_type,
            created_at: log.created_at,
            retention_period_days: log.retention_period_days
          }))
        }
      });
    } else {
      // Archive expired logs instead of deleting
      const logIds = expiredLogs.map(log => log.id);
      
      const updatedCount = await audit_logs.update(
        { is_archived: true },
        {
          where: {
            id: { [Op.in]: logIds }
          }
        }
      );
      
      res.json({
        success: true,
        message: 'Audit log cleanup completed',
        data: {
          archived_logs: updatedCount[0]
        }
      });
    }
  } catch (error) {
    console.error('[Audit Routes] Failed to cleanup audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup audit logs'
    });
  }
});

module.exports = router;

