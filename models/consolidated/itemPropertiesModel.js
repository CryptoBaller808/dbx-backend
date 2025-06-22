/**
 * Item Properties Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const ItemProperty = sequelize.define(
    "ItemProperty",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'items',
          key: 'id'
        }
      },
      trait_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      display_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "item_properties",
      timestamps: true,
      indexes: [
        {
          fields: ['item_id']
        },
        {
          fields: ['trait_type']
        }
      ]
    }
  );

  return ItemProperty;
};
