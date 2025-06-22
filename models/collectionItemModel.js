/**
 * Collection Item Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const CollectionItem = sequelize.define(
    "CollectionItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      collection_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'collections',
          key: 'id'
        }
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'items',
          key: 'id'
        }
      },
    },
    {
      tableName: "collection_items",
      timestamps: true,
      indexes: [
        {
          fields: ['collection_id']
        },
        {
          fields: ['item_id']
        },
        {
          fields: ['collection_id', 'item_id'],
          unique: true
        }
      ]
    }
  );

  return CollectionItem;
};
