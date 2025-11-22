/**
 * Blockchain Model
 * Standardized Sequelize implementation with explicit field mappings
 * 
 * This model uses underscored: true and explicit field mappings to ensure
 * proper conversion between camelCase (JavaScript) and snake_case (PostgreSQL).
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
        field: 'chain_id',  // Maps to snake_case column
      },
      nodeUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'node_url',  // Maps to snake_case column
      },
      explorerUrl: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'explorer_url',  // Maps to snake_case column
      },
      nativeCurrency: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'native_currency',  // Maps to snake_case column
      },
      decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      adapterType: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'adapter_type',  // Maps to snake_case column
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',  // Maps to snake_case column
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
