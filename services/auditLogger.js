const { audit_logs } = require('../models');
const geoip = require('geoip-lite');

/**
 * Audit Logging Service for DBX Platform
 * Comprehensive logging for security, compliance, and monitoring
 */
class AuditLogger {
  
  /**
   * Log user authentication events
   */
  static async logUserAuth(eventType, req, user = null, additionalData = {}) {
    try {
      // Get models from the database instance
      const { audit_logs } = require('../models');
      
      const ip = this.getClientIP(req);
      const geo = geoip.lookup(ip);
      
      const auditData = {
        event_type: eventType,
        severity: eventType.includes('FAILED') ? 'HIGH' : 'LOW',
        user_id: user?.id || null,
        user_email: user?.email || additionalData.email || null,
        user_wallet: user?.wallet || null,
        session_id: req.sessionID || req.headers['x-session-id'],
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_method: req.method,
        request_url: req.originalUrl,
        request_headers: this.sanitizeHeaders(req.headers),
        action: this.getActionFromEventType(eventType),
        description: this.getDescriptionFromEventType(eventType, user),
        event_data: {
          ...additionalData,
          timestamp: new Date().toISOString()
        },
        status: additionalData.success !== false ? 'SUCCESS' : 'FAILED',
        error_code: additionalData.error_code || null,
        error_message: additionalData.error_message || null,
        compliance_category: 'SECURITY',
        country_code: geo?.country || null,
        region: geo?.region || null,
        is_suspicious: this.detectSuspiciousActivity(eventType, ip, user),
        requires_review: eventType.includes('FAILED') || eventType.includes('SUSPICIOUS')
      };

      return await audit_logs.create(auditData);
    } catch (error) {
      console.error('[Audit Logger] Failed to log user auth event:', error);
      // Don't throw error to avoid breaking main flow
    }
  }

  /**
   * Log transaction events
   */
  static async logTransaction(eventType, req, user, transactionData = {}) {
    try {
      const ip = this.getClientIP(req);
      const geo = geoip.lookup(ip);
      
      const auditData = {
        event_type: eventType,
        severity: this.getTransactionSeverity(transactionData),
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_wallet: user?.wallet || null,
        session_id: req.sessionID || req.headers['x-session-id'],
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_method: req.method,
        request_url: req.originalUrl,
        action: this.getActionFromEventType(eventType),
        description: `${eventType.replace('_', ' ').toLowerCase()} transaction`,
        event_data: {
          ...transactionData,
          timestamp: new Date().toISOString()
        },
        resource_type: 'TRANSACTION',
        resource_id: transactionData.transaction_id || transactionData.hash,
        transaction_hash: transactionData.hash || transactionData.transaction_hash,
        blockchain_network: transactionData.network?.toUpperCase(),
        status: transactionData.status || 'PENDING',
        compliance_category: 'FINANCIAL',
        retention_period_days: 2555, // 7 years for financial records
        country_code: geo?.country || null,
        region: geo?.region || null,
        risk_score: this.calculateTransactionRiskScore(transactionData),
        is_suspicious: this.detectSuspiciousTransaction(transactionData, user)
      };

      return await audit_logs.create(auditData);
    } catch (error) {
      console.error('[Audit Logger] Failed to log transaction event:', error);
    }
  }

  /**
   * Log NFT events
   */
  static async logNFT(eventType, req, user, nftData = {}) {
    try {
      const ip = this.getClientIP(req);
      const geo = geoip.lookup(ip);
      
      const auditData = {
        event_type: eventType,
        severity: 'MEDIUM',
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_wallet: user?.wallet || null,
        session_id: req.sessionID || req.headers['x-session-id'],
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_method: req.method,
        request_url: req.originalUrl,
        action: this.getActionFromEventType(eventType),
        description: `${eventType.replace('_', ' ').toLowerCase()} NFT operation`,
        event_data: {
          ...nftData,
          timestamp: new Date().toISOString()
        },
        resource_type: 'NFT',
        resource_id: nftData.token_id || nftData.nft_id,
        transaction_hash: nftData.transaction_hash,
        blockchain_network: nftData.network?.toUpperCase(),
        status: nftData.status || 'SUCCESS',
        compliance_category: 'FINANCIAL',
        country_code: geo?.country || null,
        region: geo?.region || null
      };

      return await audit_logs.create(auditData);
    } catch (error) {
      console.error('[Audit Logger] Failed to log NFT event:', error);
    }
  }

