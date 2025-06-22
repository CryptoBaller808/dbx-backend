/**
 * CalCol Model (Calendar Collection)
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const CalCol = sequelize.define(
    "CalCol",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      collection_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'collections',
          key: 'id'
        }
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "cal_col",
      timestamps: true,
      indexes: [
        {
          fields: ['collection_id']
        },
        {
          fields: ['start_date']
        },
        {
          fields: ['end_date']
        }
      ]
    }
  );

  return CalCol;
};
