module.exports = (sequelize, DataTypes) => {
  const XLMLimitOrders = sequelize.define(
    "xlm_limit_orders",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      walletAddress: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      txnId: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      fee: {
        allowNull: false,
        type: DataTypes.DECIMAL(10, 8),
      },
      status: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
        default: new Date(),
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
        default: new Date(),
      },
    },
    {
      timestamps: false,
      freezeTableName: true,
      tableName: "xlm_limit_orders",
    }
  );

  return XLMLimitOrders;
};
