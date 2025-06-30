'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if currency_list table exists before trying to modify it
    const tableExists = await queryInterface.showAllTables().then(tables => 
      tables.includes('currency_list')
    );

    if (tableExists) {
      // Check if columns exist before adding them
      const tableDescription = await queryInterface.describeTable('currency_list');
      
      if (!tableDescription.hr_24_withdraw_limit) {
        await queryInterface.addColumn('currency_list', 'hr_24_withdraw_limit', {
          type: Sequelize.DECIMAL,
          allowNull: true,
        });
      }

      if (!tableDescription.properties) {
        await queryInterface.addColumn('currency_list', 'properties', {
          type: Sequelize.JSON,
          allowNull: true,
        });
      }

      if (!tableDescription.is_swap) {
        await queryInterface.addColumn('currency_list', 'is_swap', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
        });
      }

      if (!tableDescription.is_exchange) {
        await queryInterface.addColumn('currency_list', 'is_exchange', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
        });
      }

      if (!tableDescription.createdAt) {
        await queryInterface.addColumn('currency_list', 'createdAt', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        });
      }
    } else {
      console.log('currency_list table does not exist yet, skipping assets_update migration');
    }
  },

  async down(queryInterface, Sequelize) {
    const tableExists = await queryInterface.showAllTables().then(tables => 
      tables.includes('currency_list')
    );

    if (tableExists) {
      const tableDescription = await queryInterface.describeTable('currency_list');
      
      if (tableDescription.hr_24_withdraw_limit) {
        await queryInterface.removeColumn('currency_list', 'hr_24_withdraw_limit');
      }
      if (tableDescription.properties) {
        await queryInterface.removeColumn('currency_list', 'properties');
      }
      if (tableDescription.is_swap) {
        await queryInterface.removeColumn('currency_list', 'is_swap');
      }
      if (tableDescription.is_exchange) {
        await queryInterface.removeColumn('currency_list', 'is_exchange');
      }
      if (tableDescription.createdAt) {
        await queryInterface.removeColumn('currency_list', 'createdAt');
      }
    }
  }
};
