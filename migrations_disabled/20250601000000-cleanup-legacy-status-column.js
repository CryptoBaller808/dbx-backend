'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🚀 [Start] Final fix: explicit cast to enum');

      // Check if users table exists
      const tableExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT, transaction });
      
      if (!tableExists[0].exists) {
        console.log('⚠️ [Skip] Users table does not exist yet, skipping migration');
        await transaction.commit();
        return;
      }

      // Check if status column exists
      const columnExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'status'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT, transaction });
      
      if (!columnExists[0].exists) {
        console.log('⚠️ [Skip] Status column does not exist yet, creating it as ENUM');
        
        // Create ENUM type if it doesn't exist
        await queryInterface.sequelize.query(`
          DO $$
          BEGIN
            CREATE TYPE public.enum_users_status AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END$$;
        `, { transaction });
        
        // Add status column as ENUM
        await queryInterface.sequelize.query(`
          ALTER TABLE users ADD COLUMN status public.enum_users_status DEFAULT 'active' NOT NULL;
        `, { transaction });
        
        await transaction.commit();
        console.log('✅ [Complete] Added status column as ENUM');
        return;
      }

      // Step 1: Rename original column to preserve legacy data
      console.log('🪄 [Step 1] Rename users.status → users.status_legacy...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users RENAME COLUMN status TO status_legacy;
      `, { transaction });

      // Step 2: Create ENUM type (if it doesn't exist)
      console.log('📦 [Step 2] Create ENUM type...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          CREATE TYPE public.enum_users_status AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END$$;
      `, { transaction });

      // Step 3: Add new column with ENUM type
      console.log('➕ [Step 3] Add new column "status" of ENUM type...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users ADD COLUMN status public.enum_users_status DEFAULT 'active';
      `, { transaction });

      // Step 4: Copy over cleaned values and cast result
      console.log('🔄 [Step 4] Copy cleaned values into new ENUM column...');
      await queryInterface.sequelize.query(`
        UPDATE users
        SET status = (
          CASE
            WHEN status_legacy::text = 'true' THEN 'active'
            WHEN status_legacy::text = 'false' THEN 'suspended'
            WHEN status_legacy::text IN ('active', 'pending', 'suspended', 'banned', 'deleted') THEN status_legacy::text
            ELSE 'active'
          END
        )::public.enum_users_status;
      `, { transaction });

      // Step 5: Remove old column
      console.log('🧹 [Step 5] Drop legacy column...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users DROP COLUMN status_legacy;
      `, { transaction });

      // Step 6: Make ENUM column NOT NULL
      console.log('🔒 [Step 6] Apply constraints...');
      await queryInterface.sequelize.query(`
        ALTER TABLE users
        ALTER COLUMN status SET NOT NULL,
        ALTER COLUMN status SET DEFAULT 'active';
      `, { transaction });

      await transaction.commit();
      console.log('✅ [Complete] ENUM migration finalized');

    } catch (err) {
      await transaction.rollback();
      console.error('❌ [Migration Failed]', err);
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('↩️ [Rollback] Reverting ENUM migration...');

      // Check if users table exists
      const tableExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT, transaction });
      
      if (!tableExists[0].exists) {
        console.log('⚠️ [Skip] Users table does not exist, skipping rollback');
        await transaction.commit();
        return;
      }

      // Check if status column exists
      const columnExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'status'
        );
      `, { type: queryInterface.sequelize.QueryTypes.SELECT, transaction });
      
      if (!columnExists[0].exists) {
        console.log('⚠️ [Skip] Status column does not exist, nothing to roll back');
        await transaction.commit();
        return;
      }

      await queryInterface.sequelize.query(`
        ALTER TABLE users DROP COLUMN status;
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active' NOT NULL;
      `, { transaction });

      await transaction.commit();
      console.log('✅ [Rollback] ENUM reverted');

    } catch (err) {
      await transaction.rollback();
      console.error('❌ [Rollback Failed]', err);
      throw err;
    }
  }
};
