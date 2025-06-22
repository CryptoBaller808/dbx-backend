'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('blockchain_list', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      visible: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      asset_name: {
        type: Sequelize.STRING(255)
      },
      asset_code: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      symbol: {
        type: Sequelize.STRING(5)
      },
      type: {
        type: Sequelize.STRING(50)
      },
      subunit: {
        type: Sequelize.INTEGER
      },
      precision: {
        type: Sequelize.INTEGER
      },
      blockchain_key: {
        type: Sequelize.STRING(255)
      },
      icon_url: {
        type: Sequelize.STRING(500)
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('blockchain_list');
  }
};
