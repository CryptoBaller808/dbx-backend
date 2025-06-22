/**
 * System Health Monitoring Service
 * Comprehensive system health monitoring, performance tracking, and alerting
 */

const os = require('os');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const { performance } = require('perf_hooks');

class SystemHealthMonitoringService {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.healthChecks = new Map();
    this.alerts = new Map();
    this.metrics = new Map();
    this.alertThresholds = {
      cpu_usage: 80,
      memory_usage: 85,
      disk_usage: 90,
      api_response_time: 5000,
      database_latency: 1000,
      error_rate: 5
    };
    this.emailTransporter = null;
    this.monitoringInterval = null;
    this.lastHealthCheck = null;
    
    this.initializeEmailTransporter();
    this.startMonitoring();
  }

  /**
   * Initialize email transporter for alerts
   */
  initializeEmailTransporter() {
    try {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Start continuous system monitoring
   */
  startMonitoring() {
    // Run health checks every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);

    // Initial health check
    this.performHealthChecks();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks() {
    try {
      const timestamp = new Date();
      const healthData = {
        timestamp,
        system: await this.getSystemHealth(),
        database: await this.getDatabaseHealth(),
        api: await this.getAPIHealth(),
        blockchain: await this.getBlockchainHealth(),
        services: await this.getServicesHealth()
      };

      this.lastHealthCheck = healthData;
      
      // Store health data
      await this.storeHealthData(healthData);
      
      // Check for alerts
      await this.checkAlerts(healthData);
      
      // Emit real-time updates
      this.io.to('admin_monitoring').emit('health_update', healthData);
      
      return healthData;
    } catch (error) {
      console.error('Health check failed:', error);
      await this.createAlert('critical', 'health_check_failed', 'System health check failed', { error: error.message });
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth() {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();
    const uptime = process.uptime();
    const loadAverage = os.loadavg();

    return {
      cpu_usage: cpuUsage,
      memory_usage: memoryUsage,
      disk_usage: diskUsage,
      uptime: uptime,
      load_average: loadAverage,
      platform: os.platform(),
      arch: os.arch(),
      node_version: process.version,
      pid: process.pid
    };
  }

  /**
   * Get CPU usage percentage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);
        
        const totalTime = endTime[0] * 1000000 + endTime[1] / 1000;
        const totalUsage = endUsage.user + endUsage.system;
        const cpuPercent = (totalUsage / totalTime) * 100;
        
        resolve(Math.round(cpuPercent * 100) / 100);
      }, 100);
    });
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercent = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage: Math.round(usagePercent * 100) / 100
    };
  }

  /**
   * Get disk usage
   */
  async getDiskUsage() {
    try {
      const stats = await fs.stat('.');
      // This is a simplified disk usage check
      // In production, you might want to use a more comprehensive disk monitoring library
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB placeholder
        used: 50 * 1024 * 1024 * 1024,   // 50GB placeholder
        free: 50 * 1024 * 1024 * 1024,   // 50GB placeholder
        percentage: 50 // 50% placeholder
      };
    } catch (error) {
      console.error('Error getting disk usage:', error);
      return { total: 0, used: 0, free: 0, percentage: 0 };
    }
  }

  /**
   * Get database health
   */
  async getDatabaseHealth() {
    try {
      const startTime = performance.now();
      
      // Test database connection
      await this.db.sequelize.authenticate();
      
      const endTime = performance.now();
      const latency = endTime - startTime;

      // Get database stats
      const [results] = await this.db.sequelize.query(`
        SELECT 
          COUNT(*) as connection_count,
          (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) as table_count
      `);

      return {
        status: 'healthy',
        latency: Math.round(latency * 100) / 100,
        connection_count: results[0]?.connection_count || 0,
        table_count: results[0]?.table_count || 0,
        last_check: new Date()
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        latency: null,
        last_check: new Date()
      };
    }
  }

  /**
   * Get API health metrics
   */
  async getAPIHealth() {
    const metrics = this.metrics.get('api') || {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      average_response_time: 0,
      last_reset: new Date()
    };

    const errorRate = metrics.total_requests > 0 
      ? (metrics.failed_requests / metrics.total_requests) * 100 
      : 0;

    return {
      status: errorRate < this.alertThresholds.error_rate ? 'healthy' : 'degraded',
      total_requests: metrics.total_requests,
      successful_requests: metrics.successful_requests,
      failed_requests: metrics.failed_requests,
      error_rate: Math.round(errorRate * 100) / 100,
      average_response_time: metrics.average_response_time,
      last_reset: metrics.last_reset
    };
  }

  /**
   * Get blockchain adapters health
   */
  async getBlockchainHealth() {
    const adapters = ['ethereum', 'binance', 'avalanche', 'polygon', 'xdc', 'solana', 'xrp', 'stellar'];
    const adapterHealth = {};

    for (const adapter of adapters) {
      try {
        // Simulate adapter health check
        // In production, this would check actual blockchain adapter status
        const isHealthy = Math.random() > 0.1; // 90% chance of being healthy
        
        adapterHealth[adapter] = {
          status: isHealthy ? 'online' : 'offline',
          last_block: isHealthy ? Math.floor(Math.random() * 1000000) : null,
          response_time: isHealthy ? Math.floor(Math.random() * 1000) + 100 : null,
          last_check: new Date()
        };
      } catch (error) {
        adapterHealth[adapter] = {
          status: 'error',
          error: error.message,
          last_check: new Date()
        };
      }
    }

    const onlineAdapters = Object.values(adapterHealth).filter(a => a.status === 'online').length;
    const totalAdapters = adapters.length;

    return {
      overall_status: onlineAdapters === totalAdapters ? 'healthy' : onlineAdapters > totalAdapters / 2 ? 'degraded' : 'critical',
      online_adapters: onlineAdapters,
      total_adapters: totalAdapters,
      adapters: adapterHealth
    };
  }

  /**
   * Get services health
   */
  async getServicesHealth() {
    const services = {
      nft_service: this.checkServiceHealth('nft'),
      trading_service: this.checkServiceHealth('trading'),
      risk_service: this.checkServiceHealth('risk'),
      analytics_service: this.checkServiceHealth('analytics'),
      user_service: this.checkServiceHealth('user'),
      bridge_service: this.checkServiceHealth('bridge')
    };

    const healthyServices = Object.values(services).filter(s => s.status === 'healthy').length;
    const totalServices = Object.keys(services).length;

    return {
      overall_status: healthyServices === totalServices ? 'healthy' : healthyServices > totalServices / 2 ? 'degraded' : 'critical',
      healthy_services: healthyServices,
      total_services: totalServices,
      services
    };
  }

  /**
   * Check individual service health
   */
  checkServiceHealth(serviceName) {
    // Simulate service health check
    // In production, this would check actual service status
    const isHealthy = Math.random() > 0.05; // 95% chance of being healthy
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      memory_usage: process.memoryUsage().heapUsed,
      last_check: new Date()
    };
  }

  /**
   * Store health data in database
   */
  async storeHealthData(healthData) {
    try {
      await this.db.sequelize.query(`
        INSERT INTO system_health_logs (
          timestamp,
          cpu_usage,
          memory_usage,
          disk_usage,
          database_latency,
          api_error_rate,
          blockchain_status,
          services_status,
          raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [
          healthData.timestamp,
          healthData.system.cpu_usage,
          healthData.system.memory_usage.percentage,
          healthData.system.disk_usage.percentage,
          healthData.database.latency,
          healthData.api.error_rate,
          healthData.blockchain.overall_status,
          healthData.services.overall_status,
          JSON.stringify(healthData)
        ]
      });
    } catch (error) {
      console.error('Failed to store health data:', error);
    }
  }

  /**
   * Check for alert conditions
   */
  async checkAlerts(healthData) {
    const alerts = [];

    // CPU usage alert
    if (healthData.system.cpu_usage > this.alertThresholds.cpu_usage) {
      alerts.push({
        severity: healthData.system.cpu_usage > 95 ? 'critical' : 'warning',
        type: 'high_cpu_usage',
        message: `High CPU usage: ${healthData.system.cpu_usage}%`,
        data: { cpu_usage: healthData.system.cpu_usage }
      });
    }

    // Memory usage alert
    if (healthData.system.memory_usage.percentage > this.alertThresholds.memory_usage) {
      alerts.push({
        severity: healthData.system.memory_usage.percentage > 95 ? 'critical' : 'warning',
        type: 'high_memory_usage',
        message: `High memory usage: ${healthData.system.memory_usage.percentage}%`,
        data: { memory_usage: healthData.system.memory_usage.percentage }
      });
    }

    // Database latency alert
    if (healthData.database.latency > this.alertThresholds.database_latency) {
      alerts.push({
        severity: healthData.database.latency > 5000 ? 'critical' : 'warning',
        type: 'high_database_latency',
        message: `High database latency: ${healthData.database.latency}ms`,
        data: { database_latency: healthData.database.latency }
      });
    }

    // API error rate alert
    if (healthData.api.error_rate > this.alertThresholds.error_rate) {
      alerts.push({
        severity: healthData.api.error_rate > 20 ? 'critical' : 'warning',
        type: 'high_error_rate',
        message: `High API error rate: ${healthData.api.error_rate}%`,
        data: { error_rate: healthData.api.error_rate }
      });
    }

    // Blockchain adapter alerts
    if (healthData.blockchain.overall_status === 'critical') {
      alerts.push({
        severity: 'critical',
        type: 'blockchain_adapters_down',
        message: `Multiple blockchain adapters offline: ${healthData.blockchain.online_adapters}/${healthData.blockchain.total_adapters}`,
        data: { blockchain_status: healthData.blockchain }
      });
    }

    // Services alerts
    if (healthData.services.overall_status === 'critical') {
      alerts.push({
        severity: 'critical',
        type: 'services_down',
        message: `Multiple services unhealthy: ${healthData.services.healthy_services}/${healthData.services.total_services}`,
        data: { services_status: healthData.services }
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.createAlert(alert.severity, alert.type, alert.message, alert.data);
    }
  }

  /**
   * Create and process alert
   */
  async createAlert(severity, type, message, data = {}) {
    try {
      const alertId = `${type}_${Date.now()}`;
      const alert = {
        id: alertId,
        severity,
        type,
        message,
        data,
        created_at: new Date(),
        resolved: false
      };

      // Store alert
      this.alerts.set(alertId, alert);

      // Store in database
      await this.db.sequelize.query(`
        INSERT INTO system_alerts (
          alert_id,
          severity,
          alert_type,
          message,
          alert_data,
          created_at,
          resolved
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [
          alertId,
          severity,
          type,
          message,
          JSON.stringify(data),
          alert.created_at,
          false
        ]
      });

      // Send notifications
      await this.sendAlertNotifications(alert);

      // Emit real-time alert
      this.io.to('admin_monitoring').emit('new_alert', alert);

      console.log(`[Alert] ${severity.toUpperCase()}: ${message}`);
      
      return alert;
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  /**
   * Send alert notifications
   */
  async sendAlertNotifications(alert) {
    try {
      // Email notification for critical alerts
      if (alert.severity === 'critical' && this.emailTransporter) {
        await this.sendEmailAlert(alert);
      }

      // You could add other notification methods here (Slack, Discord, etc.)
    } catch (error) {
      console.error('Failed to send alert notifications:', error);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'alerts@dbx.com',
        to: process.env.ALERT_EMAIL || 'admin@dbx.com',
        subject: `[DBX Alert] ${alert.severity.toUpperCase()}: ${alert.type}`,
        html: `
          <h2>DBX System Alert</h2>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Time:</strong> ${alert.created_at.toLocaleString()}</p>
          <p><strong>Data:</strong></p>
          <pre>${JSON.stringify(alert.data, null, 2)}</pre>
          <p>Please check the admin dashboard for more details.</p>
        `
      };

      await this.emailTransporter.sendMail(mailOptions);
      console.log(`Email alert sent for: ${alert.type}`);
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Get current system status
   */
  getCurrentStatus() {
    return this.lastHealthCheck;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 50) {
    const alerts = Array.from(this.alerts.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
    
    return alerts;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId, adminId, resolution) {
    try {
      const alert = this.alerts.get(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      alert.resolved = true;
      alert.resolved_at = new Date();
      alert.resolved_by = adminId;
      alert.resolution = resolution;

      // Update in database
      await this.db.sequelize.query(`
        UPDATE system_alerts 
        SET resolved = true,
            resolved_at = ?,
            resolved_by = ?,
            resolution = ?
        WHERE alert_id = ?
      `, {
        replacements: [alert.resolved_at, adminId, resolution, alertId]
      });

      // Emit update
      this.io.to('admin_monitoring').emit('alert_resolved', alert);

      return alert;
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    console.log('Alert thresholds updated:', this.alertThresholds);
  }

  /**
   * Get system metrics history
   */
  async getMetricsHistory(timeRange = '24h') {
    try {
      let timeCondition;
      switch (timeRange) {
        case '1h':
          timeCondition = 'timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
          break;
        case '24h':
          timeCondition = 'timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
          break;
        case '7d':
          timeCondition = 'timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
          timeCondition = 'timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        default:
          timeCondition = 'timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
      }

      const [results] = await this.db.sequelize.query(`
        SELECT 
          timestamp,
          cpu_usage,
          memory_usage,
          disk_usage,
          database_latency,
          api_error_rate,
          blockchain_status,
          services_status
        FROM system_health_logs 
        WHERE ${timeCondition}
        ORDER BY timestamp ASC
      `);

      return results;
    } catch (error) {
      console.error('Failed to get metrics history:', error);
      return [];
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(timeRange = '24h') {
    try {
      let timeCondition;
      switch (timeRange) {
        case '1h':
          timeCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
          break;
        case '24h':
          timeCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
          break;
        case '7d':
          timeCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30d':
          timeCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        default:
          timeCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
      }

      const [results] = await this.db.sequelize.query(`
        SELECT 
          severity,
          alert_type,
          COUNT(*) as count,
          COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_count
        FROM system_alerts 
        WHERE ${timeCondition}
        GROUP BY severity, alert_type
        ORDER BY count DESC
      `);

      return results;
    } catch (error) {
      console.error('Failed to get alert statistics:', error);
      return [];
    }
  }

  /**
   * Record API metrics
   */
  recordAPIMetrics(responseTime, success) {
    const metrics = this.metrics.get('api') || {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      total_response_time: 0,
      average_response_time: 0,
      last_reset: new Date()
    };

    metrics.total_requests++;
    metrics.total_response_time += responseTime;
    
    if (success) {
      metrics.successful_requests++;
    } else {
      metrics.failed_requests++;
    }

    metrics.average_response_time = metrics.total_response_time / metrics.total_requests;

    this.metrics.set('api', metrics);
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.clear();
    console.log('System metrics reset');
  }
}

module.exports = SystemHealthMonitoringService;

