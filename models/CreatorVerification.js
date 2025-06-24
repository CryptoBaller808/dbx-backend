/**
 * Creator Verification Model
 * Handles creator and collection verification requests
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CreatorVerification = sequelize.define('creator_verifications', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    creator_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    verification_type: {
      type: DataTypes.ENUM('CREATOR', 'COLLECTION', 'ARTIST', 'BRAND'),
      allowNull: false,
      defaultValue: 'CREATOR'
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    documents: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON array of verification documents'
    },
    social_links: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON object of social media links'
    },
    portfolio_links: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON array of portfolio/work links'
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    additional_info: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    verification_badge: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'creator_verifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['creator_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['verification_type']
      },
      {
        fields: ['submitted_at']
      }
    ]
  });

  // Model associations will be defined in models/index.js
  // FIXED: Using completely unique aliases to avoid any conflicts
  CreatorVerification.associate = (models) => {
    CreatorVerification.belongsTo(models.users, {
      foreignKey: 'creator_id',
      as: 'verificationCreator'  // FIXED: Changed from 'creatorUser' to 'verificationCreator'
    });
    
    CreatorVerification.belongsTo(models.users, {
      foreignKey: 'reviewed_by',
      as: 'verificationReviewer'  // FIXED: Changed from 'reviewerUser' to 'verificationReviewer'
    });
  };

  return CreatorVerification;
};

