/**
 * Item Bids Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const ItemBid = sequelize.define(
    "ItemBid",
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
      bidder_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      bid_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'accepted', 'rejected', 'expired'),
        defaultValue: 'active',
      },
      expiration_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "item_bids",
      timestamps: true,
      indexes: [
        {
          fields: ['item_id']
        },
        {
          fields: ['bidder_id']
        },
        {
          fields: ['status']
        }
      ]
    }
  );

  return ItemBid;
};
