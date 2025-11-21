/**
 * Blockchain Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const Blockchain = sequelize.define(
    "Blockchain",
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
      },
      chainId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      nodeUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      explorerUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nativeCurrency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      adapterType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      config: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "blockchains",
      timestamps: true,
      underscored: true,  // Maps createdAt -> created_at, updatedAt -> updated_at
    }
  );

  return Blockchain;
};
