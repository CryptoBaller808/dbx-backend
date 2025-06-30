'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 🛑 DISABLED: This legacy migration conflicts with the smart migration
    // 🛑 The smart migration (20250630070000-legacy-status-data-cleanup.js) handles this properly
    console.log('🛑 [DISABLED MIGRATION] This migration has been disabled to prevent conflicts');
    console.log('🛑 The smart migration handles BOOLEAN to ENUM conversion properly');
    return; // Exit early to prevent execution
    
    /* DISABLED CODE - CAUSES POSTGRESQL ERROR 22P02
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [Migration] Starting user status column conversion from BOOLEAN to ENUM...');
      
      // Step 1: Check current column type
      console.log('🔍 [Migration] Step 1: Checking current column type...');
      const [columnInfo] = await queryInterface.sequelize.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'status';
      `, { transaction });
      
      if (columnInfo.length > 0) {
        const column = columnInfo[0];
        console.log(`📋 [Migration] Current status column: type=${column.data_type}, udt=${column.udt_name}`);
        
        // Only proceed if not already ENUM
        if (column.udt_name !== 'enum_users_status') {
          
          // Step 2: Drop existing constraints
          console.log('🔧 [Migration] Step 2: Dropping existing constraints...');
          try {
            await queryInterface.sequelize.query(`
              ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
            `, { transaction });
            console.log('✅ [Migration] Dropped DEFAULT constraint');
          } catch (error) {
            console.log('ℹ️ [Migration] No DEFAULT constraint to drop');
          }
          
          try {
            await queryInterface.sequelize.query(`
              ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;
            `, { transaction });
            console.log('✅ [Migration] Dropped NOT NULL constraint');
          } catch (error) {
            console.log('ℹ️ [Migration] No NOT NULL constraint to drop');
          }
          
          // Step 3: Convert existing boolean values to text
          console.log('🔧 [Migration] Step 3: Converting boolean values to text...');
          await queryInterface.sequelize.query(`
            ALTER TABLE "users" 
            ALTER COLUMN "status" TYPE TEXT 
            USING CASE 
              WHEN "status" = true THEN 'active'
              WHEN "status" = false THEN 'suspended'
              WHEN "status" IS NULL THEN 'active'
              ELSE 'active'
            END;
          `, { transaction });
          console.log('✅ [Migration] Converted boolean values to text');
          
          // Step 4: Create ENUM type safely
          console.log('🔧 [Migration] Step 4: Creating ENUM type...');
          await queryInterface.sequelize.query(`
            DO $$
            BEGIN
              CREATE TYPE "public"."enum_users_status" AS ENUM (
                'active', 'pending', 'suspended', 'banned', 'deleted'
              );
            EXCEPTION
              WHEN duplicate_object THEN 
                RAISE NOTICE 'ENUM type enum_users_status already exists, skipping creation';
            END
            $$;
          `, { transaction });
          console.log('✅ [Migration] ENUM type created or already exists');
          
          // Step 5: Convert column to ENUM
          console.log('🔧 [Migration] Step 5: Converting column to ENUM...');
          await queryInterface.sequelize.query(`
            ALTER TABLE "users"
              ALTER COLUMN "status"
              TYPE "public"."enum_users_status"
              USING (
                CASE 
                  WHEN "status" IN ('active', 'pending', 'suspended', 'banned', 'deleted') 
                  THEN "status"::"public"."enum_users_status"
                  ELSE 'active'::"public"."enum_users_status"
                END
              );
          `, { transaction });
          console.log('✅ [Migration] Column converted to ENUM');
          
          // Step 6: Set default value and NOT NULL constraint
          console.log('🔧 [Migration] Step 6: Setting default value and constraints...');
          await queryInterface.sequelize.query(`
            ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';
          `, { transaction });
          
          await queryInterface.sequelize.query(`
            ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;
          `, { transaction });
          console.log('✅ [Migration] Default value and NOT NULL constraint applied');
          
          // Step 7: Verify the migration
          console.log('🔍 [Migration] Step 7: Verifying migration...');
          const [verifyResults] = await queryInterface.sequelize.query(`
            SELECT COUNT(*) as total_users,
                   COUNT(CASE WHEN "status" = 'active' THEN 1 END) as active_users,
                   COUNT(CASE WHEN "status" = 'suspended' THEN 1 END) as suspended_users
            FROM "users";
          `, { transaction });
          
          const stats = verifyResults[0];
          console.log(`✅ [Migration] Verification complete: ${stats.total_users} total users, ${stats.active_users} active, ${stats.suspended_users} suspended`);
          
          // Final column check
          const [finalColumnInfo] = await queryInterface.sequelize.query(`
            SELECT column_name, data_type, udt_name, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'status';
          `, { transaction });
          
          const finalColumn = finalColumnInfo[0];
          console.log(`✅ [Migration] Final column info: type=${finalColumn.data_type}, udt=${finalColumn.udt_name}, default=${finalColumn.column_default}`);
          
        } else {
          console.log('✅ [Migration] Status column is already ENUM type, skipping migration');
        }
      } else {
        console.log('⚠️ [Migration] Status column not found in users table');
      }
      
      await transaction.commit();
      console.log('🎉 [Migration] User status column conversion completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Failed to convert status column:', error.message);
      console.error('❌ [Migration] Error details:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [Migration] Reverting user status column from ENUM to BOOLEAN...');
      
      // Convert ENUM values back to boolean
      await queryInterface.sequelize.query(`
        ALTER TABLE "users" 
        ALTER COLUMN "status" TYPE BOOLEAN 
        USING (
          CASE 
            WHEN "status" = 'active' THEN true
            WHEN "status" IN ('pending', 'suspended', 'banned', 'deleted') THEN false
            ELSE true
          END
        );
      `, { transaction });
      
      // Set boolean default
      await queryInterface.sequelize.query(`
        ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT true;
      `, { transaction });
      
      // Drop the ENUM type
      await queryInterface.sequelize.query(`
        DROP TYPE IF EXISTS "public"."enum_users_status";
      `, { transaction });
      
      await transaction.commit();
      console.log('✅ [Migration] Successfully reverted status column to BOOLEAN');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Failed to revert status column:', error.message);
      throw error;
    }
  }
};

