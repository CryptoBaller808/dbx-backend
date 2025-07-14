'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 [Role FK Fix] Starting role_id foreign key fix...');
    
    try {
      // Check if users table exists
      const usersTableExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });
      
      if (!usersTableExists[0].exists) {
        console.log('⚠️ [Role FK Fix] Users table does not exist yet, skipping migration');
        return;
      }

      // Check if role_id column exists
      const roleIdExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'role_id'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });
      
      if (!roleIdExists[0].exists) {
        console.log('📦 [Role FK Fix] Adding role_id column...');
        await queryInterface.addColumn('users', 'role_id', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 2
        });
      } else {
        console.log('🔧 [Role FK Fix] Updating role_id column...');
        // Separate the default value setting from foreign key
        await queryInterface.changeColumn('users', 'role_id', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 2
        });
      }

      // Check if foreign key constraint already exists
      const constraintExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.table_constraints 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND constraint_name = 'fk_role_id'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });
      
      if (!constraintExists[0].exists) {
        console.log('🔗 [Role FK Fix] Adding foreign key constraint...');
        // Add foreign key constraint separately
        await queryInterface.addConstraint('users', {
          fields: ['role_id'],
          type: 'foreign key',
          name: 'fk_role_id',
          references: {
            table: 'roles',
            field: 'id'
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE'
        });
      } else {
        console.log('✅ [Role FK Fix] Foreign key constraint already exists');
      }
      
      console.log('🎉 [Role FK Fix] Migration completed successfully');
      
    } catch (error) {
      console.error('❌ [Role FK Fix] Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [Role FK Fix] Rolling back role_id foreign key fix...');
    
    try {
      // Remove foreign key constraint
      const constraintExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.table_constraints 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND constraint_name = 'fk_role_id'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });
      
      if (constraintExists[0].exists) {
        await queryInterface.removeConstraint('users', 'fk_role_id');
        console.log('✅ [Role FK Fix] Foreign key constraint removed');
      }
      
      console.log('✅ [Role FK Fix] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Role FK Fix] Rollback failed:', error);
      throw error;
    }
  }
};

