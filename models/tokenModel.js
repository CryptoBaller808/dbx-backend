module.exports = (sequelize, DataTypes) => {
  const Token = sequelize.define(
    "Token",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [1, 100] },
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [1, 20] },
      },
      network: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          isIn: [['ETH', 'BTC', 'BNB', 'AVAX', 'MATIC', 'SOL', 'XDC', 'XRP', 'XLM']],
        },
      },
      contractAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'contract_address',
      },
      iconUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'icon_url',
      },
      decimals: {
        type: DataTypes.INTEGER,
        defaultValue: 18,
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "tokens",
      timestamps: true,
      indexes: [{ fields: ['symbol', 'network'] }],
    }
  );

  return Token;
};

