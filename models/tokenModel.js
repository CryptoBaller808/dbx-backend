/**
 * Token Model
 * Standardized Sequelize implementation for token listings
 */
module.exports = (sequelize, DataTypes) => {
  const Token = sequelize.define(
    "Token",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 100]
        }
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 20]
        }
      },
      network: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          isIn: [['ETH', 'BTC', 'BNB', 'AVAX', 'MATIC', 'SOL', 'XDC', 'XRP', 'XLM']]
        }
      },
      contractAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'contract_address'
      },
      iconUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'icon_url',
        validate: {
          isUrl: true
        }
      },
      decimals: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 18,
        validate: {
          min: 0,
          max: 30
        }
      },
      totalSupply: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'total_supply'
      },
      marketCap: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
        field: 'market_cap'
      },
      price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true
      },
      volume24h: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
        field: 'volume_24h'
      },
      change24h: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        field: 'change_24h'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
      },
      isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_verified'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      website: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      whitepaper: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      socialLinks: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'social_links'
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true
      },
      addedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'added_by',
        references: {
          model: 'admins',
          key: 'id'
        }
      }
    },
    {
      tableName: "tokens",
      timestamps: true,
      indexes: [
        {
          fields: ['symbol']
        },
        {
          fields: ['network']
        },
        {
          fields: ['is_active']
        },
        {
          unique: true,
          fields: ['symbol', 'network']
        }
      ]
    }
  );

  // Associations
  Token.associate = function(models) {
    // Token belongs to Admin (who added it)
    if (models.Admin) {
      Token.belongsTo(models.Admin, {
        foreignKey: 'addedBy',
        as: 'admin'
      });
    }
  };

  return Token;
};

