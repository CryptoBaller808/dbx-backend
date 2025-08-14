/**
 * Idempotent migration to add role_id column to Admins table
 * Uses IF NOT EXISTS guards and snake_case timestamps
 * Safe to run multiple times - all operations are idempotent
 */

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('[MIGRATION] Adding role_id column to Admins table (idempotent)...');
      
      // 1. Add role_id column with IF NOT EXISTS guard (Owen's exact pattern)
      console.log('[MIGRATION] Adding role_id column with IF NOT EXISTS guard...');
      await queryInterface.sequelize.query(`
        ALTER TABLE "Admins" ADD COLUMN IF NOT EXISTS role_id INTEGER;
      `, { transaction });
      
      console.log('✅ [MIGRATION] role_id column ensured');
      
      // 2. Add foreign key constraint with IF NOT EXISTS guard (Owen's exact pattern)
      console.log('[MIGRATION] Adding foreign key constraint with IF NOT EXISTS guard...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'admins_role_id_fkey'
          ) THEN
            ALTER TABLE "Admins"
              ADD CONSTRAINT admins_role_id_fkey
              FOREIGN KEY (role_id) REFERENCES roles(id)
              ON UPDATE CASCADE ON DELETE SET NULL;
          END IF;
        END$$;
      `, { transaction });
      
      console.log('✅ [MIGRATION] Foreign key constraint ensured');
      
      // 3. Backfill existing admins with Admin role (Owen's exact pattern)
      console.log('[MIGRATION] Backfilling existing admins with Admin role...');
      const [updateResult] = await queryInterface.sequelize.query(`
        UPDATE "Admins"
        SET role_id = (SELECT id FROM roles WHERE name='Admin')
        WHERE role_id IS NULL;
      `, { transaction });
      
      const updatedRows = updateResult.rowCount || 0;
      console.log(`✅ [MIGRATION] Backfilled ${updatedRows} admin records with Admin role`);
      
      // 4. Verify the migration worked
      const [verifyResult] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as admin_count
        FROM "Admins" a
        JOIN roles r ON a.role_id = r.id
        WHERE r.name = 'Admin';
      `, { transaction });
      
      const adminCount = verifyResult[0]?.admin_count || 0;
      console.log(`✅ [MIGRATION] Verification: ${adminCount} admins now have Admin role`);
      
      await transaction.commit();
      console.log('[MIGRATION] Successfully added role_id to Admins with idempotent operations');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [MIGRATION] Failed to add role_id to Admins:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('[MIGRATION] Removing role_id column from Admins...');
      
      // 1. Remove foreign key constraint if it exists
      console.log('[MIGRATION] Removing foreign key constraint...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'admins_role_id_fkey'
          ) THEN
            ALTER TABLE "Admins" DROP CONSTRAINT admins_role_id_fkey;
          END IF;
        END$$;
      `, { transaction });
      
      console.log('✅ [MIGRATION] Foreign key constraint removed (if existed)');
      
      // 2. Remove role_id column if it exists
      console.log('[MIGRATION] Removing role_id column...');
      await queryInterface.sequelize.query(`
        ALTER TABLE "Admins" DROP COLUMN IF EXISTS role_id;
      `, { transaction });
      
      console.log('✅ [MIGRATION] role_id column removed (if existed)');
      
      await transaction.commit();
      console.log('[MIGRATION] Successfully removed role_id from Admins');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [MIGRATION] Failed to remove role_id from Admins:', error.message);
      throw error;
    }
  }
};

