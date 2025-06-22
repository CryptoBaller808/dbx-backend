"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("currency_list", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      asset_code: {
        type: Sequelize.STRING(15),
        allowNull: false,
      },
      asset_issuer: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      asset_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      is_live_net: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      ledger: {
        type: Sequelize.STRING(100),
        defaultValue: "xrp",
      },
      visible: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      symbol: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      subunit: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      precision: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      blockchain_key: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      icon_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      deposit: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      deposit_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      min_deposit_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      min_collection_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      withdraw: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      withdraw_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      min_withdraw_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      withdraw_limit_24hr: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      erc20_contract_address: {
        type: Sequelize.STRING(42),
        allowNull: true,
      },
      gas_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      gas_price: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      properties: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      is_swap: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      is_exchange: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("currency_list");
  },
};
