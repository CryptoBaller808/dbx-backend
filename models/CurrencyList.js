/**
 * CurrencyList Model
 * Standardized Sequelize implementation for currency_list table
 */
module.exports = (sequelize, DataTypes) => {
  const CurrencyList = sequelize.define(
    "CurrencyList",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      asset_code: {
        type: DataTypes.STRING(15),
        allowNull: false,
      },
      asset_issuer: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      asset_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      is_live_net: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      ledger: {
        type: DataTypes.STRING(100),
        defaultValue: "xrp",
      },
      visible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      symbol: {
        type: DataTypes.STRING(5),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      subunit: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      precision: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      blockchain_key: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      icon_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      deposit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      deposit_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      min_deposit_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      min_collection_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      withdraw: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      withdraw_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      min_withdraw_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      withdraw_limit_24hr: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      erc20_contract_address: {
        type: DataTypes.STRING(42),
        allowNull: true,
      },
      gas_limit: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      gas_price: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      properties: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_swap: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_exchange: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "currency_list",
      schema: "public",
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false, // The migration only has created_at, not updated_at
      indexes: [
        {
          fields: ['asset_code']
        },
        {
          fields: ['ledger']
        },
        {
          fields: ['visible']
        },
        {
          fields: ['deposit']
        },
        {
          fields: ['withdraw']
        },
        {
          fields: ['is_swap']
        },
        {
          fields: ['is_exchange']
        }
      ]
    }
  );

  // Define associations if needed
  CurrencyList.associate = function(models) {
    // Add associations here when other models are available
    // Example: CurrencyList.hasMany(models.Transaction, { foreignKey: 'currency_id' });
  };

  return CurrencyList;
};

