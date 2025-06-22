const { Op } = require('sequelize'); // ✅ Correct way to use Op

module.exports = (sequelize, DataTypes) => {
  const Collection = sequelize.define(
    "Collection",
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
      logo_image: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      banner_image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      featured_image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'categories',
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
      royalty: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      collection_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      collection_custom_url: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      blockchain: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payment_tokens: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "collections",
      timestamps: true,
      indexes: [
        {
          fields: ['category_id']
        },
        {
          fields: ['user_id']
        },
        {
          fields: ['collection_custom_url'],
          unique: true,
          where: {
            collection_custom_url: {
              [Op.ne]: null // ✅ Correct usage
            }
          }
        }
      ]
    }
  );

  return Collection;
};
