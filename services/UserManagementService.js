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

  // ... [Unchanged code omitted for brevity] ...

  async checkSuspiciousActivities() {
    try {
      // Check for suspicious transaction patterns
      const suspiciousTransactions = await this.db.sequelize.query(`
        SELECT 
          to_user_id as user_id,
          COUNT(*) as transaction_count,
          SUM(price) as total_amount
        FROM nft_transactions 
        WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
        GROUP BY to_user_id
        HAVING COUNT(*) > 50 OR SUM(price) > 100000
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

      // 🚫 Disabled IP-based anti-fraud check for now
      /*
      const suspiciousIPs = await this.db.sequelize.query(`
        SELECT 
          registration_ip,
          COUNT(*) as account_count
        FROM users 
        WHERE "createdAt" >= NOW() - INTERVAL '1 hour'
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
      */

    } catch (error) {
      console.error('[UserManagementService] Error checking suspicious activities:', error);
    }
  }

  // ... [Unchanged code omitted for brevity] ...
}

module.exports = UserManagementService;
