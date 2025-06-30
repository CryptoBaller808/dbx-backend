'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add updated_at column to currency_list table
     * This enables full timestamp support (created_at + updated_at)
     */
    const tableDescription = await queryInterface.describeTable('currency_list');
    
    if (!tableDescription.updated_at) {
      await queryInterface.addColumn('currency_list', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      });
      console.log('✅ Added updated_at column to currency_list table');
    } else {
      console.log('✅ updated_at column already exists in currency_list table');
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove updated_at column from currency_list table
     */
    await queryInterface.removeColumn('currency_list', 'updated_at');
  }
};

