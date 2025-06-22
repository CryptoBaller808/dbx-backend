/**
 * Wishlist Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const Wishlist = sequelize.define(
    "Wishlist",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
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
      tableName: "wishlists",
      timestamps: true,
      indexes: [
        {
          fields: ['user_id']
        },
        {
          fields: ['item_id']
        },
        {
          fields: ['user_id', 'item_id'],
          unique: true
        }
      ]
    }
  );

  return Wishlist;
};
