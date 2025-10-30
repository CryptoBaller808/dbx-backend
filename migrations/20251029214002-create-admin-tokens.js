'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      symbol: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      decimals: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 18
      },
      chain: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      contract: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      default_quote: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'USDT'
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      sort: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100
      },
      price_provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'binance'
      },
      tv_symbol: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      logo_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('admin_tokens', ['symbol']);
    await queryInterface.addIndex('admin_tokens', ['active']);
    await queryInterface.addIndex('admin_tokens', ['sort']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('admin_tokens');
  }
};

