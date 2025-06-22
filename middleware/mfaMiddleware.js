const { user_mfa } = require('../models');
const MFAService = require('../services/mfa/MFAService');

const mfaService = new MFAService();

/**
 * Middleware to check if MFA is required for the current user
 * Adds mfaRequired flag to request object
 */
const checkMFARequired = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next();
    }

    const userMFA = await user_mfa.findByUserId(req.user.id);
    req.mfaRequired = userMFA && userMFA.isEnabled;
    req.userMFA = userMFA;
    
    next();
  } catch (error) {
    console.error('MFA check error:', error);
    next();
  }
};

/**
 * Middleware to enforce MFA verification for sensitive operations
 * Requires MFA token in request headers or body
 */
const requireMFAVerification = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userMFA = await user_mfa.findByUserId(req.user.id);
    
    // If MFA is not enabled, allow the request
    if (!userMFA || !userMFA.isEnabled) {
      return next();
    }

    // Check if account is locked
    if (userMFA.isLocked()) {
      return res.status(423).json({
        error: 'Account temporarily locked due to failed MFA attempts',
        code: 'MFA_ACCOUNT_LOCKED',
        lockedUntil: userMFA.lockedUntil
      });
    }

    // Get MFA token from headers or body
    const mfaToken = req.headers['x-mfa-token'] || req.body.mfaToken;
    const isRecoveryCode = req.headers['x-mfa-recovery'] === 'true' || req.body.isRecoveryCode;

    if (!mfaToken) {
      return res.status(403).json({
        error: 'MFA verification required for this operation',
        code: 'MFA_REQUIRED',
        mfaEnabled: true
      });
    }

    // Verify the token
    let isValid = false;

    if (isRecoveryCode) {
      // Verify recovery code
      const backupCodes = userMFA.getBackupCodes();
      const codeIndex = await mfaService.verifyRecoveryCode(mfaToken.toUpperCase(), backupCodes);
      
      if (codeIndex !== -1) {
        // Mark recovery code as used
        await userMFA.useRecoveryCode(codeIndex);
        isValid = true;
      }
    } else {
      // Verify TOTP token
      if (!/^\d{6}$/.test(mfaToken)) {
        return res.status(400).json({
          error: 'Invalid MFA token format. Token must be 6 digits.',
          code: 'INVALID_MFA_TOKEN_FORMAT'
        });
      }

      const secret = mfaService.decryptSecret(userMFA.secretEncrypted);
      isValid = mfaService.verifyToken(secret, mfaToken);
    }

    if (!isValid) {
      await userMFA.incrementFailedAttempts();
      return res.status(403).json({
        error: 'Invalid MFA token',
        code: 'INVALID_MFA_TOKEN',
        remainingAttempts: Math.max(0, 5 - userMFA.failedAttempts)
      });
    }

    // Reset failed attempts on successful verification
    await userMFA.resetFailedAttempts();
    
    // Add MFA verification info to request
    req.mfaVerified = true;
    req.mfaMethod = isRecoveryCode ? 'recovery_code' : 'totp';
    
    next();

  } catch (error) {
    console.error('MFA verification middleware error:', error);
    res.status(500).json({
      error: 'MFA verification failed',
      code: 'MFA_VERIFICATION_ERROR'
    });
  }
};

/**
 * Middleware for login MFA verification
 * Used during the login process to verify MFA after password verification
 */
const verifyLoginMFA = async (req, res, next) => {
  try {
    const { email, password, mfaToken, isRecoveryCode = false } = req.body;

    // This middleware assumes password has already been verified
    // and user object is available in req.user
    if (!req.user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const userMFA = await user_mfa.findByUserId(req.user.id);
    
    // If MFA is not enabled, proceed with login
    if (!userMFA || !userMFA.isEnabled) {
      return next();
    }

    // MFA is enabled, token is required
    if (!mfaToken) {
      return res.status(200).json({
        success: false,
        mfaRequired: true,
        message: 'MFA verification required',
        code: 'MFA_REQUIRED'
      });
    }

    // Check if account is locked
    if (userMFA.isLocked()) {
      return res.status(423).json({
        error: 'Account temporarily locked due to failed MFA attempts',
        code: 'MFA_ACCOUNT_LOCKED',
        lockedUntil: userMFA.lockedUntil
      });
    }

    // Verify the MFA token
    let isValid = false;

    if (isRecoveryCode) {
      const backupCodes = userMFA.getBackupCodes();
      const codeIndex = await mfaService.verifyRecoveryCode(mfaToken.toUpperCase(), backupCodes);
      
      if (codeIndex !== -1) {
        await userMFA.useRecoveryCode(codeIndex);
        isValid = true;
      }
    } else {
      if (!/^\d{6}$/.test(mfaToken)) {
        return res.status(400).json({
          error: 'Invalid MFA token format. Token must be 6 digits.',
          code: 'INVALID_MFA_TOKEN_FORMAT'
        });
      }

      const secret = mfaService.decryptSecret(userMFA.secretEncrypted);
      isValid = mfaService.verifyToken(secret, mfaToken);
    }

    if (!isValid) {
      await userMFA.incrementFailedAttempts();
      return res.status(403).json({
        error: 'Invalid MFA token',
        code: 'INVALID_MFA_TOKEN',
        mfaRequired: true,
        remainingAttempts: Math.max(0, 5 - userMFA.failedAttempts)
      });
    }

    // Reset failed attempts and update last used
    await userMFA.resetFailedAttempts();
    
    // Add MFA verification info to request
    req.mfaVerified = true;
    req.mfaMethod = isRecoveryCode ? 'recovery_code' : 'totp';
    
    next();

  } catch (error) {
    console.error('Login MFA verification error:', error);
    res.status(500).json({
      error: 'MFA verification failed',
      code: 'MFA_VERIFICATION_ERROR'
    });
  }
};

/**
 * Middleware to add MFA status to user profile responses
 */
const addMFAStatus = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next();
    }

    const userMFA = await user_mfa.findByUserId(req.user.id);
    
    req.user.mfaStatus = {
      enabled: userMFA ? userMFA.isEnabled : false,
      setupCompleted: userMFA ? !!userMFA.setupCompletedAt : false,
      remainingRecoveryCodes: userMFA ? userMFA.getRemainingRecoveryCodes() : 0,
      lastUsedAt: userMFA ? userMFA.lastUsedAt : null
    };
    
    next();
  } catch (error) {
    console.error('Add MFA status error:', error);
    next();
  }
};

/**
 * Rate limiting configuration for MFA-related endpoints
 */
const createMFARateLimit = (windowMs, max, message) => {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      code: 'MFA_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use combination of IP and user ID for authenticated requests
      return req.user ? `${req.ip}-${req.user.id}` : req.ip;
    }
  });
};

// Pre-configured rate limiters
const mfaSetupLimiter = createMFARateLimit(
  15 * 60 * 1000, // 15 minutes
  3, // 3 setup attempts per 15 minutes
  'Too many MFA setup attempts'
);

const mfaVerifyLimiter = createMFARateLimit(
  5 * 60 * 1000, // 5 minutes
  10, // 10 verification attempts per 5 minutes
  'Too many MFA verification attempts'
);

const mfaDisableLimiter = createMFARateLimit(
  60 * 60 * 1000, // 1 hour
  2, // 2 disable attempts per hour
  'Too many MFA disable attempts'
);

module.exports = {
  checkMFARequired,
  requireMFAVerification,
  verifyLoginMFA,
  addMFAStatus,
  createMFARateLimit,
  mfaSetupLimiter,
  mfaVerifyLimiter,
  mfaDisableLimiter
};

