/**
 * Idempotent seeding migration for roles and admin user
 * Fixed SQL issues: no username references, no hard-coded role IDs, proper snake_case
 * Uses Owen's exact pattern: UPDATE-then-INSERT fallback with dynamic role lookup
 */

const bcrypt = require('bcrypt');

module.exports = {
  up: async ({ context: queryInterface, Sequelize }) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      console.log('[SEED] Starting idempotent roles and admin seeding...');
      
      // 1) Upsert roles (Admin/User) with ON CONFLICT (name) DO NOTHING
      await queryInterface.sequelize.query(`
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('Admin', 'Administrator role with full access', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `, { transaction: t });

      await queryInterface.sequelize.query(`
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('User', 'Standard user role', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `, { transaction: t });

      console.log('[SEED] ✅ Roles upserted (Admin, User)');

      // 2) Fetch adminRoleId via SELECT (no hard-coded IDs)
      const [adminRoleRows] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'Admin' LIMIT 1`,
        { transaction: t }
      );
      
      if (!adminRoleRows || adminRoleRows.length === 0) {
        throw new Error('Admin role not found after upsert');
      }
      
      const adminRoleId = adminRoleRows[0].id;
      console.log(`[SEED] Admin role ID resolved: ${adminRoleId}`);

      // 3) Generate bcrypt hash for password
      const email = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
      const password = process.env.SEED_ADMIN_PASSWORD || 'dbxsupersecure';
      const passwordHash = await bcrypt.hash(password, 12);

      console.log(`[SEED] Upserting admin user: ${email}`);

      // 4) UPDATE Admins SET password_hash, role_id, updated_at WHERE email RETURNING id, email
      const [updateRows] = await queryInterface.sequelize.query(`
        UPDATE "Admins" 
        SET password_hash = :hash, role_id = :roleId, updated_at = NOW()
        WHERE email = :email 
        RETURNING id, email
      `, {
        replacements: { 
          email: email,
          hash: passwordHash, 
          roleId: adminRoleId 
        },
        transaction: t
      });

      if (updateRows && updateRows.length > 0) {
        console.log('[SEED] ✅ Admin user updated successfully');
      } else {
        // 5) If no row updated, INSERT (email, password_hash, role_id, created_at, updated_at) RETURNING id, email
        console.log('[SEED] Admin user does not exist, inserting new admin...');
        
        const [insertRows] = await queryInterface.sequelize.query(`
          INSERT INTO "Admins" (email, password_hash, role_id, created_at, updated_at)
          VALUES (:email, :hash, :roleId, NOW(), NOW())
          RETURNING id, email
        `, {
          replacements: { 
            email: email,
            hash: passwordHash, 
            roleId: adminRoleId 
          },
          transaction: t
        });

        console.log('[SEED] ✅ Admin user inserted successfully');
      }

      await t.commit();
      console.log(`[SEED] ✅ Admin user upserted successfully: ${email}`);
      console.log('[SEED] Idempotent roles and admin seeding completed successfully');
      
    } catch (error) {
      await t.rollback();
      console.error('[SEED] ❌ Failed seeding roles/admin:', error.message);
      console.error('[SEED] Stack trace:', error.stack);
      throw error;
    }
  },

  down: async ({ context: queryInterface }) => {
    console.log('[SEED] Rolling back admin user seeding...');
    
    try {
      // Non-destructive: remove only the seeded admin user
      const email = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
      
      await queryInterface.sequelize.query(
        `DELETE FROM "Admins" WHERE email = :email`,
        {
          replacements: { email }
        }
      );
      
      console.log(`[SEED] ✅ Removed seeded admin user: ${email}`);
      console.log('[SEED] ℹ️ Note: Base roles (Admin, User) were not removed for safety');
      
    } catch (error) {
      console.log('[SEED] ℹ️ Could not remove seeded admin user:', error.message);
    }
    
    console.log('[SEED] Rollback completed');
  }
};

