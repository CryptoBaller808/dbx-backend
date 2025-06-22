const express = require('express');
const rateLimit = require('express-rate-limit');
const MFAService = require('../services/mfa/MFAService');
const { user_mfa, users } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const mfaService = new MFAService();

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
 * POST /mfa/setup
 * Initialize MFA setup for a user
 * Generates secret and QR code for TOTP setup
 */
router.post('/setup', authenticateToken, mfaLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Check if user already has MFA enabled
    const existingMFA = await user_mfa.findByUserId(userId);
    if (existingMFA && existingMFA.isEnabled) {
      return res.status(400).json({
        error: 'MFA is already enabled for this account',
        code: 'MFA_ALREADY_ENABLED'
      });
    }

    // Generate new secret
    const secret = mfaService.generateSecret(userEmail);
    const qrCodeDataURL = await mfaService.generateQRCode(secret.otpauth_url);

    // Store temporary secret (not yet enabled)
    const encryptedSecret = mfaService.encryptSecret(secret.base32);
    
    if (existingMFA) {
      // Update existing record
      existingMFA.secretEncrypted = encryptedSecret;
      existingMFA.isEnabled = false; // Not enabled until verification
      await existingMFA.save();
    } else {
      // Create new record
      await user_mfa.create({
        userId,
        secretEncrypted: encryptedSecret,
        isEnabled: false
      });
    }

    res.json({
      success: true,
      data: {
        qrCode: qrCodeDataURL,
        secret: secret.base32, // For manual entry
        backupCodes: null // Will be generated after verification
      },
      message: 'MFA setup initiated. Please verify with your authenticator app.'
    });

  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      error: 'Failed to setup MFA',
      code: 'MFA_SETUP_ERROR'
    });
  }
});

/**
 * POST /mfa/verify-setup
 * Verify MFA setup and enable MFA for the user
 * Generates backup recovery codes
 */
router.post('/verify-setup', authenticateToken, verifyLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    // Validate input
    if (!token || !/^\d{6}$/.test(token)) {
      return res.status(400).json({
        error: 'Invalid token format. Token must be 6 digits.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Get user's MFA record
    const userMFA = await user_mfa.findByUserId(userId);
    if (!userMFA || !userMFA.secretEncrypted) {
      return res.status(400).json({
        error: 'MFA setup not initiated. Please start setup first.',
        code: 'MFA_SETUP_NOT_INITIATED'
      });
    }

    if (userMFA.isEnabled) {
      return res.status(400).json({
        error: 'MFA is already enabled for this account',
        code: 'MFA_ALREADY_ENABLED'
      });
    }

    // Decrypt secret and verify token
    const secret = mfaService.decryptSecret(userMFA.secretEncrypted);
    const isValidToken = mfaService.verifyToken(secret, token);

    if (!isValidToken) {
      await userMFA.incrementFailedAttempts();
      return res.status(400).json({
        error: 'Invalid verification token',
        code: 'INVALID_TOKEN'
      });
    }

    // Generate backup recovery codes
    const recoveryCodes = mfaService.generateRecoveryCodes(10);
    const hashedCodes = await mfaService.hashRecoveryCodes(recoveryCodes);

    // Enable MFA and save backup codes
    userMFA.isEnabled = true;
    userMFA.setupCompletedAt = new Date();
    userMFA.setBackupCodes(hashedCodes);
    userMFA.failedAttempts = 0;
    userMFA.lockedUntil = null;
    await userMFA.save();

    res.json({
      success: true,
      data: {
        backupCodes: recoveryCodes,
        message: 'MFA has been successfully enabled for your account'
      },
      message: 'Please save these backup codes in a secure location. They can be used to access your account if you lose your authenticator device.'
    });

  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      error: 'Failed to verify MFA setup',
      code: 'MFA_VERIFICATION_ERROR'
    });
  }
});

/**
 * POST /mfa/verify
 * Verify MFA token for authentication
 */
router.post('/verify', authenticateToken, verifyLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, isRecoveryCode = false } = req.body;

    // Validate input
    if (!token) {
      return res.status(400).json({
        error: 'Token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Get user's MFA record
    const userMFA = await user_mfa.findByUserId(userId);
    if (!userMFA || !userMFA.isEnabled) {
      return res.status(400).json({
        error: 'MFA is not enabled for this account',
        code: 'MFA_NOT_ENABLED'
      });
    }

    // Check if account is locked
    if (userMFA.isLocked()) {
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed attempts',
        code: 'ACCOUNT_LOCKED',
        lockedUntil: userMFA.lockedUntil
      });
    }

    let isValid = false;

    if (isRecoveryCode) {
      // Verify recovery code
      const backupCodes = userMFA.getBackupCodes();
      const codeIndex = await mfaService.verifyRecoveryCode(token.toUpperCase(), backupCodes);
      
      if (codeIndex !== -1) {
        await userMFA.useRecoveryCode(codeIndex);
        isValid = true;
      }
    } else {
      // Verify TOTP token
      if (!/^\d{6}$/.test(token)) {
        return res.status(400).json({
          error: 'Invalid token format. Token must be 6 digits.',
          code: 'INVALID_TOKEN_FORMAT'
        });
      }

      const secret = mfaService.decryptSecret(userMFA.secretEncrypted);
      isValid = mfaService.verifyToken(secret, token);
    }

    if (!isValid) {
      await userMFA.incrementFailedAttempts();
      return res.status(400).json({
        error: isRecoveryCode ? 'Invalid recovery code' : 'Invalid verification token',
        code: 'INVALID_TOKEN',
        remainingAttempts: Math.max(0, 5 - userMFA.failedAttempts)
      });
    }

    // Reset failed attempts on successful verification
    await userMFA.resetFailedAttempts();

    res.json({
      success: true,
      data: {
        verified: true,
        remainingRecoveryCodes: userMFA.getRemainingRecoveryCodes()
      },
      message: 'MFA verification successful'
    });

  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      error: 'Failed to verify MFA token',
      code: 'MFA_VERIFICATION_ERROR'
    });
  }
});

