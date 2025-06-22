/**
 * Enhanced Admin Routes
 * Advanced admin panel endpoints with multi-chain analytics and real-time monitoring
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../services/authMiddleware');
const EnhancedAdminDashboardService = require('../services/EnhancedAdminDashboardService');

// Initialize services
const adminDashboard = new EnhancedAdminDashboardService();

/**
 * @swagger
 * /admindashboard/enhanced/overview:
 *   get:
 *     summary: Get enhanced multi-chain dashboard overview
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeframe
 *         in: query
 *         description: Time range for analytics (1h, 24h, 7d, 30d, 90d)
 *         required: false
 *         type: string
 *         default: 24h
 *     responses:
 *       200:
 *         description: Comprehensive dashboard data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/enhanced/overview', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const dashboardData = await adminDashboard.getMultiChainDashboard(timeframe);
    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting enhanced overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard overview',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/chain-stats:
 *   get:
 *     summary: Get detailed blockchain network statistics
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: chain
 *         in: query
 *         description: Specific blockchain to get stats for
 *         required: false
 *         type: string
 *       - name: timeframe
 *         in: query
 *         description: Time range for analytics
 *         required: false
 *         type: string
 *         default: 24h
 *     responses:
 *       200:
 *         description: Blockchain network statistics
 */
