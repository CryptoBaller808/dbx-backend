const express = require('express');
const rateLimit = require('express-rate-limit');
// Temporarily comment out MFA functionality to fix crash
// const MFAService = require('../services/mfa/MFAService');
// const { UserMFA, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
// const mfaService = new MFAService();

// Rate limiting for MFA endpoints
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many MFA attempts, please try again later.',
    code: 'MFA_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for verification attempts
const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 verification attempts per 5 minutes
  message: {
    error: 'Too many verification attempts, please try again later.',
    code: 'MFA_VERIFY_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * TEMPORARY: MFA endpoints disabled to fix backend crash
 * These will be re-enabled once the UserMFA model methods are properly implemented
 */

/**
 * POST /mfa/setup
 * Initialize MFA setup for a user
 * TEMPORARILY DISABLED
 */
router.post('/setup', authenticateToken, mfaLimiter, async (req, res) => {
  res.status(501).json({
    error: 'MFA functionality temporarily disabled during Phase 2 integration',
    code: 'MFA_TEMPORARILY_DISABLED',
    message: 'MFA features will be restored in the next update'
  });
});

/**
 * POST /mfa/verify-setup
 * Verify MFA setup and enable MFA for the user
 * TEMPORARILY DISABLED
 */
router.post('/verify-setup', authenticateToken, verifyLimiter, async (req, res) => {
  res.status(501).json({
    error: 'MFA functionality temporarily disabled during Phase 2 integration',
    code: 'MFA_TEMPORARILY_DISABLED',
    message: 'MFA features will be restored in the next update'
  });
});

/**
 * POST /mfa/verify
 * Verify MFA token for authentication
 * TEMPORARILY DISABLED
 */
router.post('/verify', authenticateToken, verifyLimiter, async (req, res) => {
  res.status(501).json({
    error: 'MFA functionality temporarily disabled during Phase 2 integration',
    code: 'MFA_TEMPORARILY_DISABLED',
    message: 'MFA features will be restored in the next update'
  });
});

/**
 * POST /mfa/disable
 * Disable MFA for a user
 * TEMPORARILY DISABLED
 */
router.post('/disable', authenticateToken, verifyLimiter, async (req, res) => {
  res.status(501).json({
    error: 'MFA functionality temporarily disabled during Phase 2 integration',
    code: 'MFA_TEMPORARILY_DISABLED',
    message: 'MFA features will be restored in the next update'
  });
});

/**
 * GET /mfa/status
 * Get MFA status for the current user
 * TEMPORARILY DISABLED - Returns default disabled status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    // Return default MFA disabled status during Phase 2
    res.json({
      success: true,
      data: {
        enabled: false,
        setupCompleted: false,
        remainingRecoveryCodes: 0,
        isLocked: false,
        message: 'MFA temporarily disabled during Phase 2 integration'
      }
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({
      error: 'Failed to get MFA status',
      code: 'MFA_STATUS_ERROR'
    });
  }
});

/**
 * POST /mfa/regenerate-backup-codes
 * Regenerate backup recovery codes
 * TEMPORARILY DISABLED
 */
router.post('/regenerate-backup-codes', authenticateToken, verifyLimiter, async (req, res) => {
  res.status(501).json({
    error: 'MFA functionality temporarily disabled during Phase 2 integration',
    code: 'MFA_TEMPORARILY_DISABLED',
    message: 'MFA features will be restored in the next update'
  });
});

console.log('⚠️  [MFA Routes] MFA functionality temporarily disabled to fix backend crash');
console.log('🔧 [MFA Routes] MFA will be restored after Phase 2 integration is complete');

module.exports = router;

