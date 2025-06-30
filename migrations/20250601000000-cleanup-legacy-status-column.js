'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🎯 [Start] Legacy users.status cleanup & ENUM migration');

      // Step 0: Force cast BOOLEAN to TEXT to allow safe conversion
      console.log('🔁 [Step 0] Casting users.status column to TEXT...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users
        ALTER COLUMN status DROP DEFAULT,
        ALTER COLUMN status TYPE TEXT USING status::TEXT;
      `, { transaction });
      console.log('✅ [Step 0] Column successfully cast to TEXT');

      // Step 1: Normalize legacy values
      console.log('🧼 [Step 1] Normalizing legacy values...');
      await queryInterface.sequelize.query(`
        UPDATE users SET status = 'active' WHERE status = 'true';
        UPDATE users SET status = 'suspended' WHERE status = 'false';
        UPDATE users SET status = 'active'
        WHERE status NOT IN ('active', 'pending', 'suspended', 'banned', 'deleted');
      `, { transaction });
      console.log('✅ [Step 1] Legacy values normalized');

      // Step 2: Create ENUM type if it doesn't exist
      console.log('🧱 [Step 2] Creating ENUM type (if not exists)...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          CREATE TYPE public.enum_users_status AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END$$;
      `, { transaction });
      console.log('✅ [Step 2] ENUM type ready');

      // Step 3: Convert column to ENUM
      console.log('🔧 [Step 3] Altering column to ENUM...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users
        ALTER COLUMN status TYPE public.enum_users_status USING status::public.enum_users_status,
        ALTER COLUMN status SET DEFAULT 'active',
        ALTER COLUMN status SET NOT NULL;
      `, { transaction });
      console.log('✅ [Step 3] Column converted to ENUM');

      await transaction.commit();
      console.log('🎉 [Success] Migration complete. Deployment ready 🚀');

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