  /**
   * Log admin actions
   */
  static async logAdminAction(eventType, req, admin, actionData = {}) {
    try {
      const ip = this.getClientIP(req);
      const geo = geoip.lookup(ip);
      
      const auditData = {
        event_type: eventType,
        severity: 'HIGH',
        user_id: admin?.id || null,
        user_email: admin?.email || null,
        session_id: req.sessionID || req.headers['x-session-id'],
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_method: req.method,
        request_url: req.originalUrl,
        action: this.getActionFromEventType(eventType),
        description: `Admin ${eventType.replace('ADMIN_', '').replace('_', ' ').toLowerCase()}`,
        event_data: {
          ...actionData,
          admin_role: admin?.role,
          timestamp: new Date().toISOString()
        },
        before_state: actionData.before_state || null,
        after_state: actionData.after_state || null,
        resource_type: actionData.resource_type || 'ADMIN',
        resource_id: actionData.resource_id || null,
        status: actionData.success !== false ? 'SUCCESS' : 'FAILED',
        compliance_category: 'OPERATIONAL',
        country_code: geo?.country || null,
        region: geo?.region || null,
        requires_review: true
      };

      return await audit_logs.create(auditData);
    } catch (error) {
      console.error('[Audit Logger] Failed to log admin action:', error);
    }
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(eventType, req, details = {}) {
    try {
      const ip = this.getClientIP(req);
      const geo = geoip.lookup(ip);
      
      const auditData = {
        event_type: eventType,
        severity: 'CRITICAL',
        user_id: details.user_id || null,
        user_email: details.user_email || null,
        session_id: req.sessionID || req.headers['x-session-id'],
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_method: req.method,
        request_url: req.originalUrl,
        action: this.getActionFromEventType(eventType),
        description: details.description || `Security event: ${eventType}`,
        event_data: {
          ...details,
          timestamp: new Date().toISOString()
        },
        status: 'FAILED',
        error_code: details.error_code || 'SECURITY_VIOLATION',
        error_message: details.error_message || 'Security policy violation detected',
        compliance_category: 'SECURITY',
        country_code: geo?.country || null,
        region: geo?.region || null,
        risk_score: 90,
        is_suspicious: true,
        requires_review: true
      };

      return await audit_logs.create(auditData);
    } catch (error) {
      console.error('[Audit Logger] Failed to log security event:', error);
    }
  }

  /**
   * Log API access
   */
  static async logAPIAccess(req, res, responseTime) {
    try {
      const ip = this.getClientIP(req);
      const geo = geoip.lookup(ip);
      
      const auditData = {
        event_type: 'API_ACCESS',
        severity: 'LOW',
        user_id: req.user?.id || null,
        user_email: req.user?.email || null,
        session_id: req.sessionID || req.headers['x-session-id'],
        ip_address: ip,
        user_agent: req.headers['user-agent'],
        request_method: req.method,
        request_url: req.originalUrl,
        request_headers: this.sanitizeHeaders(req.headers),
        action: `${req.method} ${req.route?.path || req.originalUrl}`,
        description: `API access to ${req.originalUrl}`,
        event_data: {
          query_params: req.query,
          body_size: JSON.stringify(req.body || {}).length,
          timestamp: new Date().toISOString()
        },
        status: res.statusCode >= 200 && res.statusCode < 400 ? 'SUCCESS' : 'FAILED',
        error_code: res.statusCode >= 400 ? res.statusCode.toString() : null,
        response_time_ms: responseTime,
        compliance_category: 'OPERATIONAL',
        country_code: geo?.country || null,
        region: geo?.region || null,
        is_suspicious: this.detectSuspiciousAPIAccess(req, res)
      };

      // Only log if it's not a health check or static asset
      if (!req.originalUrl.includes('/health') && !req.originalUrl.includes('/static')) {
        return await audit_logs.create(auditData);
      }
    } catch (error) {
      console.error('[Audit Logger] Failed to log API access:', error);
    }
  }

  /**
   * Helper methods
   */
  static getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           '127.0.0.1';
  }

