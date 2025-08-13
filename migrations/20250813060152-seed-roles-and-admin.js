/**
 * Idempotent seeding migration for roles and admin user
 * Uses environment variables for admin credentials
 * Safe to run multiple times - uses upsert operations
 */

const bcrypt = require('bcrypt');
const { QueryTypes } = require('sequelize');

module.exports = {
  up: async ({ context: queryInterface, Sequelize }) => {
    console.log('[SEED] Starting roles and admin seeding...');
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1) Ensure base roles exist using upsert
      console.log('[SEED] Ensuring base roles exist...');
      await queryInterface.sequelize.query(
        `
        INSERT INTO roles (name, created_at, updated_at)
        VALUES ('Admin', NOW(), NOW()), ('User', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
        `,
        { transaction }
      );
      console.log('✅ [SEED] Base roles ensured (Admin, User)');

      // 2) Get Admin role ID
      const [roleRows] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'Admin' LIMIT 1;`,
        { type: QueryTypes.SELECT, transaction, raw: true }
      );
      
      // Handle different possible response formats
      const adminRoleId = roleRows?.id || roleRows?.ID || roleRows;
      
      if (!adminRoleId) {
        throw new Error('Could not find or create Admin role');
      }
      
      console.log(`✅ [SEED] Admin role ID: ${adminRoleId}`);

      // 3) Seed admin user from environment variables
      const email = (process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com').toLowerCase().trim();
      const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!123';
      
      console.log(`[SEED] Creating admin user: ${email}`);
      
      // Hash password with bcrypt (12 rounds for security)
      const passwordHash = await bcrypt.hash(password, 12);

      // Upsert admin user (assumes Admins table structure)
      await queryInterface.sequelize.query(
        `
        INSERT INTO "Admins" (email, username, password_hash, role_id, created_at, updated_at)
        VALUES (:email, :email, :hash, :roleId, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          role_id = EXCLUDED.role_id,
          updated_at = NOW();
        `,
        {
          replacements: { 
            email, 
            hash: passwordHash, 
            roleId: adminRoleId 
          },
          transaction
        }
      );

      await transaction.commit();
      console.log(`✅ [SEED] Admin user upserted successfully: ${email}`);
      console.log('[SEED] Roles and admin seeding completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [SEED] Failed seeding roles/admin:', error);
      throw error;
    }
  },

  down: async ({ context: queryInterface }) => {
    console.log('[SEED] Rolling back admin user seeding...');
    
    try {
      // Non-destructive: remove only the seeded admin user
      const email = (process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com').toLowerCase().trim();
      
      await queryInterface.sequelize.query(
        `DELETE FROM "Admins" WHERE email = :email;`,
        {
          replacements: { email }
        }
      );
      
      console.log(`✅ [SEED] Removed seeded admin user: ${email}`);
      console.log('ℹ️ [SEED] Note: Base roles (Admin, User) were not removed for safety');
      
    } catch (error) {
      console.log('ℹ️ [SEED] Could not remove seeded admin user:', error.message);
    }
    
    console.log('[SEED] Rollback completed');
  }
};