/**
 * POST /mfa/disable
 * Disable MFA for a user (requires current MFA verification)
 */
router.post('/disable', authenticateToken, verifyLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, isRecoveryCode = false } = req.body;

    // Get user's MFA record
    const userMFA = await user_mfa.findByUserId(userId);
    if (!userMFA || !userMFA.isEnabled) {
      return res.status(400).json({
        error: 'MFA is not enabled for this account',
        code: 'MFA_NOT_ENABLED'
      });
    }

    // Verify current MFA token before disabling
    let isValid = false;

    if (isRecoveryCode) {
      const backupCodes = userMFA.getBackupCodes();
      const codeIndex = await mfaService.verifyRecoveryCode(token.toUpperCase(), backupCodes);
      isValid = codeIndex !== -1;
    } else {
      if (!/^\d{6}$/.test(token)) {
        return res.status(400).json({
          error: 'Invalid token format. Token must be 6 digits.',
          code: 'INVALID_TOKEN_FORMAT'
        });
      }

      const secret = mfaService.decryptSecret(userMFA.secretEncrypted);
      isValid = mfaService.verifyToken(secret, token);
    }

    if (!isValid) {
      await userMFA.incrementFailedAttempts();
      return res.status(400).json({
        error: 'Invalid verification token. MFA verification required to disable.',
        code: 'INVALID_TOKEN'
      });
    }

    // Disable MFA
    await user_mfa.disableForUser(userId);

    res.json({
      success: true,
      message: 'MFA has been successfully disabled for your account'
    });

  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({
      error: 'Failed to disable MFA',
      code: 'MFA_DISABLE_ERROR'
    });
  }
});

/**
 * GET /mfa/status
 * Get MFA status for the current user
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userMFA = await user_mfa.findByUserId(userId);
    
    if (!userMFA) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          setupCompleted: false,
          remainingRecoveryCodes: 0,
          isLocked: false
        }
      });
    }

    res.json({
      success: true,
      data: {
        enabled: userMFA.isEnabled,
        setupCompleted: !!userMFA.setupCompletedAt,
        remainingRecoveryCodes: userMFA.getRemainingRecoveryCodes(),
        isLocked: userMFA.isLocked(),
        lockedUntil: userMFA.lockedUntil,
        lastUsedAt: userMFA.lastUsedAt
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
 * Regenerate backup recovery codes (requires MFA verification)
 */
router.post('/regenerate-backup-codes', authenticateToken, verifyLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, isRecoveryCode = false } = req.body;

    // Get user's MFA record
    const userMFA = await user_mfa.findByUserId(userId);
    if (!userMFA || !userMFA.isEnabled) {
      return res.status(400).json({
        error: 'MFA is not enabled for this account',
        code: 'MFA_NOT_ENABLED'
      });
    }

    // Verify current MFA token
    let isValid = false;

    if (isRecoveryCode) {
      const backupCodes = userMFA.getBackupCodes();
      const codeIndex = await mfaService.verifyRecoveryCode(token.toUpperCase(), backupCodes);
      isValid = codeIndex !== -1;
    } else {
      if (!/^\d{6}$/.test(token)) {
        return res.status(400).json({
          error: 'Invalid token format. Token must be 6 digits.',
          code: 'INVALID_TOKEN_FORMAT'
        });
      }

      const secret = mfaService.decryptSecret(userMFA.secretEncrypted);
      isValid = mfaService.verifyToken(secret, token);
    }

    if (!isValid) {
      await userMFA.incrementFailedAttempts();
      return res.status(400).json({
        error: 'Invalid verification token',
        code: 'INVALID_TOKEN'
      });
    }

    // Generate new backup codes
    const newRecoveryCodes = mfaService.generateRecoveryCodes(10);
    const hashedCodes = await mfaService.hashRecoveryCodes(newRecoveryCodes);

    // Update backup codes
    userMFA.setBackupCodes(hashedCodes);
    userMFA.recoveryCodesUsed = 0;
    await userMFA.save();

    res.json({
      success: true,
      data: {
        backupCodes: newRecoveryCodes
      },
      message: 'New backup codes have been generated. Please save them in a secure location.'
    });

  } catch (error) {
    console.error('MFA backup codes regeneration error:', error);
    res.status(500).json({
      error: 'Failed to regenerate backup codes',
      code: 'MFA_BACKUP_CODES_ERROR'
    });
  }
});

module.exports = router;

