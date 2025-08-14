/**
 * Idempotent seeding migration for roles and admin user
 * Uses environment variables for admin credentials
 * Safe to run multiple times - uses upsert operations with snake_case
 * No explicit IDs, natural-key based operations only
 */

const bcrypt = require('bcrypt');

module.exports = {
  up: async ({ context: queryInterface, Sequelize }) => {
    console.log('[SEED] Starting idempotent roles and admin seeding...');
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1) Ensure roles exist using natural-key upserts (Owen's exact pattern)
      console.log('[SEED] Ensuring roles exist with natural-key upserts...');
      
      await queryInterface.sequelize.query(
        `
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('Admin', 'Administrator', NOW(), NOW())
        ON CONFLICT (name) DO UPDATE SET updated_at = EXCLUDED.updated_at;
        `,
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        `
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('User', 'Standard user', NOW(), NOW())
        ON CONFLICT (name) DO UPDATE SET updated_at = EXCLUDED.updated_at;
        `,
        { transaction }
      );
      
      console.log('✅ [SEED] Roles upserted (Admin, User)');

      // 2) Get Admin role ID by natural key (no assumptions about ID values)
      const [adminRoleRows] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'Admin';`,
        { transaction }
      );
      
      if (!adminRoleRows || adminRoleRows.length === 0) {
        throw new Error('Admin role not found after upsert');
      }
      
      const adminRoleId = adminRoleRows[0].id;
      console.log(`✅ [SEED] Admin role ID resolved: ${adminRoleId}`);

      // 3) Admin user upsert with transaction safety
      const email = (process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com').toLowerCase().trim();
      const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!123';
      
      console.log(`[SEED] Upserting admin user: ${email}`);
      
      // Hash password with bcrypt (12 rounds for security)
      const passwordHash = await bcrypt.hash(password, 12);

      // Check if admin exists first
      const [existingAdminRows] = await queryInterface.sequelize.query(
        `SELECT id FROM "Admins" WHERE email = :email;`,
        {
          replacements: { email },
          transaction
        }
      );

      if (existingAdminRows && existingAdminRows.length > 0) {
        // UPDATE existing admin
        console.log('[SEED] Admin exists, updating password and role_id...');
        await queryInterface.sequelize.query(
          `
          UPDATE "Admins" 
          SET password_hash = :hash, 
              role_id = :roleId, 
              updated_at = NOW()
          WHERE email = :email;
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
        console.log('✅ [SEED] Admin user updated');
      } else {
        // INSERT new admin (no explicit id)
        console.log('[SEED] Admin does not exist, inserting new admin...');
        await queryInterface.sequelize.query(
          `
          INSERT INTO "Admins" (email, username, password_hash, role_id, created_at, updated_at)
          VALUES (:email, :email, :hash, :roleId, NOW(), NOW());
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
        console.log('✅ [SEED] Admin user inserted');
      }

      await transaction.commit();
      console.log(`✅ [SEED] Admin user upserted successfully: ${email}`);
      console.log('[SEED] Idempotent roles and admin seeding completed successfully');
      
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

