/**
 * AdminToken Model
 * For Dynamic Token Manager System (DBX-61)
 * Stores tokens that appear in Exchange/Swap dropdowns
 */
module.exports = (sequelize, DataTypes) => {
  const AdminToken = sequelize.define(
    "AdminToken",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      symbol: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          isUppercase: true,
          len: [1, 20]
        }
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 100]
        }
      },
      decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 18,
        validate: {
          min: 0,
          max: 30
        }
      },
      chain: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 50]
        }
      },
      contract: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Smart contract address (optional for native tokens)'
      },
      defaultQuote: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'USDT',
        field: 'default_quote',
        validate: {
          isIn: [['USD', 'USDT', 'USDC', 'BTC', 'ETH']]
        }
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether token appears in dropdowns'
      },
      sort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
        comment: 'Display order in dropdowns (lower = higher priority)'
      },
      priceProvider: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'binance',
        field: 'price_provider',
        validate: {
          isIn: [['binance', 'coingecko', 'coincap', 'kucoin']]
        }
      },
      tvSymbol: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'tv_symbol',
        comment: 'TradingView symbol (e.g., BTCUSDT). If null, TV chart is hidden.'
      },
      logoUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'logo_url',
        validate: {
          isUrl: true
        },
        comment: 'Cloudinary URL for token logo'
      }
    },
    {
      tableName: "admin_tokens",
      timestamps: true,
      indexes: [
        {
          fields: ['symbol']
        },
        {
          fields: ['active']
        },
        {
          fields: ['sort']
        }
      ]
    }
  );

  return AdminToken;
};

