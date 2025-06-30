'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('currency_list', 'hr_24_withdraw_limit', {
      type: Sequelize.DECIMAL,
      allowNull: true,
    });

    await queryInterface.addColumn('currency_list', 'properties', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.addColumn('currency_list', 'is_swap', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    await queryInterface.addColumn('currency_list', 'is_exchange', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    await queryInterface.addColumn('currency_list', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('currency_list', 'hr_24_withdraw_limit');
    await queryInterface.removeColumn('currency_list', 'properties');
    await queryInterface.removeColumn('currency_list', 'is_swap');
    await queryInterface.removeColumn('currency_list', 'is_exchange');
    await queryInterface.removeColumn('currency_list', 'createdAt');
  }
};
