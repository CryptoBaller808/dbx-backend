/**
 * Seed roles and admin user with comprehensive dynamic schema adaptation
 * Handles any Admins table schema including required columns like name (NOT NULL, no default)
 */

const { ensureRolesAndAdmin } = require('../lib/seeding');

module.exports = {
  async up({ context: queryInterface, Sequelize }) {
    console.log('[MIGRATION] Starting seed-roles-and-admin with comprehensive dynamic schema adaptation...');
    
    const sequelize = queryInterface.sequelize;
    let transaction;
    
    try {
      // Start transaction
      transaction = await sequelize.transaction();
      
      // Get admin credentials from environment
      const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
      const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!123';
      
      console.log('[MIGRATION] Using admin email:', adminEmail);
      console.log('[MIGRATION] Admin password length:', adminPassword.length);
      
      // Use comprehensive seeding function with dynamic schema adaptation
      const result = await ensureRolesAndAdmin({
        sequelize,
        email: adminEmail,
        plainPassword: adminPassword,
        roleName: 'Admin',
        transaction
      });
      
      // Commit transaction
      await transaction.commit();
      
      console.log('[MIGRATION] ✅ Seed-roles-and-admin completed successfully');
      console.log('[MIGRATION] Schema info:', JSON.stringify(result.schemaInfo, null, 2));
      console.log('[MIGRATION] Admin user:', { id: result.admin.id, email: result.admin.email });
      
      return result;
      
    } catch (error) {
      // Rollback transaction on error
      if (transaction) {
        console.log('[MIGRATION] Rolling back transaction due to error...');
        await transaction.rollback();
      }
      
      console.error('[MIGRATION] ❌ Seed-roles-and-admin failed:', error.message);
      console.error('[MIGRATION] Error stack:', error.stack);
      
      // Re-throw error to fail the migration
      throw new Error(`Migration failed: ${error.message}`);
    }
  },

  async down({ context: queryInterface, Sequelize }) {
    console.log('[MIGRATION] Rolling back seed-roles-and-admin...');
    
    const sequelize = queryInterface.sequelize;
    let transaction;
    
    try {
      // Start transaction
      transaction = await sequelize.transaction();
      
      // Get admin email from environment
      const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
      
      console.log('[MIGRATION] Removing admin user:', adminEmail);
      
      // Remove admin user
      await sequelize.query(`
        DELETE FROM "Admins" WHERE email = :adminEmail;
      `, {
        replacements: { adminEmail },
        transaction
      });
      
      console.log('[MIGRATION] Removing roles...');
      
      // Remove roles (in reverse order due to potential foreign key constraints)
      await sequelize.query(`
        DELETE FROM roles WHERE name IN ('Admin', 'User');
      `, { transaction });
      
      // Commit transaction
      await transaction.commit();
      
      console.log('[MIGRATION] ✅ Seed-roles-and-admin rollback completed');
      
    } catch (error) {
      // Rollback transaction on error
      if (transaction) {
        console.log('[MIGRATION] Rolling back transaction due to rollback error...');
        await transaction.rollback();
      }
      
      console.error('[MIGRATION] ❌ Seed-roles-and-admin rollback failed:', error.message);
      console.error('[MIGRATION] Rollback error stack:', error.stack);
      
      // Re-throw error to fail the rollback
      throw new Error(`Migration rollback failed: ${error.message}`);
    }
  }
};

