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
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      image: DataTypes.STRING,
      link: DataTypes.STRING,
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      config: DataTypes.JSON,
    },
    {
      tableName: "settings",
      timestamps: true,
      indexes: [{ fields: ['type'] }],
    }
  );

  return Settings;
};

