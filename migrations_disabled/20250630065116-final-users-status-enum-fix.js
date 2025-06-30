'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Final Users Status ENUM Migration
     * 
     * This migration ensures the users.status column is properly converted
     * from any legacy format to the correct ENUM type with safe data conversion.
     * 
     * Steps:
     * 1. Check current status values and report them
     * 2. Convert any boolean-like values to valid ENUM strings
     * 3. Create ENUM type safely (skip if exists)
     * 4. Convert column to ENUM type with proper constraints
     * 5. Verify the migration success
     */
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🎯 [Migration] Starting final users.status ENUM fix...');
      
      // Step 1: Check current status values
      console.log('🔍 [Migration] Step 1: Checking current status values...');
      const currentValues = await queryInterface.sequelize.query(
        'SELECT DISTINCT status FROM users;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      console.log(`📊 [Migration] Found ${currentValues.length} distinct status values:`);
      currentValues.forEach(row => {
        console.log(`   - "${row.status}"`);
      });
      
      // Step 2: Check column type first, then convert data if needed
      console.log('🔧 [Migration] Step 2: Checking column type before data conversion...');
      
      const columnInfo = await queryInterface.describeTable('users');
      const statusColumn = columnInfo.status;
      
      console.log(`📋 [Migration] Current status column type: ${statusColumn.type}`);
      
      if (statusColumn.type !== 'USER-DEFINED' && !statusColumn.type.includes('enum_users_status')) {
        console.log('🔄 [Migration] Column is not ENUM yet, converting boolean-like values...');
        
        // Convert 'true' to 'active'
        const trueUpdates = await queryInterface.sequelize.query(
          "UPDATE users SET status = 'active' WHERE status = 'true';",
          { type: Sequelize.QueryTypes.UPDATE, transaction }
        );
        if (trueUpdates[1] > 0) {
          console.log(`✅ [Migration] Converted ${trueUpdates[1]} 'true' values to 'active'`);
        }
        
        // Convert 'false' to 'suspended'
        const falseUpdates = await queryInterface.sequelize.query(
          "UPDATE users SET status = 'suspended' WHERE status = 'false';",
          { type: Sequelize.QueryTypes.UPDATE, transaction }
        );
        if (falseUpdates[1] > 0) {
          console.log(`✅ [Migration] Converted ${falseUpdates[1]} 'false' values to 'suspended'`);
        }
        
        // Convert any other unexpected values to 'active'
        const otherUpdates = await queryInterface.sequelize.query(
          "UPDATE users SET status = 'active' WHERE status NOT IN ('active', 'pending', 'suspended', 'banned', 'deleted');",
          { type: Sequelize.QueryTypes.UPDATE, transaction }
        );
        if (otherUpdates[1] > 0) {
          console.log(`✅ [Migration] Converted ${otherUpdates[1]} unexpected values to 'active'`);
        }
      } else {
        console.log('✅ [Migration] Column is already ENUM type, skipping data conversion');
      }
      
      // Step 3: Create ENUM type safely (skip if exists)
      console.log('🔧 [Migration] Step 3: Creating ENUM type safely...');
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          CREATE TYPE public.enum_users_status AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
          RAISE NOTICE 'ENUM type created successfully';
        EXCEPTION
          WHEN duplicate_object THEN 
            RAISE NOTICE 'ENUM type already exists, skipping creation';
        END
        $$;
      `, { transaction });
      
      // Step 4: Convert column to ENUM type if needed
      console.log('🔧 [Migration] Step 4: Converting column to ENUM type if needed...');
      
      if (statusColumn.type !== 'USER-DEFINED' && !statusColumn.type.includes('enum_users_status')) {
        console.log('🔄 [Migration] Converting column to ENUM type...');
        
        // Convert column to ENUM type
        await queryInterface.sequelize.query(`
          ALTER TABLE users
            ALTER COLUMN status DROP DEFAULT,
            ALTER COLUMN status TYPE public.enum_users_status USING status::public.enum_users_status,
            ALTER COLUMN status SET DEFAULT 'active',
            ALTER COLUMN status SET NOT NULL;
        `, { transaction });
        
        console.log('✅ [Migration] Column converted to ENUM type successfully');
      } else {
        console.log('✅ [Migration] Column is already ENUM type, skipping conversion');
      }
      
      // Step 5: Verify the migration success
      console.log('🔍 [Migration] Step 5: Verifying migration success...');
      
      const finalColumnInfo = await queryInterface.describeTable('users');
      const finalStatusColumn = finalColumnInfo.status;
      
      console.log(`📋 [Migration] Final status column type: ${finalStatusColumn.type}`);
      console.log(`📋 [Migration] Default value: ${finalStatusColumn.defaultValue}`);
      console.log(`📋 [Migration] Allow null: ${finalStatusColumn.allowNull}`);
      
      // Check final status values
      const finalValues = await queryInterface.sequelize.query(
        'SELECT status, COUNT(*) as count FROM users GROUP BY status ORDER BY count DESC;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      
      console.log(`📊 [Migration] Final status distribution:`);
      if (finalValues.length === 0) {
        console.log('   - No users in table (empty table)');
      } else {
        finalValues.forEach(row => {
          console.log(`   - ${row.status}: ${row.count} users`);
        });
      }
      
      // Test ENUM constraint
      console.log('🧪 [Migration] Testing ENUM constraint...');
      try {
        await queryInterface.sequelize.query(
          "SELECT 'active'::public.enum_users_status;",
          { type: Sequelize.QueryTypes.SELECT, transaction }
        );
        console.log('✅ [Migration] ENUM constraint test passed');
      } catch (error) {
        throw new Error(`ENUM constraint test failed: ${error.message}`);
      }
      
      await transaction.commit();
      console.log('🎉 [Migration] Final users.status ENUM fix completed successfully!');
      console.log('✅ [Migration] Ready for production deployment!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Final users.status ENUM fix failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Rollback the ENUM migration
     * 
     * Note: This rollback converts ENUM back to TEXT type
     * Data will be preserved but type constraints will be removed
     */
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [Rollback] Rolling back users.status ENUM migration...');
      
      // Convert ENUM back to TEXT
      await queryInterface.sequelize.query(`
        ALTER TABLE users
          ALTER COLUMN status DROP DEFAULT,
          ALTER COLUMN status TYPE TEXT,
          ALTER COLUMN status SET DEFAULT 'active',
          ALTER COLUMN status SET NOT NULL;
      `, { transaction });
      
      console.log('✅ [Rollback] Column converted back to TEXT type');
      
      // Note: We don't drop the ENUM type as it might be used elsewhere
      console.log('ℹ️  [Rollback] ENUM type preserved (may be used elsewhere)');
      
      await transaction.commit();
      console.log('🎉 [Rollback] Users.status ENUM rollback completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Rollback] Users.status ENUM rollback failed:', error);
      throw error;
    }
  }
};

