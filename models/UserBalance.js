const { DataTypes } = require('sequelize');
const sequelize = require('../util/sequelize');

const UserBalance = sequelize.define('UserBalance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'user_id',
    comment: 'User identifier (wallet address or email)'
  },
  token: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Token symbol (e.g., BTC, ETH, USDT)'
  },
  amount: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false,
    defaultValue: '0.000000000000000000',
    comment: 'Token balance with 18 decimal precision',
    get() {
      const value = this.getDataValue('amount');
      return value ? parseFloat(value) : 0;
    }
  }
}, {
  tableName: 'user_balances',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'token'],
      name: 'user_balances_user_token_unique'
    },
    {
      fields: ['user_id'],
      name: 'user_balances_user_id_idx'
    }
  ]
});

module.exports = UserBalance;

