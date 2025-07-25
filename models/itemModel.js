/**
 * Item Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const { Op } = require('sequelize');
  
  const Item = sequelize.define(
    "Item",
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
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      external_link: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      collection_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'collections',
          key: 'id'
        }
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      current_owner_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      token_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      token_standard: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      blockchain: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      // Timestamp fields with explicit field mapping
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
    },
    {
      tableName: "items",
      timestamps: true,
      indexes: [
        {
          fields: ['collection_id']
        },
        {
          fields: ['user_id']
        },
        {
          fields: ['current_owner_id']
        },
        {
          fields: ['token_id', 'blockchain'],
          unique: true,
          where: {
            token_id: {
              [Op.ne]: null
            },
            blockchain: {
              [Op.ne]: null
            }
          }
        }
      ]
    }
  );

  return Item;
};
