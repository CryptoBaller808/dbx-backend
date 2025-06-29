/**
 * System Health Log Model
 * Stores system metrics and health monitoring data
 */

module.exports = (sequelize, DataTypes) => {
  const SystemHealthLog = sequelize.define(
    "SystemHealthLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Timestamp when the health metrics were recorded'
      },
      cpu_usage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'CPU usage percentage (0-100)'
      },
      memory_usage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Memory usage percentage (0-100)'
      },
      disk_usage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Disk usage percentage (0-100)'
      },
      database_latency: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        comment: 'Database response latency in milliseconds'
      },
      api_error_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'API error rate percentage (0-100)'
      },
      blockchain_status: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Status of blockchain connections and services'
      },
      services_status: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Status of various backend services'
      },
      raw_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Raw health monitoring data in JSON format'
      },
      // Standard Sequelize timestamp fields
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
    },
    {
      tableName: "system_health_logs",
      timestamps: true,
      indexes: [
        {
          fields: ['timestamp']
        },
        {
          fields: ['cpu_usage']
        },
        {
          fields: ['memory_usage']
        },
        {
          fields: ['database_latency']
        },
        {
          fields: ['api_error_rate']
        },
        {
          fields: ['createdAt']
        }
      ],
      hooks: {
        beforeCreate: (healthLog, options) => {
          // Ensure timestamp is set if not provided
          if (!healthLog.timestamp) {
            healthLog.timestamp = new Date();
          }
        },
        afterCreate: (healthLog, options) => {
          // Log when critical thresholds are exceeded
          if (healthLog.cpu_usage > 90) {
            console.warn(`[SystemHealth] High CPU usage detected: ${healthLog.cpu_usage}%`);
          }
          if (healthLog.memory_usage > 90) {
            console.warn(`[SystemHealth] High memory usage detected: ${healthLog.memory_usage}%`);
          }
          if (healthLog.database_latency > 1000) {
            console.warn(`[SystemHealth] High database latency detected: ${healthLog.database_latency}ms`);
          }
          if (healthLog.api_error_rate > 5) {
            console.warn(`[SystemHealth] High API error rate detected: ${healthLog.api_error_rate}%`);
          }
        }
      }
    }
  );

  // Instance methods
  SystemHealthLog.prototype.isHealthy = function() {
    return (
      (this.cpu_usage || 0) < 80 &&
      (this.memory_usage || 0) < 80 &&
      (this.database_latency || 0) < 500 &&
      (this.api_error_rate || 0) < 2
    );
  };

  SystemHealthLog.prototype.getHealthScore = function() {
    let score = 100;
    
    // Deduct points for high resource usage
    if (this.cpu_usage > 70) score -= (this.cpu_usage - 70) * 2;
    if (this.memory_usage > 70) score -= (this.memory_usage - 70) * 2;
    if (this.database_latency > 200) score -= (this.database_latency - 200) / 10;
    if (this.api_error_rate > 1) score -= this.api_error_rate * 10;
    
    return Math.max(0, Math.min(100, score));
  };

  // Class methods
  SystemHealthLog.getRecentHealth = async function(minutes = 60) {
    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
    
    return await this.findAll({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.gte]: timeThreshold
        }
      },
      order: [['timestamp', 'DESC']],
      limit: 100
    });
  };

  SystemHealthLog.getAverageMetrics = async function(hours = 24) {
    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await this.findOne({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.gte]: timeThreshold
        }
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('cpu_usage')), 'avg_cpu'],
        [sequelize.fn('AVG', sequelize.col('memory_usage')), 'avg_memory'],
        [sequelize.fn('AVG', sequelize.col('database_latency')), 'avg_latency'],
        [sequelize.fn('AVG', sequelize.col('api_error_rate')), 'avg_error_rate'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_records']
      ],
      raw: true
    });
  };

  SystemHealthLog.cleanupOldLogs = async function(daysToKeep = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const deletedCount = await this.destroy({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
    
    console.log(`[SystemHealthLog] Cleaned up ${deletedCount} old health log records`);
    return deletedCount;
  };

  return SystemHealthLog;
};

