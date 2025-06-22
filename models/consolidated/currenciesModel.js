/**
 * Currency Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const Currency = sequelize.define(
    "Currency",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 18,
      },
      chainId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'blockchains',
          key: 'chainId'
        }
      },
      tokenAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isNative: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "currencies",
      timestamps: true,
      indexes: [
        {
          fields: ['symbol']
        },
        {
          fields: ['chainId']
        }
      ]
    }
  );

  return Currency;
};
