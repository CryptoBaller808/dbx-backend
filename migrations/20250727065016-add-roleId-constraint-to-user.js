'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 [Role Constraint] Starting role_id constraint migration...');
    
    try {
      // 1. Update role_id column with proper default value
      console.log('🔧 [Role Constraint] Updating role_id column...');
      await queryInterface.changeColumn('users', 'role_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
      });

      // 2. Add foreign key constraint
      console.log('🔗 [Role Constraint] Adding foreign key constraint...');
      await queryInterface.addConstraint('users', {
        fields: ['role_id'],
        type: 'foreign key',
        name: 'fk_users_roles',
        references: {
          table: 'roles',
          field: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      });
      
      console.log('✅ [Role Constraint] Migration completed successfully');
      
    } catch (error) {
      console.error('❌ [Role Constraint] Migration failed:', error);
      // If constraint already exists, that's okay
      if (error.message && error.message.includes('already exists')) {
        console.log('ℹ️ [Role Constraint] Constraint already exists, continuing...');
      } else {
        throw error;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [Role Constraint] Rolling back role_id constraint...');
    
    try {
      // Remove foreign key constraint
      await queryInterface.removeConstraint('users', 'fk_users_roles');
      console.log('✅ [Role Constraint] Foreign key constraint removed');
      
      // Reset column to nullable without default
      await queryInterface.changeColumn('users', 'role_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
      console.log('✅ [Role Constraint] Column reset to nullable');
      
      console.log('✅ [Role Constraint] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Role Constraint] Rollback failed:', error);
      throw error;
    }
  }
};

