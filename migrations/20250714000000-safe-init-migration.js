'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Safe initialization migration
    // This migration ensures basic table structure without conflicts
    console.log('🚀 [Safe Init] Starting safe initialization migration...');
    
    try {
      // Check if roles table exists, create if not
      const rolesTableExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'roles'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT });
      
      if (!rolesTableExists[0].exists) {
        console.log('📦 [Safe Init] Creating roles table...');
        await queryInterface.createTable('roles', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          }
        });
        
        // Insert default roles
        await queryInterface.bulkInsert('roles', [
          { id: 1, name: 'admin', description: 'Administrator role', createdAt: new Date(), updatedAt: new Date() },
          { id: 2, name: 'user', description: 'Regular user role', createdAt: new Date(), updatedAt: new Date() }
        ]);
        
        console.log('✅ [Safe Init] Roles table created with default roles');
      } else {
        console.log('✅ [Safe Init] Roles table already exists');
      }
      
      console.log('🎉 [Safe Init] Migration completed successfully');
      
    } catch (error) {
      console.error('❌ [Safe Init] Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [Safe Init] Rolling back safe initialization...');
    
    try {
      // Only drop if exists
      await queryInterface.sequelize.query(`
        DROP TABLE IF EXISTS roles CASCADE;
      `);
      
      console.log('✅ [Safe Init] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Safe Init] Rollback failed:', error);
      throw error;
    }
  }
};

