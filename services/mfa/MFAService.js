const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * MFA Service for Digital Block Exchange
 * Handles TOTP generation, verification, and backup codes
 */
class MFAService {
  constructor() {
    this.encryptionKey = process.env.MFA_ENCRYPTION_KEY || 'default-key-change-in-production';
    this.algorithm = 'aes-256-gcm';
  }

  /**
   * Generate a new TOTP secret for a user
   * @param {string} userEmail - User's email address
   * @param {string} userName - User's display name
   * @returns {Object} Secret object with base32 secret and otpauth_url
   */
  generateSecret(userEmail, userName = '') {
    const secret = speakeasy.generateSecret({
      name: `DBX (${userEmail})`,
      issuer: 'Digital Block Exchange',
      length: 32
    });

    return {
      base32: secret.base32,
      otpauth_url: secret.otpauth_url,
      ascii: secret.ascii
    };
  }

  /**
   * Generate QR code data URL for mobile app scanning
   * @param {string} otpauthUrl - The otpauth URL from generateSecret
   * @returns {Promise<string>} Base64 data URL for QR code image
   */
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Verify a TOTP token against a secret
   * @param {string} secret - Base32 encoded secret
   * @param {string} token - 6-digit TOTP token from user
   * @param {number} window - Time window for verification (default: 2)
   * @returns {boolean} True if token is valid
   */
  verifyToken(secret, token, window = 2) {
    try {
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window,
        step: 30 // 30-second time step
      });
    } catch (error) {
      console.error('TOTP verification error:', error);
      return false;
    }
  }

  /**
   * Generate backup recovery codes
   * @param {number} count - Number of codes to generate (default: 10)
   * @returns {Array<string>} Array of recovery codes
   */
  generateRecoveryCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash recovery codes for secure storage
   * @param {Array<string>} codes - Array of recovery codes
   * @returns {Promise<Array<string>>} Array of hashed codes
   */
  async hashRecoveryCodes(codes) {
    const hashedCodes = [];
    for (const code of codes) {
      const hashedCode = await bcrypt.hash(code, 12);
      hashedCodes.push(hashedCode);
    }
    return hashedCodes;
  }

  /**
   * Verify a recovery code against stored hashed codes
   * @param {string} code - Recovery code to verify
   * @param {Array<string>} hashedCodes - Array of hashed recovery codes
   * @returns {Promise<number>} Index of matching code, or -1 if not found
   */
  async verifyRecoveryCode(code, hashedCodes) {
    for (let i = 0; i < hashedCodes.length; i++) {
      if (hashedCodes[i] && await bcrypt.compare(code, hashedCodes[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Encrypt MFA secret for database storage
   * @param {string} secret - Base32 secret to encrypt
   * @returns {string} Encrypted secret with IV prepended
   */
  encryptSecret(secret) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, authTag, and encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error(`Failed to encrypt secret: ${error.message}`);
    }
  }

  /**
   * Decrypt MFA secret from database
   * @param {string} encryptedSecret - Encrypted secret from database
   * @returns {string} Decrypted base32 secret
   */
  decryptSecret(encryptedSecret) {
    try {
      const parts = encryptedSecret.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted secret format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt secret: ${error.message}`);
    }
  }

  /**
   * Generate current TOTP token for testing purposes
   * @param {string} secret - Base32 secret
   * @returns {string} Current 6-digit TOTP token
   */
  generateCurrentToken(secret) {
    return speakeasy.totp({
      secret: secret,
      encoding: 'base32',
      step: 30
    });
  }

  /**
   * Validate MFA setup data
   * @param {Object} setupData - MFA setup data
   * @returns {Object} Validation result
   */
  validateSetupData(setupData) {
    const errors = [];

    if (!setupData.secret || typeof setupData.secret !== 'string') {
      errors.push('Invalid secret provided');
    }

    if (!setupData.token || !/^\d{6}$/.test(setupData.token)) {
      errors.push('Token must be 6 digits');
    }

    if (!setupData.userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setupData.userEmail)) {
      errors.push('Valid email address required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Check if MFA token is within acceptable time window
   * @param {string} secret - Base32 secret
   * @param {string} token - TOTP token to verify
   * @returns {Object} Verification result with timing info
   */
  verifyTokenWithTiming(secret, token) {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeStep = 30;
    const window = 2;

    for (let i = -window; i <= window; i++) {
      const testTime = currentTime + (i * timeStep);
      const testToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: testTime,
        step: timeStep
      });

      if (testToken === token) {
        return {
          valid: true,
          timeOffset: i,
          message: i === 0 ? 'Token is current' : `Token is ${Math.abs(i) * timeStep}s ${i < 0 ? 'behind' : 'ahead'}`
        };
      }
    }

    return {
      valid: false,
      timeOffset: null,
      message: 'Token is invalid or expired'
    };
  }
}

module.exports = MFAService;

