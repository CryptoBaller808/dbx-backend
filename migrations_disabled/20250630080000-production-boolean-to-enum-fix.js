'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Production-Specific BOOLEAN to ENUM Migration
     * 
     * This migration specifically handles production databases where:
     * - users.status column is still BOOLEAN type
     * - Need to convert BOOLEAN -> TEXT -> ENUM safely
     * - Handle existing boolean data (true/false) properly
     * 
     * Steps:
     * 1. Check current column type
     * 2. If BOOLEAN: Convert BOOLEAN to TEXT with proper value mapping
     * 3. Create ENUM type safely
     * 4. Convert TEXT to ENUM
     * 5. Apply constraints
     */
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🎯 [Production Fix] Starting BOOLEAN to ENUM conversion for production...');
      
      // Step 1: Check current column type
      console.log('🔍 [Step 1] Checking current users.status column type...');
      
      const columnInfo = await queryInterface.describeTable('users');
      const statusColumn = columnInfo.status;
      
      console.log(`📋 [Step 1] Current status column type: ${statusColumn.type}`);
      console.log(`📋 [Step 1] Default value: ${statusColumn.defaultValue}`);
      console.log(`📋 [Step 1] Allow null: ${statusColumn.allowNull}`);
      
      // Step 2: Handle BOOLEAN to TEXT conversion if needed
      if (statusColumn.type === 'BOOLEAN') {
        console.log('🔧 [Step 2] Column is BOOLEAN - converting to TEXT with value mapping...');
        
        // First, drop constraints to avoid conflicts
        console.log('🔧 [Step 2a] Dropping constraints...');
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
          `, { transaction });
          console.log('✅ [Step 2a] DEFAULT constraint dropped');
        } catch (error) {
          console.log('ℹ️  [Step 2a] DEFAULT constraint not found or already dropped');
        }
        
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;
          `, { transaction });
          console.log('✅ [Step 2a] NOT NULL constraint dropped');
        } catch (error) {
          console.log('ℹ️  [Step 2a] NOT NULL constraint not found or already dropped');
        }
        
        // Convert BOOLEAN to TEXT with proper value mapping
        console.log('🔧 [Step 2b] Converting BOOLEAN to TEXT with value mapping...');
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
        console.log('✅ [Step 2b] BOOLEAN to TEXT conversion completed');
        
      } else if (statusColumn.type === 'USER-DEFINED' || statusColumn.type.includes('enum_users_status')) {
        console.log('✅ [Step 2] Column is already ENUM type - skipping BOOLEAN conversion');
      } else {
        console.log(`🔧 [Step 2] Column type is ${statusColumn.type} - treating as TEXT`);
      }
      
      // Step 3: Create ENUM type safely
      console.log('🔧 [Step 3] Creating ENUM type safely...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          CREATE TYPE "public"."enum_users_status" AS ENUM (
            'active', 'pending', 'suspended', 'banned', 'deleted'
          );
          RAISE NOTICE 'ENUM type enum_users_status created successfully';
        EXCEPTION
          WHEN duplicate_object THEN 
            RAISE NOTICE 'ENUM type enum_users_status already exists, skipping creation';
        END
        $$;
      `, { transaction });
      console.log('✅ [Step 3] ENUM type creation completed');
      
      // Step 4: Convert TEXT to ENUM if not already ENUM
      const updatedColumnInfo = await queryInterface.describeTable('users');
      const updatedStatusColumn = updatedColumnInfo.status;
      
      if (updatedStatusColumn.type !== 'USER-DEFINED' && !updatedStatusColumn.type.includes('enum_users_status')) {
        console.log('🔧 [Step 4] Converting TEXT to ENUM...');
        
        // Clean any invalid data before conversion
        console.log('🧼 [Step 4a] Cleaning invalid data...');
        const cleanupResult = await queryInterface.sequelize.query(`
          UPDATE "users"
          SET "status" = 'active'
          WHERE "status" NOT IN ('active', 'pending', 'suspended', 'banned', 'deleted')
             OR "status" IS NULL;
        `, { type: Sequelize.QueryTypes.UPDATE, transaction });
        console.log(`✅ [Step 4a] Cleaned ${cleanupResult[1]} invalid status values`);
        
        // Convert TEXT to ENUM
        console.log('🔧 [Step 4b] Converting TEXT to ENUM...');
        await queryInterface.sequelize.query(`
          ALTER TABLE "users"
          ALTER COLUMN "status"
          TYPE "public"."enum_users_status"
          USING ("status"::"public"."enum_users_status");
        `, { transaction });
        console.log('✅ [Step 4b] TEXT to ENUM conversion completed');
        
      } else {
        console.log('✅ [Step 4] Column is already ENUM type - skipping conversion');
      }
      
      // Step 5: Apply constraints
      console.log('🔧 [Step 5] Applying constraints...');
      await queryInterface.sequelize.query(`
        ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';
      `, { transaction });
      console.log('✅ [Step 5a] DEFAULT constraint applied');
      
      await queryInterface.sequelize.query(`
        ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;
      `, { transaction });
      console.log('✅ [Step 5b] NOT NULL constraint applied');
      
      // Step 6: Final verification
      console.log('🔍 [Step 6] Final verification...');
      
      const finalColumnInfo = await queryInterface.describeTable('users');
      const finalStatusColumn = finalColumnInfo.status;
      
      console.log('📋 [Step 6] Final column information:');
      console.log(`   - Type: ${finalStatusColumn.type}`);
      console.log(`   - Default: ${finalStatusColumn.defaultValue}`);
      console.log(`   - Allow NULL: ${finalStatusColumn.allowNull}`);
      
      // Test ENUM functionality
      console.log('🧪 [Step 6] Testing ENUM functionality...');
      try {
        await queryInterface.sequelize.query(
          "SELECT 'active'::public.enum_users_status AS test_value;",
          { type: Sequelize.QueryTypes.SELECT, transaction }
        );
        console.log('✅ [Step 6] ENUM functionality test passed');
      } catch (error) {
        throw new Error(`ENUM functionality test failed: ${error.message}`);
      }
      
      // Final status distribution
      const finalDistribution = await queryInterface.sequelize.query(
        'SELECT status, COUNT(*) as count FROM users GROUP BY status ORDER BY count DESC;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      console.log('📊 [Step 6] Final status distribution:');
      if (finalDistribution.length === 0) {
        console.log('   - No users in table (empty table)');
      } else {
        finalDistribution.forEach(row => {
          console.log(`   - ${row.status}: ${row.count} users`);
        });
      }
      
      await transaction.commit();
      console.log('🎉 [SUCCESS] Production BOOLEAN to ENUM conversion completed!');
      console.log('🚀 [SUCCESS] Backend deployment should now succeed!');
      console.log('💯 [SUCCESS] Users.status column is ready for production!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [ERROR] Production BOOLEAN to ENUM conversion failed:', error);
      console.error('❌ [ERROR] Stack trace:', error.stack);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Rollback the production BOOLEAN to ENUM migration
     * 
     * This will convert the ENUM back to BOOLEAN type
     * Data will be converted back to boolean values
     */
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [Rollback] Rolling back production BOOLEAN to ENUM migration...');
      
      // Convert ENUM back to BOOLEAN with value mapping
      await queryInterface.sequelize.query(`
        ALTER TABLE "users"
          ALTER COLUMN "status" DROP DEFAULT,
          ALTER COLUMN "status" TYPE BOOLEAN 
          USING CASE 
            WHEN "status" = 'active' THEN true
            WHEN "status" = 'pending' THEN true
            WHEN "status" = 'suspended' THEN false
            WHEN "status" = 'banned' THEN false
            WHEN "status" = 'deleted' THEN false
            ELSE true
          END,
          ALTER COLUMN "status" SET DEFAULT true,
          ALTER COLUMN "status" SET NOT NULL;
      `, { transaction });
      
      console.log('✅ [Rollback] Column converted back to BOOLEAN type');
      
      await transaction.commit();
      console.log('🎉 [Rollback] Production BOOLEAN to ENUM rollback completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Rollback] Production BOOLEAN to ENUM rollback failed:', error);
      throw error;
    }
  }
};

