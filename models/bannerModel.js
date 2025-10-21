/**
 * Banner/Settings Model
 * Standardized Sequelize implementation
 */
module.exports = (sequelize, DataTypes) => {
  const Settings = sequelize.define(
    "Settings",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      link: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      config: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "settings",
      timestamps: true,
      indexes: [
        {
          fields: ['type']
        }
      ]
    }
  );

  return Settings;
};

