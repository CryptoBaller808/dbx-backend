/**
 * UserBalance Model
 * Tracks user token balances for internal ledger system
 */

module.exports = (sequelize, DataTypes) => {
  const UserBalance = sequelize.define('UserBalance', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'user_id'
    },
    token: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('amount');
        return value ? parseFloat(value) : 0;
      }
    }
  }, {
    tableName: 'user_balances',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'token'],
        name: 'user_balances_user_id_token_unique'
      },
      {
        fields: ['user_id'],
        name: 'user_balances_user_id_idx'
      }
    ]
  });

  return UserBalance;
};

