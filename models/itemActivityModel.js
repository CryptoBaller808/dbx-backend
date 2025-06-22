/**
 * Item Activity Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const ItemActivity = sequelize.define(
    "ItemActivity",
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
      activity_type: {
        type: DataTypes.ENUM('minted', 'listed', 'sold', 'transferred', 'bid', 'offer'),
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      from_address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      to_address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      seller: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      buyer: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "item_activities",
      timestamps: true,
      indexes: [
        {
          fields: ['item_id']
        },
        {
          fields: ['seller']
        },
        {
          fields: ['buyer']
        },
        {
          fields: ['activity_type']
        }
      ]
    }
  );

  return ItemActivity;
};
