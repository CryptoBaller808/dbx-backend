'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🚀 [Start] Final fix for legacy users.status column');

      // Step 1: Rename the column to temporarily work around the BOOLEAN type
      console.log('🪄 [Step 1] Renaming users.status → users.status_legacy...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users RENAME COLUMN status TO status_legacy;
      `, { transaction });

      // Step 2: Add new column with TEXT type
      console.log('➕ [Step 2] Creating new users.status column as TEXT...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users ADD COLUMN status TEXT;
      `, { transaction });

      // Step 3: Migrate + normalize values from legacy column
      console.log('🔄 [Step 3] Updating new status column from status_legacy...');
      await queryInterface.sequelize.query(`
        UPDATE users
        SET status = CASE
          WHEN status_legacy = 'true' THEN 'active'
          WHEN status_legacy = 'false' THEN 'suspended'
          WHEN status_legacy IN ('active', 'pending', 'suspended', 'banned', 'deleted') THEN status_legacy
          ELSE 'active'
        END;
      `, { transaction });

      // Step 4: Drop legacy column
      console.log('🧹 [Step 4] Dropping users.status_legacy...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users DROP COLUMN status_legacy;
      `, { transaction });

      // Step 5: Create ENUM type if it doesn’t exist
      console.log('📦 [Step 5] Creating ENUM type if needed...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          CREATE TYPE public.enum_users_status AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END$$;
      `, { transaction });

      // Step 6: Convert status column to ENUM
      console.log('🔧 [Step 6] Altering status column to ENUM...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users
        ALTER COLUMN status TYPE public.enum_users_status USING status::public.enum_users_status,
        ALTER COLUMN status SET DEFAULT 'active',
        ALTER COLUMN status SET NOT NULL;
      `, { transaction });

      await transaction.commit();
      console.log('✅ [SUCCESS] Migration complete. DBX Backend should now deploy 💯');

    } catch (err) {
      await transaction.rollback();
      console.error('❌ [ERROR] Migration failed:', err);
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('↩️ [Rollback] Reverting ENUM back to TEXT...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users
        ALTER COLUMN status DROP DEFAULT,
        ALTER COLUMN status TYPE TEXT,
        ALTER COLUMN status SET DEFAULT 'active',
        ALTER COLUMN status SET NOT NULL;
      `, { transaction });

      await transaction.commit();
      console.log('✅ [Rollback] Column reverted to TEXT');

    } catch (err) {
      await transaction.rollback();
      console.error('❌ [Rollback] Failed to revert ENUM:', err);
      throw err;
    }
  }
};
