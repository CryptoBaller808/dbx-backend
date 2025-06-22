const MFAService = require('../../services/mfa/MFAService');
const { expect } = require('chai');
const crypto = require('crypto');

describe('MFAService', () => {
  let mfaService;

  beforeEach(() => {
    mfaService = new MFAService();
  });

  describe('generateSecret', () => {
    it('should generate a valid TOTP secret', () => {
      const userEmail = 'test@example.com';
      const secret = mfaService.generateSecret(userEmail);

      expect(secret).to.have.property('base32');
      expect(secret).to.have.property('otpauth_url');
      expect(secret).to.have.property('ascii');
      expect(secret.base32).to.be.a('string');
      expect(secret.base32).to.have.length.greaterThan(0);
      expect(secret.otpauth_url).to.include('DBX');
      expect(secret.otpauth_url).to.include(userEmail);
    });

    it('should generate different secrets for each call', () => {
      const secret1 = mfaService.generateSecret('test1@example.com');
      const secret2 = mfaService.generateSecret('test2@example.com');

      expect(secret1.base32).to.not.equal(secret2.base32);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid TOTP token', () => {
      const secret = mfaService.generateSecret('test@example.com');
      const currentToken = mfaService.generateCurrentToken(secret.base32);

      const isValid = mfaService.verifyToken(secret.base32, currentToken);
      expect(isValid).to.be.true;
    });

    it('should reject an invalid TOTP token', () => {
      const secret = mfaService.generateSecret('test@example.com');
      const invalidToken = '123456';

      const isValid = mfaService.verifyToken(secret.base32, invalidToken);
      expect(isValid).to.be.false;
    });

    it('should handle malformed tokens gracefully', () => {
      const secret = mfaService.generateSecret('test@example.com');

      expect(mfaService.verifyToken(secret.base32, '')).to.be.false;
      expect(mfaService.verifyToken(secret.base32, 'abc')).to.be.false;
      expect(mfaService.verifyToken(secret.base32, null)).to.be.false;
    });
  });

  describe('generateRecoveryCodes', () => {
    it('should generate the default number of recovery codes', () => {
      const codes = mfaService.generateRecoveryCodes();
      expect(codes).to.be.an('array');
      expect(codes).to.have.length(10);
    });

    it('should generate the specified number of recovery codes', () => {
      const codes = mfaService.generateRecoveryCodes(5);
      expect(codes).to.have.length(5);
    });

    it('should generate unique recovery codes', () => {
      const codes = mfaService.generateRecoveryCodes(10);
      const uniqueCodes = [...new Set(codes)];
      expect(uniqueCodes).to.have.length(codes.length);
    });

    it('should generate codes with correct format', () => {
      const codes = mfaService.generateRecoveryCodes(5);
      codes.forEach(code => {
        expect(code).to.be.a('string');
        expect(code).to.have.length(8);
        expect(code).to.match(/^[A-F0-9]{8}$/);
      });
    });
  });

  describe('hashRecoveryCodes', () => {
    it('should hash recovery codes', async () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashedCodes = await mfaService.hashRecoveryCodes(codes);

      expect(hashedCodes).to.be.an('array');
      expect(hashedCodes).to.have.length(2);
      hashedCodes.forEach(hash => {
        expect(hash).to.be.a('string');
        expect(hash).to.not.equal('ABCD1234');
        expect(hash).to.not.equal('EFGH5678');
      });
    });
  });

  describe('verifyRecoveryCode', () => {
    it('should verify a valid recovery code', async () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashedCodes = await mfaService.hashRecoveryCodes(codes);

      const index = await mfaService.verifyRecoveryCode('ABCD1234', hashedCodes);
      expect(index).to.equal(0);
    });

    it('should reject an invalid recovery code', async () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashedCodes = await mfaService.hashRecoveryCodes(codes);

      const index = await mfaService.verifyRecoveryCode('INVALID1', hashedCodes);
      expect(index).to.equal(-1);
    });

    it('should be case insensitive', async () => {
      const codes = ['ABCD1234'];
      const hashedCodes = await mfaService.hashRecoveryCodes(codes);

      const index = await mfaService.verifyRecoveryCode('abcd1234', hashedCodes);
      expect(index).to.equal(0);
    });
  });

  describe('encryptSecret and decryptSecret', () => {
    it('should encrypt and decrypt a secret correctly', () => {
      const originalSecret = 'JBSWY3DPEHPK3PXP';
      const encrypted = mfaService.encryptSecret(originalSecret);
      const decrypted = mfaService.decryptSecret(encrypted);

      expect(encrypted).to.not.equal(originalSecret);
      expect(decrypted).to.equal(originalSecret);
    });

    it('should produce different encrypted values for the same secret', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted1 = mfaService.encryptSecret(secret);
      const encrypted2 = mfaService.encryptSecret(secret);

      expect(encrypted1).to.not.equal(encrypted2);
      expect(mfaService.decryptSecret(encrypted1)).to.equal(secret);
      expect(mfaService.decryptSecret(encrypted2)).to.equal(secret);
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => {
        mfaService.decryptSecret('invalid-encrypted-data');
      }).to.throw();
    });
  });

  describe('validateSetupData', () => {
    it('should validate correct setup data', () => {
      const setupData = {
        secret: 'JBSWY3DPEHPK3PXP',
        token: '123456',
        userEmail: 'test@example.com'
      };

      const result = mfaService.validateSetupData(setupData);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should reject invalid email', () => {
      const setupData = {
        secret: 'JBSWY3DPEHPK3PXP',
        token: '123456',
        userEmail: 'invalid-email'
      };

      const result = mfaService.validateSetupData(setupData);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Valid email address required');
    });

    it('should reject invalid token format', () => {
      const setupData = {
        secret: 'JBSWY3DPEHPK3PXP',
        token: '12345',
        userEmail: 'test@example.com'
      };

      const result = mfaService.validateSetupData(setupData);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Token must be 6 digits');
    });

    it('should reject missing secret', () => {
      const setupData = {
        token: '123456',
        userEmail: 'test@example.com'
      };

      const result = mfaService.validateSetupData(setupData);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.include('Invalid secret provided');
    });
  });

  describe('verifyTokenWithTiming', () => {
    it('should provide timing information for valid tokens', () => {
      const secret = mfaService.generateSecret('test@example.com');
      const currentToken = mfaService.generateCurrentToken(secret.base32);

      const result = mfaService.verifyTokenWithTiming(secret.base32, currentToken);
      expect(result.valid).to.be.true;
      expect(result.timeOffset).to.be.a('number');
      expect(result.message).to.be.a('string');
    });

    it('should provide timing information for invalid tokens', () => {
      const secret = mfaService.generateSecret('test@example.com');

      const result = mfaService.verifyTokenWithTiming(secret.base32, '000000');
      expect(result.valid).to.be.false;
      expect(result.timeOffset).to.be.null;
      expect(result.message).to.include('invalid');
    });
  });

  describe('generateQRCode', () => {
    it('should generate a QR code data URL', async () => {
      const secret = mfaService.generateSecret('test@example.com');
      const qrCodeDataURL = await mfaService.generateQRCode(secret.otpauth_url);

      expect(qrCodeDataURL).to.be.a('string');
      expect(qrCodeDataURL).to.include('data:image/png;base64,');
    });

    it('should handle invalid otpauth URLs', async () => {
      try {
        await mfaService.generateQRCode('invalid-url');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to generate QR code');
      }
    });
  });
});

