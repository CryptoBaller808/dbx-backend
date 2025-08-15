/**
 * Idempotent seeding migration for roles and admin user
 * Uses Umzug v3 signature and environment variables
 * Owen's exact specification - no models, only queryInterface.sequelize.query
 */

const bcrypt = require('bcrypt');

module.exports = {
  up: async ({ context: queryInterface, Sequelize }) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      // Seed roles via natural keys (no explicit IDs)
      await queryInterface.sequelize.query(`
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('Admin','Administrator role with full access', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `, { transaction: t });

      await queryInterface.sequelize.query(`
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('User','Standard user role', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `, { transaction: t });

      // Get role_id for Admin
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name='Admin' LIMIT 1`,
        { transaction: t }
      );
      const adminRoleId = rows?.[0]?.id;

      if (!adminRoleId) {
        throw new Error('Admin role not found after insert');
      }

      // Generate bcrypt hash for password
      const password = process.env.SEED_ADMIN_PASSWORD || 'dbxsupersecure';
      const hash = await bcrypt.hash(password, 12);

      // Upsert admin with natural keys (email), snake_case timestamps
      await queryInterface.sequelize.query(`
        INSERT INTO "Admins" (email, password_hash, role_id, created_at, updated_at)
        VALUES (:email, :hash, :roleId, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET role_id = EXCLUDED.role_id, updated_at = NOW()
      `, {
        replacements: {
          email: process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com',
          hash: hash,
          roleId: adminRoleId
        },
        transaction: t
      });

      await t.commit();
      console.log('✅ [SEED] Roles and admin user seeded successfully');
    } catch (e) {
      await t.rollback();
      console.error('❌ [SEED] Error:', e);
      throw e;
    }
  },

  down: async ({ context: queryInterface }) => {
    // Optional: delete seeded admin/roles by natural keys
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
    await queryInterface.sequelize.query(`
      DELETE FROM "Admins" WHERE email = :email
    `, {
      replacements: { email }
    });
  }
};

