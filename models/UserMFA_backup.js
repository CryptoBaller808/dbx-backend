const { DataTypes } = require('sequelize');

/**
 * User MFA Backup Model
 * Stores MFA configuration and recovery codes for users
 */
module.exports = (sequelize) => {
  const UserMFA = sequelize.define('UserMFABackup', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether MFA is enabled for this user'
    },
    secretEncrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Encrypted TOTP secret (base32)'
    },
    backupCodesEncrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON array of encrypted backup recovery codes'
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last time MFA was successfully used'
    },
    setupCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When MFA setup was completed'
    },
    failedAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of consecutive failed MFA attempts'
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Account locked until this time due to failed MFA attempts'
    },
    recoveryCodesUsed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of recovery codes that have been used'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_mfa_backup',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId']
      },
      {
        fields: ['isEnabled']
      },
      {
        fields: ['lockedUntil']
      }
    ],
    hooks: {
      beforeCreate: (userMFA, options) => {
        // Ensure backup codes are properly formatted
        if (userMFA.backupCodesEncrypted && typeof userMFA.backupCodesEncrypted === 'object') {
          userMFA.backupCodesEncrypted = JSON.stringify(userMFA.backupCodesEncrypted);
        }
      },
      beforeUpdate: (userMFA, options) => {
        // Ensure backup codes are properly formatted
        if (userMFA.backupCodesEncrypted && typeof userMFA.backupCodesEncrypted === 'object') {
          userMFA.backupCodesEncrypted = JSON.stringify(userMFA.backupCodesEncrypted);
        }
      }
    }
  });

  // Instance methods
  UserMFA.prototype.isLocked = function() {
    return this.lockedUntil && new Date() < this.lockedUntil;
  };

  UserMFA.prototype.incrementFailedAttempts = async function() {
    this.failedAttempts += 1;
    
    // Lock account after 5 failed attempts for 15 minutes
    if (this.failedAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    }
    
    await this.save();
  };

  UserMFA.prototype.resetFailedAttempts = async function() {
    this.failedAttempts = 0;
    this.lockedUntil = null;
    this.lastUsedAt = new Date();
    await this.save();
  };

  UserMFA.prototype.getBackupCodes = function() {
    if (!this.backupCodesEncrypted) {
      return [];
    }
    
    try {
      return JSON.parse(this.backupCodesEncrypted);
    } catch (error) {
      console.error('Error parsing backup codes:', error);
      return [];
    }
  };

  UserMFA.prototype.setBackupCodes = function(codes) {
    this.backupCodesEncrypted = JSON.stringify(codes);
  };

  UserMFA.prototype.useRecoveryCode = async function(codeIndex) {
    const codes = this.getBackupCodes();
    if (codes[codeIndex]) {
      codes[codeIndex] = null; // Mark as used
      this.setBackupCodes(codes);
      this.recoveryCodesUsed += 1;
      await this.save();
      return true;
    }
    return false;
  };

  UserMFA.prototype.getRemainingRecoveryCodes = function() {
    const codes = this.getBackupCodes();
    return codes.filter(code => code !== null).length;
  };

  // Class methods
  UserMFA.findByUserId = async function(userId) {
    return await this.findOne({ where: { userId } });
  };

  UserMFA.createForUser = async function(userId, secretEncrypted, backupCodes) {
    return await this.create({
      userId,
      secretEncrypted,
      backupCodesEncrypted: JSON.stringify(backupCodes),
      isEnabled: true,
      setupCompletedAt: new Date()
    });
  };

  UserMFA.disableForUser = async function(userId) {
    const userMFA = await this.findByUserId(userId);
    if (userMFA) {
      userMFA.isEnabled = false;
      userMFA.secretEncrypted = null;
      userMFA.backupCodesEncrypted = null;
      userMFA.failedAttempts = 0;
      userMFA.lockedUntil = null;
      await userMFA.save();
    }
    return userMFA;
  };

  // Associations will be defined in the main models/index.js file
  // FIXED: Changed alias from 'userMFA_backup' to 'backupUserMirror' to avoid conflicts
  UserMFA.associate = function(models) {
    UserMFA.belongsTo(models.users, {
      foreignKey: 'userId',
      as: 'backupUserMirror',  // FIXED: Changed from 'userMFA_backup' to unique alias
      onDelete: 'CASCADE'
    });
  };

  return UserMFA;
};