router.get('/enhanced/chain-stats', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { timeframe = '24h', chain } = req.query;
    const timeRanges = adminDashboard.getTimeRange(timeframe);
    
    let chainStats;
    if (chain) {
      chainStats = await adminDashboard.getChainStatistics(timeRanges);
      chainStats = chainStats.filter(stat => stat.chain === chain);
    } else {
      chainStats = await adminDashboard.getChainStatistics(timeRanges);
    }

    res.json({
      success: true,
      data: chainStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting chain stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chain statistics',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/transaction-metrics:
 *   get:
 *     summary: Get comprehensive transaction analytics
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeframe
 *         in: query
 *         description: Time range for analytics
 *         required: false
 *         type: string
 *         default: 24h
 *       - name: chain
 *         in: query
 *         description: Filter by specific blockchain
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: Transaction metrics and analytics
 */
router.get('/enhanced/transaction-metrics', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const timeRanges = adminDashboard.getTimeRange(timeframe);
    const transactionMetrics = await adminDashboard.getTransactionMetrics(timeRanges);

    res.json({
      success: true,
      data: transactionMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting transaction metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction metrics',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/user-analytics:
 *   get:
 *     summary: Get user activity and growth analytics
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeframe
 *         in: query
 *         description: Time range for analytics
 *         required: false
 *         type: string
 *         default: 24h
 *     responses:
 *       200:
 *         description: User analytics and metrics
 */
router.get('/enhanced/user-analytics', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const timeRanges = adminDashboard.getTimeRange(timeframe);
    const userMetrics = await adminDashboard.getUserMetrics(timeRanges);

    res.json({
      success: true,
      data: userMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user analytics',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/nft-metrics:
 *   get:
 *     summary: Get NFT marketplace analytics
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeframe
 *         in: query
 *         description: Time range for analytics
 *         required: false
 *         type: string
 *         default: 24h
 *     responses:
 *       200:
 *         description: NFT marketplace metrics
 */
router.get('/enhanced/nft-metrics', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const timeRanges = adminDashboard.getTimeRange(timeframe);
    const nftMetrics = await adminDashboard.getNFTMetrics(timeRanges);

    res.json({
      success: true,
      data: nftMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting NFT metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFT metrics',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/system-health:
 *   get:
 *     summary: Get comprehensive system health metrics
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health and performance metrics
 */
router.get('/enhanced/system-health', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const systemHealth = await adminDashboard.getSystemHealthMetrics();

    res.json({
      success: true,
      data: systemHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/top-assets:
 *   get:
 *     summary: Get top traded assets across all chains
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeframe
 *         in: query
 *         description: Time range for analytics
 *         required: false
 *         type: string
 *         default: 24h
 *       - name: limit
 *         in: query
 *         description: Number of top assets to return
 *         required: false
 *         type: integer
 *         default: 10
 *     responses:
 *       200:
 *         description: Top traded assets
 */
router.get('/enhanced/top-assets', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { timeframe = '24h', limit = 10 } = req.query;
    const timeRanges = adminDashboard.getTimeRange(timeframe);
    const topAssets = await adminDashboard.getTopTradedAssets(timeRanges, parseInt(limit));

    res.json({
      success: true,
      data: topAssets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting top assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top assets',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/recent-activity:
 *   get:
 *     summary: Get recent platform activity
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of recent activities to return
 *         required: false
 *         type: integer
 *         default: 50
 *       - name: type
 *         in: query
 *         description: Filter by activity type (transaction, auction, mint, bridge)
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: Recent platform activity
 */
router.get('/enhanced/recent-activity', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { limit = 50, type } = req.query;
    let recentActivity = await adminDashboard.getRecentActivity(parseInt(limit));

    if (type) {
      recentActivity = recentActivity.filter(activity => activity.type === type);
    }

    res.json({
      success: true,
      data: recentActivity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/blockchain-adapters:
 *   get:
 *     summary: Get blockchain adapter status for all networks
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blockchain adapter status information
 */
router.get('/enhanced/blockchain-adapters', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const adapterStatuses = [];
    
    for (const chain of adminDashboard.supportedChains) {
      const status = await adminDashboard.getBlockchainAdapterStatus(chain);
      adapterStatuses.push({
        chain,
        name: adminDashboard.getChainDisplayName(chain),
        ...status
      });
    }

    res.json({
      success: true,
      data: adapterStatuses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting blockchain adapter status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blockchain adapter status',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/gas-tracker:
 *   get:
 *     summary: Get real-time gas prices across all supported chains
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current gas prices for all blockchain networks
 */
router.get('/enhanced/gas-tracker', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const gasPrices = [];
    const timeRanges = adminDashboard.getTimeRange('1h');
    
    for (const chain of adminDashboard.supportedChains) {
      const gasData = await adminDashboard.getChainGasUsage(chain, timeRanges);
      gasPrices.push({
        chain,
        name: adminDashboard.getChainDisplayName(chain),
        currentPrice: gasData.avgPrice,
        maxPrice: gasData.maxPrice,
        minPrice: gasData.minPrice,
        totalUsage: gasData.totalGasUsed,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: gasPrices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting gas tracker data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gas tracker data',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/performance-metrics:
 *   get:
 *     summary: Get detailed performance metrics
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed system performance metrics
 */
router.get('/enhanced/performance-metrics', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const [serverMetrics, databaseHealth, apiHealth] = await Promise.all([
      adminDashboard.getServerMetrics(),
      adminDashboard.getDatabaseHealth(),
      adminDashboard.getAPIHealth()
    ]);

    const performanceMetrics = {
      server: serverMetrics,
      database: databaseHealth,
      api: apiHealth,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    };

    res.json({
      success: true,
      data: performanceMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /admindashboard/enhanced/export-report:
 *   post:
 *     summary: Generate and export analytics report
 *     tags:
 *       - Enhanced Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [transactions, users, nfts, system, comprehensive]
 *               timeframe:
 *                 type: string
 *                 default: 24h
 *               format:
 *                 type: string
 *                 enum: [json, csv, pdf]
 *                 default: json
 *               email:
 *                 type: string
 *                 description: Email address to send report to (optional)
 *     responses:
 *       200:
 *         description: Report generated successfully
 */
router.post('/enhanced/export-report', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { reportType, timeframe = '24h', format = 'json', email } = req.body;
    
    // Generate report data based on type
    const timeRanges = adminDashboard.getTimeRange(timeframe);
    let reportData = {};

    switch (reportType) {
      case 'transactions':
        reportData = await adminDashboard.getTransactionMetrics(timeRanges);
        break;
      case 'users':
        reportData = await adminDashboard.getUserMetrics(timeRanges);
        break;
      case 'nfts':
        reportData = await adminDashboard.getNFTMetrics(timeRanges);
        break;
      case 'system':
        reportData = await adminDashboard.getSystemHealthMetrics();
        break;
      case 'comprehensive':
        reportData = await adminDashboard.getMultiChainDashboard(timeframe);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type'
        });
    }

    const report = {
      type: reportType,
      timeframe,
      generatedAt: new Date().toISOString(),
      data: reportData
    };

    // If email is provided, send report via email (would implement email service)
    if (email) {
      // await emailService.sendReport(email, report, format);
      console.log(`Report would be sent to ${email}`);
    }

    res.json({
      success: true,
      message: 'Report generated successfully',
      report: format === 'json' ? report : { message: `Report generated in ${format} format` },
      downloadUrl: `/api/reports/${Date.now()}.${format}` // Mock download URL
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

module.exports = router;

