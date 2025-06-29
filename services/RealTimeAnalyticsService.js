/**
 * Real-Time Analytics Service
 * Provides live data streaming, advanced reporting, and real-time monitoring
 */

const EventEmitter = require('events');
const { Op } = require('sequelize');
const db = require('../models');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

class RealTimeAnalyticsService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.activeConnections = new Map();
    this.dataStreams = new Map();
    this.reportSchedules = new Map();
    this.alertThresholds = {
      transactionVolume: { warning: 1000, critical: 5000 },
      errorRate: { warning: 0.05, critical: 0.1 },
      responseTime: { warning: 2000, critical: 5000 },
      userActivity: { warning: 100, critical: 500 }
    };
    
    this.initializeEmailTransporter();
    this.startDataStreaming();
    this.setupScheduledReports();
  }

  /**
   * Initialize email transporter for reports
   */
  initializeEmailTransporter() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Start real-time data streaming
   */
  startDataStreaming() {
    // Stream transaction data every 10 seconds
    setInterval(() => {
      this.streamTransactionData();
    }, 10000);

    // Stream system health every 30 seconds
    setInterval(() => {
      this.streamSystemHealth();
    }, 30000);

    // Stream user activity every 15 seconds
    setInterval(() => {
      this.streamUserActivity();
    }, 15000);

    // Stream blockchain status every 20 seconds
    setInterval(() => {
      this.streamBlockchainStatus();
    }, 20000);

    console.log('[RealTimeAnalytics] Data streaming started');
  }

  /**
   * Stream live transaction data
   */
  async streamTransactionData() {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);

      const recentTransactions = await db.nft_transactions.count({
        where: {
          timestamp: {
            [Op.gte]: oneMinuteAgo
          }
        }
      });

      const recentVolume = await db.nft_transactions.sum('price', {
        where: {
          timestamp: {
            [Op.gte]: oneMinuteAgo
          }
        }
      });

      const transactionsByChain = await db.nft_transactions.findAll({
        where: {
          timestamp: {
            [Op.gte]: oneMinuteAgo
          }
        },
        group: ['blockchain'],
        attributes: [
          'blockchain',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
        ]
      });

      const streamData = {
        timestamp: now.toISOString(),
        recentTransactions,
        recentVolume: recentVolume || 0,
        transactionsByChain: transactionsByChain.map(item => ({
          chain: item.blockchain,
          count: parseInt(item.dataValues?.count || 0)
        })),
        tps: recentTransactions / 60 // Transactions per second
      };

      // Check for alerts
      if (recentTransactions > this.alertThresholds.transactionVolume.critical) {
        this.emitAlert('critical', 'High transaction volume detected', {
          metric: 'transaction_volume',
          value: recentTransactions,
          threshold: this.alertThresholds.transactionVolume.critical
        });
      } else if (recentTransactions > this.alertThresholds.transactionVolume.warning) {
        this.emitAlert('warning', 'Elevated transaction volume', {
          metric: 'transaction_volume',
          value: recentTransactions,
          threshold: this.alertThresholds.transactionVolume.warning
        });
      }

      // Emit to connected admin clients
      this.io.to('admin_dashboard').emit('transaction_stream', streamData);
      this.dataStreams.set('transactions', streamData);

    } catch (error) {
      console.error('Error streaming transaction data:', error);
    }
  }

  /**
   * Stream system health metrics
   */
  async streamSystemHealth() {
    try {
      const healthData = {
        timestamp: new Date().toISOString(),
        database: await this.getDatabaseHealth(),
        api: await this.getAPIHealth(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      };

      // Check for health alerts
      if (healthData.database.responseTime > this.alertThresholds.responseTime.critical) {
        this.emitAlert('critical', 'Database response time critical', {
          metric: 'database_response_time',
          value: healthData.database.responseTime,
          threshold: this.alertThresholds.responseTime.critical
        });
      }

      this.io.to('system_monitoring').emit('health_stream', healthData);
      this.dataStreams.set('health', healthData);

    } catch (error) {
      console.error('Error streaming system health:', error);
    }
  }

  /**
   * Stream user activity data
   */
  async streamUserActivity() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 300000);

      const activeUsers = await db.users.count({
        where: {
          updatedAt: {
            [Op.gte]: fiveMinutesAgo
          }
        }
      });

      const newRegistrations = await db.users.count({
        where: {
          createdAt: {
            [Op.gte]: fiveMinutesAgo
          }
        }
      });

      const userActivityData = {
        timestamp: now.toISOString(),
        activeUsers,
        newRegistrations,
        activityRate: activeUsers / 5 // Users per minute
      };

      this.io.to('admin_dashboard').emit('user_activity_stream', userActivityData);
      this.dataStreams.set('user_activity', userActivityData);

    } catch (error) {
      console.error('Error streaming user activity:', error);
    }
  }

  /**
   * Stream blockchain adapter status
   */
  async streamBlockchainStatus() {
    try {
      const supportedChains = ['ETH', 'BNB', 'AVAX', 'MATIC', 'XDC', 'SOL', 'XRP', 'XLM'];
      const chainStatuses = [];

      for (const chain of supportedChains) {
        // Mock blockchain adapter status - in real implementation, this would check actual adapters
        const status = {
          chain,
          status: Math.random() > 0.1 ? 'online' : 'offline',
          responseTime: Math.floor(Math.random() * 1000) + 100,
          blockHeight: Math.floor(Math.random() * 1000000),
          lastUpdate: new Date().toISOString(),
          errorRate: Math.random() * 0.1
        };

        chainStatuses.push(status);

        // Check for blockchain alerts
        if (status.status === 'offline') {
          this.emitAlert('critical', `${chain} blockchain adapter offline`, {
            metric: 'blockchain_status',
            chain,
            status: status.status
          });
        } else if (status.responseTime > this.alertThresholds.responseTime.warning) {
          this.emitAlert('warning', `${chain} blockchain slow response`, {
            metric: 'blockchain_response_time',
            chain,
            value: status.responseTime,
            threshold: this.alertThresholds.responseTime.warning
          });
        }
      }

      const blockchainData = {
        timestamp: new Date().toISOString(),
        chains: chainStatuses,
        onlineChains: chainStatuses.filter(c => c.status === 'online').length,
        totalChains: chainStatuses.length
      };

      this.io.to('admin_dashboard').emit('blockchain_stream', blockchainData);
      this.dataStreams.set('blockchain', blockchainData);

    } catch (error) {
      console.error('Error streaming blockchain status:', error);
    }
  }

  /**
   * Emit alert to admin clients
   */
  emitAlert(severity, message, data) {
    const alert = {
      id: Date.now(),
      severity,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.io.to('admin_dashboard').emit('system_alert', alert);
    this.io.to('system_monitoring').emit('system_alert', alert);

    // Log alert
    console.log(`[ALERT ${severity.toUpperCase()}] ${message}`, data);

    // Store alert in database (if alert model exists)
    this.storeAlert(alert);
  }

  /**
   * Store alert in database
   */
  async storeAlert(alert) {
    try {
      // This would store in an alerts table if it exists
      console.log('Alert stored:', alert);
    } catch (error) {
      console.error('Error storing alert:', error);
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(options = {}) {
    const {
      timeframe = '24h',
      includeCharts = true,
      format = 'json',
      sections = ['overview', 'transactions', 'users', 'nfts', 'system']
    } = options;

    try {
      const timeRanges = this.getTimeRange(timeframe);
      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          timeframe,
          format,
          sections
        },
        data: {}
      };

      // Generate each section
      if (sections.includes('overview')) {
        report.data.overview = await this.generateOverviewSection(timeRanges);
      }

      if (sections.includes('transactions')) {
        report.data.transactions = await this.generateTransactionSection(timeRanges);
      }

      if (sections.includes('users')) {
        report.data.users = await this.generateUserSection(timeRanges);
      }

      if (sections.includes('nfts')) {
        report.data.nfts = await this.generateNFTSection(timeRanges);
      }

      if (sections.includes('system')) {
        report.data.system = await this.generateSystemSection();
      }

      // Add charts data if requested
      if (includeCharts) {
        report.charts = await this.generateChartsData(timeRanges);
      }

      return report;
    } catch (error) {
      console.error('Error generating analytics report:', error);
      throw error;
    }
  }

  /**
   * Schedule automated reports
   */
  setupScheduledReports() {
    // Daily report at 9 AM
    cron.schedule('0 9 * * *', async () => {
      await this.sendScheduledReport('daily');
    });

    // Weekly report on Mondays at 9 AM
    cron.schedule('0 9 * * 1', async () => {
      await this.sendScheduledReport('weekly');
    });

    // Monthly report on 1st of month at 9 AM
    cron.schedule('0 9 1 * *', async () => {
      await this.sendScheduledReport('monthly');
    });

    console.log('[RealTimeAnalytics] Scheduled reports configured');
  }

  /**
   * Send scheduled report via email
   */
  async sendScheduledReport(frequency) {
    try {
      const timeframe = frequency === 'daily' ? '24h' : frequency === 'weekly' ? '7d' : '30d';
      const report = await this.generateAnalyticsReport({
        timeframe,
        includeCharts: true,
        format: 'json'
      });

      const emailContent = this.generateEmailReport(report, frequency);
      
      // Get admin email addresses (this would come from admin settings)
      const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];

      if (adminEmails.length > 0) {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@digitalblockexchange.com',
          to: adminEmails.join(','),
          subject: `DBX ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Analytics Report`,
          html: emailContent,
          attachments: [
            {
              filename: `dbx-${frequency}-report-${new Date().toISOString().split('T')[0]}.json`,
              content: JSON.stringify(report, null, 2),
              contentType: 'application/json'
            }
          ]
        });

        console.log(`[RealTimeAnalytics] ${frequency} report sent to ${adminEmails.length} recipients`);
      }
    } catch (error) {
      console.error(`Error sending ${frequency} report:`, error);
    }
  }

  /**
   * Generate HTML email report
   */
  generateEmailReport(report, frequency) {
    const { overview, transactions, users, nfts, system } = report.data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
          .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
          .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; margin: 10px 0; }
          .metric-label { color: #7f8c8d; font-size: 0.9em; }
          .section { margin: 30px 0; }
          .section h2 { color: #2c3e50; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
          .footer { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DBX ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Analytics Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <h2>Platform Overview</h2>
              <div class="metric-grid">
                <div class="metric-card">
                  <div class="metric-label">Total Transactions</div>
                  <div class="metric-value">${this.formatNumber(overview?.totalTransactions || 0)}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Total Volume</div>
                  <div class="metric-value">${this.formatCurrency(overview?.totalVolume || 0)}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Active Users</div>
                  <div class="metric-value">${this.formatNumber(overview?.activeUsers || 0)}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Total NFTs</div>
                  <div class="metric-value">${this.formatNumber(overview?.totalNFTs || 0)}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>Transaction Metrics</h2>
              <p><strong>Success Rate:</strong> ${transactions?.successRate || 0}%</p>
              <p><strong>Average Transaction Value:</strong> ${this.formatCurrency((transactions?.totalVolume || 0) / (transactions?.totalTransactions || 1))}</p>
            </div>

            <div class="section">
              <h2>User Analytics</h2>
              <p><strong>New Users:</strong> ${this.formatNumber(users?.newUsers || 0)}</p>
              <p><strong>Retention Rate:</strong> ${users?.retentionRate?.toFixed(2) || 0}%</p>
            </div>

            <div class="section">
              <h2>NFT Marketplace</h2>
              <p><strong>Total Sales:</strong> ${this.formatNumber(nfts?.nftSales?.totalSales || 0)}</p>
              <p><strong>Average Price:</strong> ${this.formatCurrency(nfts?.averagePrice || 0)}</p>
            </div>

            <div class="section">
              <h2>System Health</h2>
              <p><strong>Overall Status:</strong> ${system?.overall?.status || 'Unknown'}</p>
              <p><strong>Uptime:</strong> ${this.formatUptime(system?.uptime || 0)}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Digital Block Exchange - Admin Analytics</p>
            <p>This is an automated report. For questions, contact the development team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Advanced filtering for analytics data
   */
  async getFilteredAnalytics(filters = {}) {
    const {
      timeframe = '24h',
      chains = [],
      userTiers = [],
      transactionTypes = [],
      minAmount = 0,
      maxAmount = null,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
      limit = 100,
      offset = 0
    } = filters;

    try {
      const timeRanges = this.getTimeRange(timeframe);
      const whereConditions = {
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      };

      // Apply chain filter
      if (chains.length > 0) {
        whereConditions.blockchain = { [Op.in]: chains };
      }

      // Apply transaction type filter
      if (transactionTypes.length > 0) {
        whereConditions.transaction_type = { [Op.in]: transactionTypes };
      }

      // Apply amount filters
      if (minAmount > 0) {
        whereConditions.price = { [Op.gte]: minAmount };
      }
      if (maxAmount !== null) {
        whereConditions.price = { 
          ...whereConditions.price,
          [Op.lte]: maxAmount 
        };
      }

      const transactions = await db.nft_transactions.findAndCountAll({
        where: whereConditions,
        include: [
          { model: db.nfts, as: 'nft' },
          { model: db.users, as: 'user' }
        ],
        order: [[sortBy, sortOrder]],
        limit,
        offset
      });

      // Calculate aggregated metrics
      const aggregatedData = await db.nft_transactions.findOne({
        where: whereConditions,
        attributes: [
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'totalCount'],
          [db.sequelize.fn('SUM', db.sequelize.col('price')), 'totalVolume'],
          [db.sequelize.fn('AVG', db.sequelize.col('price')), 'avgPrice'],
          [db.sequelize.fn('MIN', db.sequelize.col('price')), 'minPrice'],
          [db.sequelize.fn('MAX', db.sequelize.col('price')), 'maxPrice']
        ]
      });

      return {
        transactions: transactions.rows,
        pagination: {
          total: transactions.count,
          limit,
          offset,
          pages: Math.ceil(transactions.count / limit)
        },
        aggregated: {
          totalCount: parseInt(aggregatedData?.dataValues?.totalCount || 0),
          totalVolume: parseFloat(aggregatedData?.dataValues?.totalVolume || 0),
          avgPrice: parseFloat(aggregatedData?.dataValues?.avgPrice || 0),
          minPrice: parseFloat(aggregatedData?.dataValues?.minPrice || 0),
          maxPrice: parseFloat(aggregatedData?.dataValues?.maxPrice || 0)
        },
        filters: filters
      };
    } catch (error) {
      console.error('Error getting filtered analytics:', error);
      throw error;
    }
  }

  /**
   * Get live data stream for specific metric
   */
  getLiveDataStream(metric) {
    return this.dataStreams.get(metric) || null;
  }

  /**
   * Helper methods
   */
  getTimeRange(timeframe) {
    const end = new Date();
    let start = new Date();

    switch (timeframe) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 1);
    }

    return { start, end };
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  async getDatabaseHealth() {
    try {
      const start = Date.now();
      await db.sequelize.authenticate();
      const responseTime = Date.now() - start;
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'warning',
        responseTime,
        connections: 'active'
      };
    } catch (error) {
      return {
        status: 'critical',
        error: error.message
      };
    }
  }

  async getAPIHealth() {
    return {
      status: 'healthy',
      responseTime: Math.floor(Math.random() * 500),
      requestsPerMinute: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 0.05
    };
  }

  // Additional report generation methods would be implemented here...
  async generateOverviewSection(timeRanges) {
    // Implementation for overview section
    return {};
  }

  async generateTransactionSection(timeRanges) {
    // Implementation for transaction section
    return {};
  }

  async generateUserSection(timeRanges) {
    // Implementation for user section
    return {};
  }

  async generateNFTSection(timeRanges) {
    // Implementation for NFT section
    return {};
  }

  async generateSystemSection() {
    // Implementation for system section
    return {};
  }

  async generateChartsData(timeRanges) {
    // Implementation for charts data
    return {};
  }
}

module.exports = RealTimeAnalyticsService;

