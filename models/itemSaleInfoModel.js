/**
 * Item Sale Info Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const ItemSaleInfo = sequelize.define(
    "ItemSaleInfo",
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
      price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sale_type: {
        type: DataTypes.ENUM('fixed_price', 'auction', 'offer'),
        defaultValue: 'fixed_price',
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_sold: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      highest_bid: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      highest_bidder: {
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
      tableName: "item_sale_info",
      timestamps: true,
      indexes: [
        {
          fields: ['item_id']
        },
        {
          fields: ['highest_bidder']
        },
        {
          fields: ['sale_type']
        }
      ]
    }
  );

  return ItemSaleInfo;
};
