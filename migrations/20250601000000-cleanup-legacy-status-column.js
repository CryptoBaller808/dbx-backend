'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Legacy Users Status Data Cleanup and ENUM Migration
     * 
     * Following the exact step-by-step instructions to:
     * 1. Check if any old rows have values like 'true', 'false', or unexpected values
     * 2. Convert those to valid enum values using UPDATE statements
     * 3. Run the safe migration script to create ENUM and alter column
     * 
     * Target: Fix legacy "users.status" column data for enum migration
     */
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🎯 [Legacy Cleanup] Starting legacy users.status data cleanup...');
      
      // Step 1: Check if any old rows have values like 'true', 'false', or unexpected values
      console.log('🔍 [Step 1] Checking existing status values...');
      
      const distinctValues = await queryInterface.sequelize.query(
        'SELECT DISTINCT status FROM users;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      console.log('📊 [Step 1] Found distinct status values:');
      if (distinctValues.length === 0) {
        console.log('   - No users in table (empty table)');
      } else {
        distinctValues.forEach(row => {
          console.log(`   - "${row.status}"`);
        });
      }
      
      // Step 2: Convert legacy boolean-like values to valid enum values
      console.log('🧼 [Step 2] Converting legacy boolean-like values...');
      
      // Check if column is already ENUM type
      const columnInfo = await queryInterface.describeTable('users');
      const statusColumn = columnInfo.status;
      
      console.log(`📋 [Step 2] Current status column type: ${statusColumn.type}`);
      
      if (statusColumn.type === 'USER-DEFINED' || statusColumn.type.includes('enum_users_status')) {
        console.log('✅ [Step 2] Column is already ENUM type - no boolean conversion needed');
        console.log('✅ [Step 2] All existing values are already valid ENUM values');
      } else {
        console.log('🔄 [Step 2] Column is not ENUM yet, converting boolean-like values...');
        
        // Convert 'true' to 'active'
        console.log('🔄 [Step 2a] Converting "true" values to "active"...');
        const trueResult = await queryInterface.sequelize.query(
          "UPDATE users SET status = 'active' WHERE status = 'true';",
          { type: Sequelize.QueryTypes.UPDATE, transaction }
        );
        console.log(`✅ [Step 2a] Updated ${trueResult[1]} rows from 'true' to 'active'`);
        
        // Convert 'false' to 'suspended'
        console.log('🔄 [Step 2b] Converting "false" values to "suspended"...');
        const falseResult = await queryInterface.sequelize.query(
          "UPDATE users SET status = 'suspended' WHERE status = 'false';",
          { type: Sequelize.QueryTypes.UPDATE, transaction }
        );
        console.log(`✅ [Step 2b] Updated ${falseResult[1]} rows from 'false' to 'suspended'`);
        
        // Convert any other unexpected values to 'active' (safe default)
        console.log('🔄 [Step 2c] Converting any other unexpected values to "active"...');
        const otherResult = await queryInterface.sequelize.query(
          "UPDATE users SET status = 'active' WHERE status NOT IN ('active', 'pending', 'suspended', 'banned', 'deleted');",
          { type: Sequelize.QueryTypes.UPDATE, transaction }
        );
        console.log(`✅ [Step 2c] Updated ${otherResult[1]} rows with unexpected values to 'active'`);
      }
      
      // Verify data cleanup
      console.log('🔍 [Step 2d] Verifying data cleanup...');
      const cleanedValues = await queryInterface.sequelize.query(
        'SELECT DISTINCT status FROM users;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      console.log('📊 [Step 2d] Status values after cleanup:');
      if (cleanedValues.length === 0) {
        console.log('   - No users in table (empty table)');
      } else {
        cleanedValues.forEach(row => {
          console.log(`   - "${row.status}"`);
        });
      }
      
      // Step 3: Run the safe migration script
      console.log('🛡️ [Step 3] Running safe ENUM migration script...');
      
      // Step 3a: Create enum type (skip if exists)
      console.log('🔧 [Step 3a] Creating ENUM type safely...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          CREATE TYPE public.enum_users_status AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
          RAISE NOTICE 'ENUM type enum_users_status created successfully';
        EXCEPTION
          WHEN duplicate_object THEN 
            RAISE NOTICE 'ENUM type enum_users_status already exists, skipping creation';
        END
        $$;
      `, { transaction });
      console.log('✅ [Step 3a] ENUM type creation completed');
      
      // Step 3b: Alter column to enum type
      console.log('🔧 [Step 3b] Altering column to ENUM type...');
      
      if (statusColumn.type === 'USER-DEFINED' || statusColumn.type.includes('enum_users_status')) {
        console.log('✅ [Step 3b] Column is already ENUM type - no conversion needed');
      } else {
        console.log('🔄 [Step 3b] Converting column to ENUM type...');
        await queryInterface.sequelize.query(`
          ALTER TABLE users
            ALTER COLUMN status DROP DEFAULT,
            ALTER COLUMN status TYPE public.enum_users_status USING status::public.enum_users_status,
            ALTER COLUMN status SET DEFAULT 'active',
            ALTER COLUMN status SET NOT NULL;
        `, { transaction });
        console.log('✅ [Step 3b] Column successfully converted to ENUM type');
      }
      
      // Final verification
      console.log('🔍 [Final] Verifying migration success...');
      
      const finalColumnInfo = await queryInterface.describeTable('users');
      const finalStatusColumn = finalColumnInfo.status;
      
      console.log('📋 [Final] Column information after migration:');
      console.log(`   - Type: ${finalStatusColumn.type}`);
      console.log(`   - Default: ${finalStatusColumn.defaultValue}`);
      console.log(`   - Allow NULL: ${finalStatusColumn.allowNull}`);
      
      // Test ENUM functionality
      console.log('🧪 [Final] Testing ENUM functionality...');
      try {
        await queryInterface.sequelize.query(
          "SELECT 'active'::public.enum_users_status AS test_value;",
          { type: Sequelize.QueryTypes.SELECT, transaction }
        );
        console.log('✅ [Final] ENUM functionality test passed');
      } catch (error) {
        throw new Error(`ENUM functionality test failed: ${error.message}`);
      }
      
      // Final status distribution
      const finalDistribution = await queryInterface.sequelize.query(
        'SELECT status, COUNT(*) as count FROM users GROUP BY status ORDER BY count DESC;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      console.log('📊 [Final] Final status distribution:');
      if (finalDistribution.length === 0) {
        console.log('   - No users in table (empty table)');
      } else {
        finalDistribution.forEach(row => {
          console.log(`   - ${row.status}: ${row.count} users`);
        });
      }
      
      await transaction.commit();
      console.log('🎉 [SUCCESS] Legacy status data cleanup and ENUM migration completed!');
      console.log('🚀 [SUCCESS] Backend deployment should now succeed!');
      console.log('💯 [SUCCESS] Users.status column is ready for production!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [ERROR] Legacy status data cleanup failed:', error);
      console.error('❌ [ERROR] Stack trace:', error.stack);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Rollback the legacy cleanup and ENUM migration
     * 
     * This will convert the ENUM back to TEXT type
     * Data will be preserved but ENUM constraints will be removed
     */
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [Rollback] Rolling back legacy status cleanup and ENUM migration...');
      
      // Convert ENUM back to TEXT
      await queryInterface.sequelize.query(`
        ALTER TABLE users
          ALTER COLUMN status DROP DEFAULT,
          ALTER COLUMN status TYPE TEXT,
          ALTER COLUMN status SET DEFAULT 'active',
          ALTER COLUMN status SET NOT NULL;
      `, { transaction });
      
      console.log('✅ [Rollback] Column converted back to TEXT type');
      
      // Note: We preserve the ENUM type as it might be used elsewhere
      console.log('ℹ️  [Rollback] ENUM type preserved (may be used elsewhere)');
      
      await transaction.commit();
      console.log('🎉 [Rollback] Legacy status cleanup rollback completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Rollback] Legacy status cleanup rollback failed:', error);
      throw error;
    }
  }
};

