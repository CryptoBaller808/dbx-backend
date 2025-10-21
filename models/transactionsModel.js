/**
 * Transaction Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define(
    "Transaction",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      chainId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      txHash: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      fromAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      toAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      value: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'failed'),
        defaultValue: 'pending',
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
    },
    {
      tableName: "transactions",
      timestamps: true,
      indexes: [
        {
          fields: ['chainId']
        },
        {
          fields: ['txHash']
        },
        {
          fields: ['fromAddress']
        },
        {
          fields: ['user_id']
        }
      ]
    }
  );

  return Transaction;
};
