'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 [Role ID Constraint] Starting role_id constraint migration...');
    
    try {
      // Step 1: Alter the role_id column to set type, not null, and default
      console.log('🔧 [Role ID Constraint] Updating role_id column...');
      await queryInterface.changeColumn('users', 'role_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
      });

      // Step 2: Add foreign key constraint to roles(id)
      console.log('🔗 [Role ID Constraint] Adding foreign key constraint...');
      await queryInterface.addConstraint('users', {
        fields: ['role_id'],
        type: 'foreign key',
        name: 'fk_users_roles', // Optional: name your constraint
        references: {
          table: 'roles',
          field: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      });
      
      console.log('✅ [Role ID Constraint] Migration completed successfully');
      
    } catch (error) {
      console.error('❌ [Role ID Constraint] Migration failed:', error);
      // If constraint already exists, that's okay
      if (error.message && error.message.includes('already exists')) {
        console.log('ℹ️ [Role ID Constraint] Constraint already exists, continuing...');
      } else {
        throw error;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('↩️ [Role ID Constraint] Rolling back role_id constraint...');
    
    try {
      // Rollback Step 1: Remove foreign key constraint
      await queryInterface.removeConstraint('users', 'fk_users_roles');
      console.log('✅ [Role ID Constraint] Foreign key constraint removed');

      // Rollback Step 2: Revert role_id to nullable and remove default
      await queryInterface.changeColumn('users', 'role_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
      console.log('✅ [Role ID Constraint] Column reverted to nullable');
      
      console.log('✅ [Role ID Constraint] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Role ID Constraint] Rollback failed:', error);
      throw error;
    }
  },
};

