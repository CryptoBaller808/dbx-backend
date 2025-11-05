'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_balances', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'User identifier (wallet address or email)'
      },
      token: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Token symbol (e.g., BTC, ETH, USDT)'
      },
      amount: {
        type: Sequelize.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0.000000000000000000',
        comment: 'Token balance with 18 decimal precision'
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

    // Add unique constraint on user_id + token combination
    await queryInterface.addIndex('user_balances', ['user_id', 'token'], {
      unique: true,
      name: 'user_balances_user_token_unique'
    });

    // Add index on user_id for faster lookups
    await queryInterface.addIndex('user_balances', ['user_id'], {
      name: 'user_balances_user_id_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_balances');
  }
};

