'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add updated_at column to currency_list table
     * This enables full timestamp support (created_at + updated_at)
     */
    await queryInterface.addColumn('currency_list', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Remove updated_at column from currency_list table
     */
    await queryInterface.removeColumn('currency_list', 'updated_at');
  }
};

