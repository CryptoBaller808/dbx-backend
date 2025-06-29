/**
 * System Alert Model
 * Tracks system alerts, warnings, and critical notifications
 */

module.exports = (sequelize, DataTypes) => {
  const SystemAlert = sequelize.define(
    "SystemAlert",
    {
      alert_id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      severity: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [['info', 'warning', 'critical', 'error']]
        }
      },
      alert_type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      alert_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      resolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      // Timestamp fields with explicit mapping
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: "system_alerts",
      timestamps: true,
      indexes: [
        {
          fields: ['severity']
        },
        {
          fields: ['alert_type']
        },
        {
          fields: ['resolved']
        },
        {
          fields: ['created_at']
        },
        {
          fields: ['severity', 'resolved']
        }
      ]
    }
  );

  // Instance Methods
  SystemAlert.prototype.resolve = function() {
    this.resolved = true;
    return this.save();
  };

  SystemAlert.prototype.isResolved = function() {
    return this.resolved;
  };

  SystemAlert.prototype.isCritical = function() {
    return this.severity === 'critical';
  };

  // Class Methods
  SystemAlert.getUnresolvedAlerts = function() {
    return this.findAll({
      where: { resolved: false },
      order: [['createdAt', 'DESC']]
    });
  };

  SystemAlert.getCriticalAlerts = function() {
    return this.findAll({
      where: { 
        severity: 'critical',
        resolved: false 
      },
      order: [['createdAt', 'DESC']]
    });
  };

  SystemAlert.getAlertsByType = function(alertType) {
    return this.findAll({
      where: { alert_type: alertType },
      order: [['createdAt', 'DESC']]
    });
  };

  SystemAlert.resolveAlert = async function(alertId) {
    const alert = await this.findByPk(alertId);
    if (alert) {
      return await alert.resolve();
    }
    return null;
  };

  SystemAlert.cleanupOldAlerts = async function(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    return await this.destroy({
      where: {
        createdAt: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        },
        resolved: true
      }
    });
  };

  return SystemAlert;
};

