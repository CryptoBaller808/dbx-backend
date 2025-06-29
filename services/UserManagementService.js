/**
 * User Management & Compliance Service
 * Comprehensive user management, KYC review, and compliance tools
 */

const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

class UserManagementService {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.initializeService();
  }

  async initializeService() {
    console.log('[UserManagementService] Initializing user management and compliance service...');
    
    // Set up file upload for KYC documents
    this.setupFileUpload();
    
    // Initialize compliance monitoring
    this.startComplianceMonitoring();
    
    console.log('[UserManagementService] Service initialized successfully');
  }

  setupFileUpload() {
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/kyc-documents');
        try {
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `kyc-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    });

    this.upload = multer({
      storage,
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Only images and documents are allowed'));
        }
      }
    });
  }

  startComplianceMonitoring() {
    // Monitor for suspicious activities every 5 minutes
    setInterval(async () => {
      try {
        await this.checkSuspiciousActivities();
        await this.performSanctionsCheck();
        await this.generateAMLAlerts();
      } catch (error) {
        console.error('[UserManagementService] Compliance monitoring error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // User Management Methods
  async getAllUsers(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        search = '',
        kycStatus = '',
        userTier = '',
        status = '',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = filters;

      const offset = (page - 1) * limit;
      const whereClause = {};

      // Apply filters
      if (search) {
        whereClause[Op.or] = [
          { username: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { first_name: { [Op.iLike]: `%${search}%` } },
          { last_name: { [Op.iLike]: `%${search}%` } }
        ];
      }

      if (kycStatus) {
        whereClause.kyc_status = kycStatus;
      }

      if (userTier) {
        whereClause.user_tier = userTier;
      }

      if (status) {
        whereClause.status = status;
      }

      const { count, rows } = await this.db.users.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder.toUpperCase()]],
        attributes: {
          exclude: ['password', 'reset_token', 'verification_token']
        }
      });

      return {
        users: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      console.error('[UserManagementService] Error fetching users:', error);
      throw error;
    }
  }

  async getUserProfile(userId) {
    try {
      const user = await this.db.users.findByPk(userId, {
        attributes: {
          exclude: ['password', 'reset_token', 'verification_token']
        },
        include: [
          {
            model: this.db.audit_logs,
            as: 'auditLogs',
            limit: 10,
            order: [['created_at', 'DESC']]
          }
        ]
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get user's transaction history
      const transactions = await this.getUserTransactionHistory(userId);
      
      // Get user's wallet information
      const wallets = await this.getUserWallets(userId);
      
      // Get compliance events
      const complianceEvents = await this.getUserComplianceEvents(userId);

      return {
        user,
        transactions,
        wallets,
        complianceEvents
      };
    } catch (error) {
      console.error('[UserManagementService] Error fetching user profile:', error);
      throw error;
    }
  }

  async getUserTransactionHistory(userId, limit = 20) {
    try {
      // This would typically query multiple transaction tables
      // For now, we'll simulate with a basic structure
      const transactions = await this.db.sequelize.query(`
        SELECT 
          'nft_transaction' as type,
          transaction_hash,
          blockchain,
          amount,
          status,
          created_at
        FROM nft_transactions 
        WHERE buyer_id = :userId OR seller_id = :userId
        ORDER BY created_at DESC
        LIMIT :limit
      `, {
        replacements: { userId, limit },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return transactions;
    } catch (error) {
      console.error('[UserManagementService] Error fetching transaction history:', error);
      return [];
    }
  }

  async getUserWallets(userId) {
    try {
      // Query user's connected wallets
      const wallets = await this.db.sequelize.query(`
        SELECT 
          blockchain,
          wallet_address,
          is_verified,
          created_at
        FROM user_wallets 
        WHERE user_id = :userId
        ORDER BY created_at DESC
      `, {
        replacements: { userId },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return wallets;
    } catch (error) {
      console.error('[UserManagementService] Error fetching user wallets:', error);
      return [];
    }
  }

  async getUserComplianceEvents(userId) {
    try {
      // Query compliance events for the user
      const events = await this.db.sequelize.query(`
        SELECT 
          event_type,
          severity,
          description,
          status,
          created_at
        FROM compliance_events 
        WHERE user_id = :userId
        ORDER BY created_at DESC
        LIMIT 10
      `, {
        replacements: { userId },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return events;
    } catch (error) {
      console.error('[UserManagementService] Error fetching compliance events:', error);
      return [];
    }
  }

  async updateUserStatus(userId, status, reason, adminId) {
    try {
      const user = await this.db.users.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldStatus = user.status;
      await user.update({ status });

      // Log the action
      await this.logAdminAction(adminId, 'user_status_update', {
        userId,
        oldStatus,
        newStatus: status,
        reason
      });

      // Create compliance event
      await this.createComplianceEvent(userId, 'status_change', 'info', 
        `User status changed from ${oldStatus} to ${status}. Reason: ${reason}`);

      // Notify user via WebSocket
      this.io.to(`user_${userId}`).emit('status_update', {
        status,
        reason,
        timestamp: new Date()
      });

      return { success: true, message: 'User status updated successfully' };
    } catch (error) {
      console.error('[UserManagementService] Error updating user status:', error);
      throw error;
    }
  }

  async flagUser(userId, flagType, reason, adminId) {
    try {
      const user = await this.db.users.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create flag record
      await this.db.sequelize.query(`
        INSERT INTO user_flags (user_id, flag_type, reason, flagged_by, created_at)
        VALUES (:userId, :flagType, :reason, :adminId, NOW())
      `, {
        replacements: { userId, flagType, reason, adminId }
      });

      // Log the action
      await this.logAdminAction(adminId, 'user_flagged', {
        userId,
        flagType,
        reason
      });

      // Create compliance event
      await this.createComplianceEvent(userId, 'user_flagged', 'warning', 
        `User flagged for ${flagType}. Reason: ${reason}`);

      return { success: true, message: 'User flagged successfully' };
    } catch (error) {
      console.error('[UserManagementService] Error flagging user:', error);
      throw error;
    }
  }

  // KYC Management Methods
  async getKYCQueue(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status = 'pending',
        priority = '',
        sortBy = 'submitted_at',
        sortOrder = 'ASC'
      } = filters;

      const offset = (page - 1) * limit;
      const whereClause = { status };

      if (priority) {
        whereClause.priority = priority;
      }

      const kycApplications = await this.db.sequelize.query(`
        SELECT 
          ka.*,
          u.username,
          u.email,
          u.first_name,
          u.last_name
        FROM kyc_applications ka
        JOIN users u ON ka.user_id = u.id
        WHERE ka.status = :status
        ${priority ? 'AND ka.priority = :priority' : ''}
        ORDER BY ka.${sortBy} ${sortOrder.toUpperCase()}
        LIMIT :limit OFFSET :offset
      `, {
        replacements: { status, priority, limit, offset },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      const totalCount = await this.db.sequelize.query(`
        SELECT COUNT(*) as count
        FROM kyc_applications
        WHERE status = :status
        ${priority ? 'AND priority = :priority' : ''}
      `, {
        replacements: { status, priority },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return {
        applications: kycApplications,
        pagination: {
          total: totalCount[0].count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      };
    } catch (error) {
      console.error('[UserManagementService] Error fetching KYC queue:', error);
      throw error;
    }
  }

  async getKYCApplication(applicationId) {
    try {
      const application = await this.db.sequelize.query(`
        SELECT 
          ka.*,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          u.phone,
          u.country
        FROM kyc_applications ka
        JOIN users u ON ka.user_id = u.id
        WHERE ka.id = :applicationId
      `, {
        replacements: { applicationId },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      if (!application.length) {
        throw new Error('KYC application not found');
      }

      // Get uploaded documents
      const documents = await this.db.sequelize.query(`
        SELECT 
          document_type,
          file_path,
          file_name,
          uploaded_at,
          verification_status
        FROM kyc_documents
        WHERE application_id = :applicationId
        ORDER BY uploaded_at DESC
      `, {
        replacements: { applicationId },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return {
        application: application[0],
        documents
      };
    } catch (error) {
      console.error('[UserManagementService] Error fetching KYC application:', error);
      throw error;
    }
  }

  async reviewKYCApplication(applicationId, decision, comments, reviewerId) {
    try {
      const application = await this.db.sequelize.query(`
        SELECT * FROM kyc_applications WHERE id = :applicationId
      `, {
        replacements: { applicationId },
        type: this.db.sequelize.QueryTypes.SELECT
      });

      if (!application.length) {
        throw new Error('KYC application not found');
      }

      const app = application[0];
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';

      // Update application status
      await this.db.sequelize.query(`
        UPDATE kyc_applications 
        SET status = :status, 
            reviewed_by = :reviewerId,
            reviewed_at = NOW(),
            review_comments = :comments
        WHERE id = :applicationId
      `, {
        replacements: { 
          status: newStatus, 
          reviewerId, 
          comments, 
          applicationId 
        }
      });

      // Update user KYC status
      const userKycStatus = decision === 'approve' ? 'verified' : 'rejected';
      await this.db.users.update(
        { kyc_status: userKycStatus },
        { where: { id: app.user_id } }
      );

      // Log the action
      await this.logAdminAction(reviewerId, 'kyc_review', {
        applicationId,
        userId: app.user_id,
        decision,
        comments
      });

      // Create compliance event
      await this.createComplianceEvent(app.user_id, 'kyc_review', 'info', 
        `KYC application ${decision}. Comments: ${comments}`);

      // Notify user
      this.io.to(`user_${app.user_id}`).emit('kyc_update', {
        status: userKycStatus,
        decision,
        comments,
        timestamp: new Date()
      });

      return { success: true, message: `KYC application ${decision} successfully` };
    } catch (error) {
      console.error('[UserManagementService] Error reviewing KYC application:', error);
      throw error;
    }
  }

  // Compliance Methods
  async checkSuspiciousActivities() {
    try {
      // Check for suspicious transaction patterns
      const suspiciousTransactions = await this.db.sequelize.query(`
        SELECT 
          user_id,
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount
        FROM nft_transactions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY user_id
        HAVING COUNT(*) > 50 OR SUM(amount) > 100000
      `, {
        type: this.db.sequelize.QueryTypes.SELECT
      });

      for (const suspicious of suspiciousTransactions) {
        await this.createComplianceEvent(
          suspicious.user_id,
          'suspicious_activity',
          'warning',
          `High transaction volume detected: ${suspicious.transaction_count} transactions, $${suspicious.total_amount} total`
        );
      }

      // Check for rapid account creation from same IP
      const suspiciousIPs = await this.db.sequelize.query(`
        SELECT 
          registration_ip,
          COUNT(*) as account_count
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY registration_ip
        HAVING COUNT(*) > 5
      `, {
        type: this.db.sequelize.QueryTypes.SELECT
      });

      for (const suspiciousIP of suspiciousIPs) {
        await this.createComplianceEvent(
          null,
          'suspicious_registration',
          'warning',
          `Multiple accounts created from IP ${suspiciousIP.registration_ip}: ${suspiciousIP.account_count} accounts`
        );
      }

    } catch (error) {
      console.error('[UserManagementService] Error checking suspicious activities:', error);
    }
  }

  async performSanctionsCheck() {
    try {
      // This would integrate with actual sanctions databases
      // For now, we'll simulate with a basic check
      const usersToCheck = await this.db.users.findAll({
        where: {
          sanctions_checked: false,
          kyc_status: 'verified'
        },
        limit: 100
      });

      for (const user of usersToCheck) {
        // Simulate sanctions check
        const isOnSanctionsList = Math.random() < 0.001; // 0.1% chance for demo

        if (isOnSanctionsList) {
          await this.createComplianceEvent(
            user.id,
            'sanctions_match',
            'critical',
            `Potential sanctions list match detected for user ${user.username}`
          );

          // Flag user for manual review
          await this.flagUser(user.id, 'sanctions_check', 'Potential sanctions list match', null);
        }

        // Mark as checked
        await user.update({ sanctions_checked: true });
      }
    } catch (error) {
      console.error('[UserManagementService] Error performing sanctions check:', error);
    }
  }

  async generateAMLAlerts() {
    try {
      // Check for potential money laundering patterns
      const amlPatterns = await this.db.sequelize.query(`
        SELECT 
          to_user_id AS user_id,
          COUNT(DISTINCT blockchain) as chain_count,
          COUNT(*) as transaction_count,
          AVG(amount) as avg_amount
        FROM nft_transactions 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY to_user_id
        HAVING COUNT(DISTINCT blockchain) > 5 AND AVG(amount) > 10000
      `, {
        type: this.db.sequelize.QueryTypes.SELECT
      });

      for (const pattern of amlPatterns) {
        await this.createComplianceEvent(
          pattern.user_id,
          'aml_alert',
          'warning',
          `Potential AML pattern: ${pattern.chain_count} chains, ${pattern.transaction_count} transactions, $${pattern.avg_amount} avg amount`
        );
      }
    } catch (error) {
      console.error('[UserManagementService] Error generating AML alerts:', error);
    }
  }

  async createComplianceEvent(userId, eventType, severity, description) {
    try {
      await this.db.sequelize.query(`
        INSERT INTO compliance_events (user_id, event_type, severity, description, status, created_at)
        VALUES (:userId, :eventType, :severity, :description, 'open', NOW())
      `, {
        replacements: { userId, eventType, severity, description }
      });

      // Emit real-time alert to admin dashboard
      this.io.to('admin_dashboard').emit('compliance_alert', {
        userId,
        eventType,
        severity,
        description,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[UserManagementService] Error creating compliance event:', error);
    }
  }

  async getComplianceEvents(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        severity = '',
        eventType = '',
        status = '',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = filters;

      const offset = (page - 1) * limit;
      let whereClause = '';
      const replacements = { limit, offset };

      const conditions = [];
      if (severity) {
        conditions.push('ce.severity = :severity');
        replacements.severity = severity;
      }
      if (eventType) {
        conditions.push('ce.event_type = :eventType');
        replacements.eventType = eventType;
      }
      if (status) {
        conditions.push('ce.status = :status');
        replacements.status = status;
      }

      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }

      const events = await this.db.sequelize.query(`
        SELECT 
          ce.*,
          u.username,
          u.email
        FROM compliance_events ce
        LEFT JOIN users u ON ce.user_id = u.id
        ${whereClause}
        ORDER BY ce.${sortBy} ${sortOrder.toUpperCase()}
        LIMIT :limit OFFSET :offset
      `, {
        replacements,
        type: this.db.sequelize.QueryTypes.SELECT
      });

      const totalCount = await this.db.sequelize.query(`
        SELECT COUNT(*) as count
        FROM compliance_events ce
        ${whereClause}
      `, {
        replacements: Object.fromEntries(
          Object.entries(replacements).filter(([key]) => !['limit', 'offset'].includes(key))
        ),
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return {
        events,
        pagination: {
          total: totalCount[0].count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      };
    } catch (error) {
      console.error('[UserManagementService] Error fetching compliance events:', error);
      throw error;
    }
  }

  // Role Management Methods
  async assignRole(userId, role, assignedBy) {
    try {
      const user = await this.db.users.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldRole = user.role;
      await user.update({ role });

      // Log the action
      await this.logAdminAction(assignedBy, 'role_assignment', {
        userId,
        oldRole,
        newRole: role
      });

      return { success: true, message: 'Role assigned successfully' };
    } catch (error) {
      console.error('[UserManagementService] Error assigning role:', error);
      throw error;
    }
  }

  async logAdminAction(adminId, action, details) {
    try {
      await this.db.audit_logs.create({
        user_id: adminId,
        action,
        details: JSON.stringify(details),
        ip_address: '127.0.0.1', // This would come from the request
        user_agent: 'Admin Panel',
        created_at: new Date()
      });
    } catch (error) {
      console.error('[UserManagementService] Error logging admin action:', error);
    }
  }

  // Statistics Methods
  async getUserStatistics() {
    try {
      const stats = await this.db.sequelize.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
          COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_users,
          COUNT(CASE WHEN status = 'banned' THEN 1 END) as banned_users,
          COUNT(CASE WHEN kyc_status = 'verified' THEN 1 END) as verified_users,
          COUNT(CASE WHEN kyc_status = 'pending' THEN 1 END) as pending_kyc,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_24h,
          COUNT(CASE WHEN last_login >= NOW() - INTERVAL '24 hours' THEN 1 END) as active_24h
        FROM users
      `, {
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return stats[0];
    } catch (error) {
      console.error('[UserManagementService] Error fetching user statistics:', error);
      throw error;
    }
  }

  async getComplianceStatistics() {
    try {
      const stats = await this.db.sequelize.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_events,
          COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_events,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_events,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as events_24h
        FROM compliance_events
      `, {
        type: this.db.sequelize.QueryTypes.SELECT
      });

      return stats[0];
    } catch (error) {
      console.error('[UserManagementService] Error fetching compliance statistics:', error);
      throw error;
    }
  }
}

module.exports = UserManagementService;

