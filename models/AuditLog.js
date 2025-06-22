const { DataTypes } = require('sequelize');

/**
 * Audit Log Model for DBX Platform
 * Comprehensive logging for security, compliance, and monitoring
 */
module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('audit_logs', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // Event Classification
    event_type: {
      type: DataTypes.ENUM(
        'USER_LOGIN',
        'USER_LOGOUT', 
        'USER_REGISTRATION',
        'USER_PROFILE_UPDATE',
        'PASSWORD_CHANGE',
        'MFA_SETUP',
        'MFA_DISABLE',
        'MFA_VERIFICATION',
        'WALLET_CONNECT',
        'WALLET_DISCONNECT',
        'TRANSACTION_SEND',
        'TRANSACTION_RECEIVE',
        'TRANSACTION_SWAP',
        'TRANSACTION_BRIDGE',
        'NFT_MINT',
        'NFT_TRANSFER',
        'NFT_LIST',
        'NFT_PURCHASE',
        'ADMIN_LOGIN',
        'ADMIN_USER_MANAGE',
        'ADMIN_SETTINGS_CHANGE',
        'ADMIN_SYSTEM_CONFIG',
        'SECURITY_FAILED_LOGIN',
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'SECURITY_RATE_LIMIT_HIT',
        'SECURITY_VALIDATION_FAILED',
        'API_ACCESS',
        'DATABASE_QUERY',
        'SYSTEM_ERROR',
        'COMPLIANCE_REPORT'
      ),
      allowNull: false,
      index: true
    },
    
    // Event Severity
    severity: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      allowNull: false,
      defaultValue: 'LOW',
      index: true
    },
    
    // User Information
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      index: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    user_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      index: true
    },
    
    user_wallet: {
      type: DataTypes.STRING(255),
      allowNull: true,
      index: true
    },
    
    // Session Information
    session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      index: true
    },
    
    // Request Information
    ip_address: {
      type: DataTypes.STRING(45), // IPv6 support
      allowNull: true,
      index: true
    },
    
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    request_method: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    
    request_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    
    request_headers: {
      type: DataTypes.JSON,
      allowNull: true
    },
    
    // Event Details
    action: {
      type: DataTypes.STRING(255),
      allowNull: false,
      index: true
    },
    
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Event Data
    event_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    
    // Before/After State for Changes
    before_state: {
      type: DataTypes.JSON,
      allowNull: true
    },
    
    after_state: {
      type: DataTypes.JSON,
      allowNull: true
    },
    
    // Transaction/Resource Information
    resource_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      index: true
    },
    
    resource_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      index: true
    },
    
    transaction_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      index: true
    },
    
    blockchain_network: {
      type: DataTypes.ENUM(
        'ETHEREUM',
        'XRP',
        'SOLANA', 
        'STELLAR',
        'XDC',
        'AVALANCHE',
        'POLYGON',
        'BSC'
      ),
      allowNull: true,
      index: true
    },
    
    // Result Information
    status: {
      type: DataTypes.ENUM('SUCCESS', 'FAILED', 'PENDING', 'ERROR'),
      allowNull: false,
      defaultValue: 'SUCCESS',
      index: true
    },
    
    error_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
      index: true
    },
    
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Performance Metrics
    response_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    
    // Compliance and Retention
    compliance_category: {
      type: DataTypes.ENUM(
        'FINANCIAL',
        'SECURITY', 
        'PRIVACY',
        'OPERATIONAL',
        'REGULATORY'
      ),
      allowNull: true,
      index: true
    },
    
    retention_period_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2555 // 7 years default for financial compliance
    },
    
    // Geolocation
    country_code: {
      type: DataTypes.STRING(2),
      allowNull: true,
      index: true
    },
    
    region: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    
    // Risk Assessment
    risk_score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    
    // Flags
    is_suspicious: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      index: true
    },
    
    requires_review: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      index: true
    },
    
    is_archived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      index: true
    },
    
    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      index: true
    },
    
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    
    indexes: [
      // Primary performance indexes
      {
        name: 'idx_audit_user_event_time',
        fields: ['user_id', 'event_type', 'created_at']
      },
      {
        name: 'idx_audit_ip_time',
        fields: ['ip_address', 'created_at']
      },
      {
        name: 'idx_audit_severity_time',
        fields: ['severity', 'created_at']
      },
      {
        name: 'idx_audit_status_time',
        fields: ['status', 'created_at']
      },
      {
        name: 'idx_audit_compliance_time',
        fields: ['compliance_category', 'created_at']
      },
      {
        name: 'idx_audit_suspicious',
        fields: ['is_suspicious', 'requires_review', 'created_at']
      },
      {
        name: 'idx_audit_transaction',
        fields: ['transaction_hash', 'blockchain_network']
      },
      {
        name: 'idx_audit_resource',
        fields: ['resource_type', 'resource_id']
      },
      {
        name: 'idx_audit_session',
        fields: ['session_id', 'created_at']
      },
      {
        name: 'idx_audit_retention',
        fields: ['retention_period_days', 'created_at']
      }
    ],
    
    // Table options
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  });

  // Instance methods
  AuditLog.prototype.toSafeJSON = function() {
    const values = { ...this.dataValues };
    
    // Remove sensitive data from logs
    if (values.request_headers) {
      delete values.request_headers.authorization;
      delete values.request_headers.cookie;
    }
    
    if (values.event_data && values.event_data.password) {
      values.event_data.password = '[REDACTED]';
    }
    
    if (values.event_data && values.event_data.private_key) {
      values.event_data.private_key = '[REDACTED]';
    }
    
    return values;
  };

  // Class methods
  AuditLog.createSecurityEvent = async function(eventData) {
    return await this.create({
      ...eventData,
      severity: 'HIGH',
      compliance_category: 'SECURITY',
      requires_review: true
    });
  };

  AuditLog.createTransactionEvent = async function(eventData) {
    return await this.create({
      ...eventData,
      compliance_category: 'FINANCIAL',
      retention_period_days: 2555 // 7 years
    });
  };

  AuditLog.createUserEvent = async function(eventData) {
    return await this.create({
      ...eventData,
      compliance_category: 'OPERATIONAL'
    });
  };

  AuditLog.findSuspiciousActivity = async function(timeframe = '24h') {
    const timeMap = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    
    const hours = timeMap[timeframe] || 24;
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return await this.findAll({
      where: {
        is_suspicious: true,
        created_at: {
          [sequelize.Sequelize.Op.gte]: since
        }
      },
      order: [['created_at', 'DESC']],
      limit: 100
    });
  };

  AuditLog.getComplianceReport = async function(category, startDate, endDate) {
    return await this.findAll({
      where: {
        compliance_category: category,
        created_at: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['created_at', 'DESC']]
    });
  };

  return AuditLog;
};

