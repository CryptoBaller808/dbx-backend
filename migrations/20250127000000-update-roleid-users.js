'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 [Role ID Update] Starting role_id column update...');
    
    try {
      // 1. Ensure role_id is INTEGER with proper default
      console.log('🔧 [Role ID Update] Updating role_id column...');
      await queryInterface.changeColumn('users', 'role_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
      });

      // 2. Add foreign key constraint
      console.log('🔗 [Role ID Update] Adding foreign key constraint...');
      await queryInterface.addConstraint('users', {
        fields: ['role_id'],
        type: 'foreign key',
        name: 'fk_users_role_id',
        references: {
          table: 'roles',
          field: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      });
      
      console.log('✅ [Role ID Update] Migration completed successfully');
      
    } catch (error) {
      console.error('❌ [Role ID Update] Migration failed:', error);
      // If constraint already exists, that's okay
      if (error.message && error.message.includes('already exists')) {
        console.log('ℹ️ [Role ID Update] Constraint already exists, continuing...');
      } else {
        throw error;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('↩️ [Role ID Update] Rolling back role_id updates...');
    
    try {
      // Remove foreign key constraint
      await queryInterface.removeConstraint('users', 'fk_users_role_id');
      console.log('✅ [Role ID Update] Foreign key constraint removed');

      // Reset column to nullable without default
      await queryInterface.changeColumn('users', 'role_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
      console.log('✅ [Role ID Update] Column reset to nullable');
      
      console.log('✅ [Role ID Update] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Role ID Update] Rollback failed:', error);
      throw error;
    }
  },
};

