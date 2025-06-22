/**
 * Account Offers Model
 * Migrated from Mongoose to Sequelize
 */
module.exports = (sequelize, DataTypes) => {
  const AccountOffer = sequelize.define(
    "AccountOffer",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      account: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      txId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      pair: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      offerType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      side: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      date: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "account_offers",
      timestamps: true,
      indexes: [
        {
          fields: ['account']
        },
        {
          fields: ['txId']
        }
      ]
    }
  );

  return AccountOffer;
};