  static sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }

  static getActionFromEventType(eventType) {
    const actionMap = {
      'USER_LOGIN': 'login',
      'USER_LOGOUT': 'logout',
      'USER_REGISTRATION': 'register',
      'USER_PROFILE_UPDATE': 'update_profile',
      'PASSWORD_CHANGE': 'change_password',
      'MFA_SETUP': 'setup_mfa',
      'MFA_DISABLE': 'disable_mfa',
      'MFA_VERIFICATION': 'verify_mfa',
      'WALLET_CONNECT': 'connect_wallet',
      'WALLET_DISCONNECT': 'disconnect_wallet',
      'TRANSACTION_SEND': 'send_transaction',
      'TRANSACTION_RECEIVE': 'receive_transaction',
      'TRANSACTION_SWAP': 'swap_tokens',
      'TRANSACTION_BRIDGE': 'bridge_tokens',
      'NFT_MINT': 'mint_nft',
      'NFT_TRANSFER': 'transfer_nft',
      'NFT_LIST': 'list_nft',
      'NFT_PURCHASE': 'purchase_nft',
      'ADMIN_LOGIN': 'admin_login',
      'ADMIN_USER_MANAGE': 'manage_user',
      'ADMIN_SETTINGS_CHANGE': 'change_settings',
      'SECURITY_FAILED_LOGIN': 'failed_login',
      'SECURITY_SUSPICIOUS_ACTIVITY': 'suspicious_activity',
      'API_ACCESS': 'api_access'
    };
    
    return actionMap[eventType] || eventType.toLowerCase();
  }

  static getDescriptionFromEventType(eventType, user = null) {
    const userInfo = user ? ` for user ${user.email}` : '';
    
    const descriptionMap = {
      'USER_LOGIN': `User login attempt${userInfo}`,
      'USER_LOGOUT': `User logout${userInfo}`,
      'USER_REGISTRATION': `New user registration${userInfo}`,
      'SECURITY_FAILED_LOGIN': `Failed login attempt${userInfo}`,
      'MFA_SETUP': `MFA setup${userInfo}`,
      'MFA_VERIFICATION': `MFA verification${userInfo}`
    };
    
    return descriptionMap[eventType] || `${eventType.replace('_', ' ').toLowerCase()}${userInfo}`;
  }

  static getTransactionSeverity(transactionData) {
    const amount = parseFloat(transactionData.amount || 0);
    
    if (amount > 100000) return 'CRITICAL';
    if (amount > 10000) return 'HIGH';
    if (amount > 1000) return 'MEDIUM';
    return 'LOW';
  }

  static calculateTransactionRiskScore(transactionData) {
    let score = 0;
    
    // High amount transactions
    const amount = parseFloat(transactionData.amount || 0);
    if (amount > 100000) score += 40;
    else if (amount > 10000) score += 20;
    else if (amount > 1000) score += 10;
    
    // Cross-border transactions
    if (transactionData.is_cross_border) score += 15;
    
    // New wallet addresses
    if (transactionData.is_new_address) score += 10;
    
    // Unusual time patterns
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) score += 5;
    
    return Math.min(score, 100);
  }

  static detectSuspiciousActivity(eventType, ip, user) {
    // Basic suspicious activity detection
    if (eventType.includes('FAILED')) return true;
    if (eventType.includes('SUSPICIOUS')) return true;
    
    // Add more sophisticated detection logic here
    return false;
  }

  static detectSuspiciousTransaction(transactionData, user) {
    const amount = parseFloat(transactionData.amount || 0);
    
    // Very high amounts
    if (amount > 100000) return true;
    
    // Rapid successive transactions
    if (transactionData.is_rapid_succession) return true;
    
    // Unusual patterns
    if (transactionData.unusual_pattern) return true;
    
    return false;
  }

  static detectSuspiciousAPIAccess(req, res) {
    // High frequency requests
    if (req.headers['x-request-count'] && parseInt(req.headers['x-request-count']) > 100) {
      return true;
    }
    
    // Error responses
    if (res.statusCode >= 400) return true;
    
    return false;
  }
}

module.exports = AuditLogger;

