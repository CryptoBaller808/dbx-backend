const request = require('supertest');
const express = require('express');
const { expect } = require('chai');
const sinon = require('sinon');
const mfaRoutes = require('../../routes/mfaRoutes');
const { user_mfa } = require('../../models');
const MFAService = require('../../services/mfa/MFAService');

describe('MFA Routes', () => {
  let app;
  let mfaServiceStub;
  let userMFAStub;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = { id: 1, email: 'test@example.com' };
      next();
    });
    
    app.use('/api/mfa', mfaRoutes);

    // Create stubs
    mfaServiceStub = sinon.createStubInstance(MFAService);
    userMFAStub = {
      findByUserId: sinon.stub(),
      create: sinon.stub(),
      disableForUser: sinon.stub()
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('POST /api/mfa/setup', () => {
    it('should initiate MFA setup successfully', async () => {
      // Mock user has no existing MFA
      userMFAStub.findByUserId.resolves(null);
      userMFAStub.create.resolves({ id: 1, userId: 1 });

      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/DBX%20(test@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=Digital%20Block%20Exchange'
      };

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'generateSecret').returns(mockSecret);
      sinon.stub(MFAService.prototype, 'generateQRCode').resolves('data:image/png;base64,mockqrcode');
      sinon.stub(MFAService.prototype, 'encryptSecret').returns('encrypted-secret');

      const response = await request(app)
        .post('/api/mfa/setup')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('qrCode');
      expect(response.body.data).to.have.property('secret');
    });

    it('should reject setup if MFA is already enabled', async () => {
      // Mock user already has MFA enabled
      userMFAStub.findByUserId.resolves({ isEnabled: true });

      const response = await request(app)
        .post('/api/mfa/setup')
        .expect(400);

      expect(response.body.error).to.include('already enabled');
      expect(response.body.code).to.equal('MFA_ALREADY_ENABLED');
    });
  });

  describe('POST /api/mfa/verify-setup', () => {
    it('should verify setup and enable MFA successfully', async () => {
      const mockUserMFA = {
        secretEncrypted: 'encrypted-secret',
        isEnabled: false,
        incrementFailedAttempts: sinon.stub(),
        setBackupCodes: sinon.stub(),
        save: sinon.stub().resolves()
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'decryptSecret').returns('JBSWY3DPEHPK3PXP');
      sinon.stub(MFAService.prototype, 'verifyToken').returns(true);
      sinon.stub(MFAService.prototype, 'generateRecoveryCodes').returns(['CODE1', 'CODE2']);
      sinon.stub(MFAService.prototype, 'hashRecoveryCodes').resolves(['hash1', 'hash2']);

      const response = await request(app)
        .post('/api/mfa/verify-setup')
        .send({ token: '123456' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('backupCodes');
      expect(mockUserMFA.save.calledOnce).to.be.true;
    });

    it('should reject invalid verification token', async () => {
      const mockUserMFA = {
        secretEncrypted: 'encrypted-secret',
        isEnabled: false,
        incrementFailedAttempts: sinon.stub().resolves()
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'decryptSecret').returns('JBSWY3DPEHPK3PXP');
      sinon.stub(MFAService.prototype, 'verifyToken').returns(false);

      const response = await request(app)
        .post('/api/mfa/verify-setup')
        .send({ token: '000000' })
        .expect(400);

      expect(response.body.error).to.include('Invalid verification token');
      expect(response.body.code).to.equal('INVALID_TOKEN');
      expect(mockUserMFA.incrementFailedAttempts.calledOnce).to.be.true;
    });

    it('should reject malformed token', async () => {
      const response = await request(app)
        .post('/api/mfa/verify-setup')
        .send({ token: '12345' })
        .expect(400);

      expect(response.body.error).to.include('Invalid token format');
      expect(response.body.code).to.equal('INVALID_TOKEN_FORMAT');
    });
  });

  describe('POST /api/mfa/verify', () => {
    it('should verify TOTP token successfully', async () => {
      const mockUserMFA = {
        isEnabled: true,
        secretEncrypted: 'encrypted-secret',
        isLocked: () => false,
        incrementFailedAttempts: sinon.stub(),
        resetFailedAttempts: sinon.stub().resolves(),
        getRemainingRecoveryCodes: () => 8
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'decryptSecret').returns('JBSWY3DPEHPK3PXP');
      sinon.stub(MFAService.prototype, 'verifyToken').returns(true);

      const response = await request(app)
        .post('/api/mfa/verify')
        .send({ token: '123456' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.verified).to.be.true;
      expect(mockUserMFA.resetFailedAttempts.calledOnce).to.be.true;
    });

    it('should verify recovery code successfully', async () => {
      const mockUserMFA = {
        isEnabled: true,
        isLocked: () => false,
        getBackupCodes: () => ['hash1', 'hash2'],
        useRecoveryCode: sinon.stub().resolves(),
        resetFailedAttempts: sinon.stub().resolves(),
        getRemainingRecoveryCodes: () => 7
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'verifyRecoveryCode').resolves(0);

      const response = await request(app)
        .post('/api/mfa/verify')
        .send({ token: 'RECOVERY1', isRecoveryCode: true })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.verified).to.be.true;
      expect(mockUserMFA.useRecoveryCode.calledWith(0)).to.be.true;
    });

    it('should reject verification when account is locked', async () => {
      const mockUserMFA = {
        isEnabled: true,
        isLocked: () => true,
        lockedUntil: new Date(Date.now() + 900000) // 15 minutes from now
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      const response = await request(app)
        .post('/api/mfa/verify')
        .send({ token: '123456' })
        .expect(423);

      expect(response.body.error).to.include('temporarily locked');
      expect(response.body.code).to.equal('ACCOUNT_LOCKED');
    });

    it('should reject verification when MFA is not enabled', async () => {
      userMFAStub.findByUserId.resolves(null);

      const response = await request(app)
        .post('/api/mfa/verify')
        .send({ token: '123456' })
        .expect(400);

      expect(response.body.error).to.include('not enabled');
      expect(response.body.code).to.equal('MFA_NOT_ENABLED');
    });
  });

  describe('POST /api/mfa/disable', () => {
    it('should disable MFA successfully with valid token', async () => {
      const mockUserMFA = {
        isEnabled: true,
        secretEncrypted: 'encrypted-secret',
        incrementFailedAttempts: sinon.stub()
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);
      userMFAStub.disableForUser.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'decryptSecret').returns('JBSWY3DPEHPK3PXP');
      sinon.stub(MFAService.prototype, 'verifyToken').returns(true);

      const response = await request(app)
        .post('/api/mfa/disable')
        .send({ token: '123456' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.include('successfully disabled');
    });

    it('should reject disable request with invalid token', async () => {
      const mockUserMFA = {
        isEnabled: true,
        secretEncrypted: 'encrypted-secret',
        incrementFailedAttempts: sinon.stub().resolves()
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'decryptSecret').returns('JBSWY3DPEHPK3PXP');
      sinon.stub(MFAService.prototype, 'verifyToken').returns(false);

      const response = await request(app)
        .post('/api/mfa/disable')
        .send({ token: '000000' })
        .expect(400);

      expect(response.body.error).to.include('Invalid verification token');
      expect(response.body.code).to.equal('INVALID_TOKEN');
      expect(mockUserMFA.incrementFailedAttempts.calledOnce).to.be.true;
    });
  });

  describe('GET /api/mfa/status', () => {
    it('should return MFA status for user with MFA enabled', async () => {
      const mockUserMFA = {
        isEnabled: true,
        setupCompletedAt: new Date(),
        getRemainingRecoveryCodes: () => 8,
        isLocked: () => false,
        lockedUntil: null,
        lastUsedAt: new Date()
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      const response = await request(app)
        .get('/api/mfa/status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.enabled).to.be.true;
      expect(response.body.data.setupCompleted).to.be.true;
      expect(response.body.data.remainingRecoveryCodes).to.equal(8);
      expect(response.body.data.isLocked).to.be.false;
    });

    it('should return default status for user without MFA', async () => {
      userMFAStub.findByUserId.resolves(null);

      const response = await request(app)
        .get('/api/mfa/status')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data.enabled).to.be.false;
      expect(response.body.data.setupCompleted).to.be.false;
      expect(response.body.data.remainingRecoveryCodes).to.equal(0);
      expect(response.body.data.isLocked).to.be.false;
    });
  });

  describe('POST /api/mfa/regenerate-backup-codes', () => {
    it('should regenerate backup codes successfully', async () => {
      const mockUserMFA = {
        isEnabled: true,
        secretEncrypted: 'encrypted-secret',
        incrementFailedAttempts: sinon.stub(),
        setBackupCodes: sinon.stub(),
        save: sinon.stub().resolves()
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'decryptSecret').returns('JBSWY3DPEHPK3PXP');
      sinon.stub(MFAService.prototype, 'verifyToken').returns(true);
      sinon.stub(MFAService.prototype, 'generateRecoveryCodes').returns(['NEW1', 'NEW2']);
      sinon.stub(MFAService.prototype, 'hashRecoveryCodes').resolves(['newhash1', 'newhash2']);

      const response = await request(app)
        .post('/api/mfa/regenerate-backup-codes')
        .send({ token: '123456' })
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.data).to.have.property('backupCodes');
      expect(response.body.data.backupCodes).to.deep.equal(['NEW1', 'NEW2']);
      expect(mockUserMFA.setBackupCodes.calledOnce).to.be.true;
      expect(mockUserMFA.save.calledOnce).to.be.true;
    });

    it('should reject regeneration with invalid token', async () => {
      const mockUserMFA = {
        isEnabled: true,
        secretEncrypted: 'encrypted-secret',
        incrementFailedAttempts: sinon.stub().resolves()
      };

      userMFAStub.findByUserId.resolves(mockUserMFA);

      // Mock MFA service methods
      sinon.stub(MFAService.prototype, 'decryptSecret').returns('JBSWY3DPEHPK3PXP');
      sinon.stub(MFAService.prototype, 'verifyToken').returns(false);

      const response = await request(app)
        .post('/api/mfa/regenerate-backup-codes')
        .send({ token: '000000' })
        .expect(400);

      expect(response.body.error).to.include('Invalid verification token');
      expect(response.body.code).to.equal('INVALID_TOKEN');
    });
  });
});

