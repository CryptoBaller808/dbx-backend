/**
 * CurrencyList Model
 * Standardized Sequelize implementation for currency_list table
 * Updated with proper timestamps and snake_case mapping
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
        field: 'asset_code'
      },
      asset_issuer: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'asset_issuer'
      },
      asset_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'asset_name'
      },
      is_live_net: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_live_net'
      },
      ledger: {
        type: DataTypes.STRING(100),
        defaultValue: "xrp",
        field: 'ledger'
      },
      visible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'visible'
      },
      symbol: {
        type: DataTypes.STRING(5),
        allowNull: true,
        field: 'symbol'
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'type'
      },
      subunit: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'subunit'
      },
      precision: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'precision'
      },
      blockchain_key: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'blockchain_key'
      },
      icon_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'icon_url'
      },
      deposit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'deposit'
      },
      deposit_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'deposit_fee'
      },
      min_deposit_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'min_deposit_amount'
      },
      min_collection_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'min_collection_amount'
      },
      withdraw: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'withdraw'
      },
      withdraw_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'withdraw_fee'
      },
      min_withdraw_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'min_withdraw_amount'
      },
      withdraw_limit_24hr: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'withdraw_limit_24hr'
      },
      erc20_contract_address: {
        type: DataTypes.STRING(42),
        allowNull: true,
        field: 'erc20_contract_address'
      },
      gas_limit: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'gas_limit'
      },
      gas_price: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'gas_price'
      },
      properties: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'properties'
      },
      is_swap: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_swap'
      },
      is_exchange: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_exchange'
      },
    },
    {
      tableName: "currency_list",
      schema: "public",
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true, // Ensures snake_case for all fields
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
        },
        {
          fields: ['symbol']
        },
        {
          fields: ['type']
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

