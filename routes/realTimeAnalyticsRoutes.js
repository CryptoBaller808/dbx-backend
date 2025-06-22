/**
 * Real-Time Analytics API Routes
 * Advanced analytics endpoints with live streaming and reporting
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../services/authMiddleware');
const RealTimeAnalyticsService = require('../services/RealTimeAnalyticsService');

// Initialize real-time analytics service (will be passed from server.js)
let realTimeAnalytics = null;

const initializeRealTimeAnalytics = (io) => {
  realTimeAnalytics = new RealTimeAnalyticsService(io);
  return realTimeAnalytics;
};

/**
 * @swagger
 * /admindashboard/analytics/live-stream/{metric}:
 *   get:
 *     summary: Get current live data stream for specific metric
 *     tags:
 *       - Real-Time Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: metric
 *         in: path
 *         description: Metric type (transactions, health, user_activity, blockchain)
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Current live data stream
 */
router.get('/analytics/live-stream/:metric', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { metric } = req.params;
    
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Real-time analytics service not initialized'
      });
    }

    const streamData = realTimeAnalytics.getLiveDataStream(metric);
    
    if (!streamData) {
      return res.status(404).json({
        success: false,
        error: `No live stream data available for metric: ${metric}`
      });
    }

    res.json({
      success: true,
      metric,
      data: streamData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting live stream:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live stream data',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/analytics/filtered:
 *   post:
 *     summary: Get filtered analytics data with advanced filtering
 *     tags:
 *       - Real-Time Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeframe:
 *                 type: string
 *                 default: 24h
 *               chains:
 *                 type: array
 *                 items:
 *                   type: string
 *               userTiers:
 *                 type: array
 *                 items:
 *                   type: string
 *               transactionTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               minAmount:
 *                 type: number
 *                 default: 0
 *               maxAmount:
 *                 type: number
 *               sortBy:
 *                 type: string
 *                 default: timestamp
 *               sortOrder:
 *                 type: string
 *                 enum: [ASC, DESC]
 *                 default: DESC
 *               limit:
 *                 type: integer
 *                 default: 100
 *               offset:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       200:
 *         description: Filtered analytics data
 */
router.post('/analytics/filtered', authMiddleware.authenticateToken, async (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Real-time analytics service not initialized'
      });
    }

    const filteredData = await realTimeAnalytics.getFilteredAnalytics(req.body);

    res.json({
      success: true,
      data: filteredData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting filtered analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filtered analytics',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/analytics/generate-report:
 *   post:
 *     summary: Generate comprehensive analytics report
 *     tags:
 *       - Real-Time Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timeframe:
 *                 type: string
 *                 default: 24h
 *               includeCharts:
 *                 type: boolean
 *                 default: true
 *               format:
 *                 type: string
 *                 enum: [json, csv, pdf]
 *                 default: json
 *               sections:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [overview, transactions, users, nfts, system]
 *               email:
 *                 type: string
 *                 description: Email address to send report to
 *     responses:
 *       200:
 *         description: Generated analytics report
 */
router.post('/analytics/generate-report', authMiddleware.authenticateToken, async (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Real-time analytics service not initialized'
      });
    }

    const { email, ...reportOptions } = req.body;
    const report = await realTimeAnalytics.generateAnalyticsReport(reportOptions);

    // If email is provided, send report via email
    if (email) {
      try {
        const emailContent = realTimeAnalytics.generateEmailReport(report, 'custom');
        await realTimeAnalytics.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@digitalblockexchange.com',
          to: email,
          subject: `DBX Custom Analytics Report - ${new Date().toLocaleDateString()}`,
          html: emailContent,
          attachments: [
            {
              filename: `dbx-custom-report-${new Date().toISOString().split('T')[0]}.json`,
              content: JSON.stringify(report, null, 2),
              contentType: 'application/json'
            }
          ]
        });
      } catch (emailError) {
        console.error('Error sending email report:', emailError);
        // Continue with response even if email fails
      }
    }

    res.json({
      success: true,
      message: 'Report generated successfully',
      report: reportOptions.format === 'json' ? report : { message: `Report generated in ${reportOptions.format} format` },
      emailSent: !!email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/analytics/schedule-report:
 *   post:
 *     summary: Schedule automated analytics reports
 *     tags:
 *       - Real-Time Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *               reportOptions:
 *                 type: object
 *                 properties:
 *                   timeframe:
 *                     type: string
 *                   includeCharts:
 *                     type: boolean
 *                   sections:
 *                     type: array
 *                     items:
 *                       type: string
 *               enabled:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Report schedule configured
 */
router.post('/analytics/schedule-report', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { frequency, emails, reportOptions, enabled = true } = req.body;

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid frequency. Must be daily, weekly, or monthly'
      });
    }

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Email addresses are required'
      });
    }

    // Store schedule configuration (in real implementation, this would be stored in database)
    const scheduleConfig = {
      id: Date.now(),
      frequency,
      emails,
      reportOptions: reportOptions || {},
      enabled,
      createdAt: new Date().toISOString(),
      nextRun: calculateNextRun(frequency)
    };

    // In real implementation, store in database and set up cron job
    console.log('Report schedule configured:', scheduleConfig);

    res.json({
      success: true,
      message: 'Report schedule configured successfully',
      schedule: scheduleConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error scheduling report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule report',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/analytics/export-data:
 *   post:
 *     summary: Export analytics data in various formats
 *     tags:
 *       - Real-Time Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dataType:
 *                 type: string
 *                 enum: [transactions, users, nfts, system_logs]
 *               format:
 *                 type: string
 *                 enum: [csv, json, xlsx]
 *                 default: csv
 *               timeframe:
 *                 type: string
 *                 default: 24h
 *               filters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Data export URL or file content
 */
router.post('/analytics/export-data', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { dataType, format = 'csv', timeframe = '24h', filters = {} } = req.body;

    if (!['transactions', 'users', 'nfts', 'system_logs'].includes(dataType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data type'
      });
    }

    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Real-time analytics service not initialized'
      });
    }

    // Get filtered data based on type
    let exportData;
    switch (dataType) {
      case 'transactions':
        const transactionData = await realTimeAnalytics.getFilteredAnalytics({
          timeframe,
          ...filters,
          limit: 10000 // Large limit for export
        });
        exportData = transactionData.transactions;
        break;
      case 'users':
        // Implementation for user data export
        exportData = [];
        break;
      case 'nfts':
        // Implementation for NFT data export
        exportData = [];
        break;
      case 'system_logs':
        // Implementation for system logs export
        exportData = [];
        break;
      default:
        exportData = [];
    }

    // Format data based on requested format
    let responseData;
    let contentType;
    let filename;

    switch (format) {
      case 'csv':
        responseData = convertToCSV(exportData);
        contentType = 'text/csv';
        filename = `${dataType}-export-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'json':
        responseData = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        filename = `${dataType}-export-${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'xlsx':
        // Implementation for Excel export would go here
        responseData = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        filename = `${dataType}-export-${new Date().toISOString().split('T')[0]}.json`;
        break;
      default:
        responseData = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        filename = `${dataType}-export-${new Date().toISOString().split('T')[0]}.json`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(responseData);

  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/analytics/alerts/configure:
 *   post:
 *     summary: Configure alert thresholds and notifications
 *     tags:
 *       - Real-Time Analytics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metric:
 *                 type: string
 *                 enum: [transaction_volume, error_rate, response_time, user_activity]
 *               thresholds:
 *                 type: object
 *                 properties:
 *                   warning:
 *                     type: number
 *                   critical:
 *                     type: number
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   webhook:
 *                     type: string
 *               enabled:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Alert configuration updated
 */
router.post('/analytics/alerts/configure', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { metric, thresholds, notifications, enabled = true } = req.body;

    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Real-time analytics service not initialized'
      });
    }

    // Update alert thresholds
    if (thresholds) {
      realTimeAnalytics.alertThresholds[metric] = thresholds;
    }

    const alertConfig = {
      metric,
      thresholds: realTimeAnalytics.alertThresholds[metric],
      notifications,
      enabled,
      updatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Alert configuration updated successfully',
      config: alertConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error configuring alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure alerts',
      details: error.message
    });
  }
});

/**
 * Helper functions
 */
function calculateNextRun(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.toISOString();
    case 'weekly':
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay() + 1));
      nextWeek.setHours(9, 0, 0, 0);
      return nextWeek.toISOString();
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(9, 0, 0, 0);
      return nextMonth.toISOString();
    default:
      return now.toISOString();
  }
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
}

module.exports = {
  router,
  initializeRealTimeAnalytics
};

