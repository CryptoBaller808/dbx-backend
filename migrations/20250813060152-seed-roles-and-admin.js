/**
 * Seed roles and admin user with dynamic column detection
 * Adapts to live Admins schema without assumptions
 */

'use strict';

module.exports = {
  async up({ context: queryInterface, Sequelize }) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('[SEED] Starting idempotent roles and admin seeding with dynamic column detection...');
      
      // Step 1: Detect Admins table columns at runtime
      console.log('[SEED] Detecting Admins table schema...');
      
      const [columns] = await queryInterface.sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='Admins'
        ORDER BY column_name;
      `, { transaction });
      
      const columnNames = columns.map(row => row.column_name);
      console.log('[SEED] Available Admins columns:', columnNames);
      
      // Step 2: Choose password column in priority order
      let passwordCol = null;
      if (columnNames.includes('password_hash')) {
        passwordCol = 'password_hash';
      } else if (columnNames.includes('password')) {
        passwordCol = 'password';
      } else if (columnNames.includes('passwordHash')) {
        passwordCol = '"passwordHash"';
      } else {
        throw new Error('No password column found in Admins table (checked: password_hash, password, passwordHash)');
      }
      
      // Step 3: Choose timestamp columns
      const createdCol = columnNames.includes('created_at') ? 'created_at' : '"createdAt"';
      const updatedCol = columnNames.includes('updated_at') ? 'updated_at' : '"updatedAt"';
      
      // Step 4: Check if username column exists
      const hasUsername = columnNames.includes('username');
      
      console.log('[SEED] Column mapping:', {
        password: passwordCol,
        created: createdCol,
        updated: updatedCol,
        hasUsername: hasUsername
      });
      
      // Step 5: Upsert roles (this part already works)
      console.log('[SEED] Upserting roles...');
      
      await queryInterface.sequelize.query(`
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('Admin','Administrator role with full access', NOW(), NOW()),
               ('User','Standard user role', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
      `, { transaction });
      
      console.log('[SEED] ✅ Roles upserted (Admin, User)');
      
      // Step 6: Get Admin role ID
      console.log('[SEED] Fetching Admin role ID...');
      
      const [adminRoleResults] = await queryInterface.sequelize.query(`
        SELECT id FROM roles WHERE name='Admin' LIMIT 1;
      `, { transaction });
      
      if (!adminRoleResults || adminRoleResults.length === 0) {
        throw new Error('Admin role not found after upsert');
      }
      
      const adminRoleId = adminRoleResults[0].id;
      console.log('[SEED] Admin role ID:', adminRoleId);
      
      // Step 7: Get admin credentials from environment
      const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
      const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'dbxsupersecure';
      
      // Step 8: Hash password with bcryptjs
      console.log('[SEED] Hashing admin password...');
      
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      
      console.log('[SEED] Password hashed successfully');
      
      // Step 9: UPDATE-then-INSERT pattern (no ON CONFLICT due to missing columns)
      console.log('[SEED] Attempting UPDATE first...');
      
      const [updateResults] = await queryInterface.sequelize.query(`
        UPDATE "Admins"
        SET ${passwordCol} = :hash,
            role_id = :roleId,
            ${updatedCol} = NOW()
        WHERE email = :email
        RETURNING id, email;
      `, {
        replacements: {
          hash: passwordHash,
          roleId: adminRoleId,
          email: adminEmail
        },
        transaction
      });
      
      let adminUser;
      
      if (updateResults && updateResults.length > 0) {
        // UPDATE succeeded
        adminUser = updateResults[0];
        console.log('[SEED] ✅ Admin user updated:', { id: adminUser.id, email: adminUser.email });
      } else {
        // UPDATE returned zero rows, do INSERT
        console.log('[SEED] No existing admin found, inserting new admin...');
        
        // Build INSERT query dynamically based on available columns
        let insertColumns = `email, ${passwordCol}, role_id, ${createdCol}, ${updatedCol}`;
        let insertValues = ':email, :hash, :roleId, NOW(), NOW()';
        let insertReplacements = {
          email: adminEmail,
          hash: passwordHash,
          roleId: adminRoleId
        };
        
        if (hasUsername) {
          insertColumns += ', username';
          insertValues += ', :username';
          insertReplacements.username = 'admin';
        }
        
        const [insertResults] = await queryInterface.sequelize.query(`
          INSERT INTO "Admins" (${insertColumns})
          VALUES (${insertValues})
          RETURNING id, email;
        `, {
          replacements: insertReplacements,
          transaction
        });
        
        if (!insertResults || insertResults.length === 0) {
          throw new Error('Admin user INSERT failed - no results returned');
        }
        
        adminUser = insertResults[0];
        console.log('[SEED] ✅ Admin user inserted:', { id: adminUser.id, email: adminUser.email });
      }
      
      await transaction.commit();
      
      console.log('[SEED] ✅ Admin user upserted successfully:', adminEmail);
      console.log('[SEED] Seeding completed successfully');
      
      return {
        success: true,
        summary: 'Roles and admin user seeded successfully',
        details: {
          roles: ['Admin', 'User'],
          admin: {
            id: adminUser.id,
            email: adminUser.email
          },
          columnMapping: {
            password: passwordCol,
            created: createdCol,
            updated: updatedCol,
            hasUsername: hasUsername
          }
        }
      };
      
    } catch (error) {
      await transaction.rollback();
      console.error('[SEED] ❌ Seeding failed:', error.message);
      console.error('[SEED] Stack trace:', error.stack);
      throw error;
    }
  },

  async down({ context: queryInterface, Sequelize }) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('[SEED] Rolling back admin seeding...');
      
      // Remove admin user
      await queryInterface.sequelize.query(`
        DELETE FROM "Admins" WHERE email = :email;
      `, {
        replacements: {
          email: process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com'
        },
        transaction
      });
      
      // Remove roles
      await queryInterface.sequelize.query(`
        DELETE FROM roles WHERE name IN ('Admin', 'User');
      `, { transaction });
      
      await transaction.commit();
      console.log('[SEED] Rollback completed');
      
    } catch (error) {
      await transaction.rollback();
      console.error('[SEED] Rollback failed:', error.message);
      throw error;
    }
  }
};

