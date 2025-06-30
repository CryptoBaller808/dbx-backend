'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔧 [ULTIMATE STATUS FIX] Starting comprehensive production status column migration...');
      
      // Step 1: Check current column type and data
      console.log('📊 [STEP 1] Analyzing current column structure and data...');
      
      const columnInfo = await queryInterface.describeTable('users');
      const statusColumn = columnInfo.status;
      console.log('📋 Current status column info:', JSON.stringify(statusColumn, null, 2));
      
      // Step 2: Get sample of current data to understand the situation
      const sampleData = await queryInterface.sequelize.query(
        'SELECT DISTINCT status, COUNT(*) as count FROM users GROUP BY status ORDER BY count DESC LIMIT 10;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      console.log('📊 Current status values in database:', sampleData);
      
      // Step 3: Handle different scenarios based on current column type
      if (statusColumn.type === 'BOOLEAN' || statusColumn.type.includes('boolean')) {
        console.log('🔄 [SCENARIO A] Column is BOOLEAN type with string data - converting via TEXT intermediate...');
        
        // Sub-step 3a: Convert column to TEXT first to handle string data
        await queryInterface.sequelize.query(
          'ALTER TABLE users ALTER COLUMN status TYPE TEXT USING CASE ' +
          'WHEN status::text = \'true\' THEN \'active\' ' +
          'WHEN status::text = \'false\' THEN \'suspended\' ' +
          'WHEN status::text = \'active\' THEN \'active\' ' +
          'WHEN status::text = \'pending\' THEN \'pending\' ' +
          'WHEN status::text = \'suspended\' THEN \'suspended\' ' +
          'WHEN status::text = \'banned\' THEN \'banned\' ' +
          'WHEN status::text = \'deleted\' THEN \'deleted\' ' +
          'ELSE \'active\' END;',
          { transaction }
        );
        console.log('✅ Converted BOOLEAN column to TEXT with proper string values');
        
      } else if (statusColumn.type === 'TEXT' || statusColumn.type.includes('text') || statusColumn.type.includes('varchar')) {
        console.log('🔄 [SCENARIO B] Column is TEXT type - normalizing string values...');
        
        // Normalize any inconsistent string values
        await queryInterface.sequelize.query(
          'UPDATE users SET status = CASE ' +
          'WHEN LOWER(status) IN (\'true\', \'1\', \'yes\', \'active\') THEN \'active\' ' +
          'WHEN LOWER(status) IN (\'false\', \'0\', \'no\', \'inactive\', \'suspended\') THEN \'suspended\' ' +
          'WHEN LOWER(status) = \'pending\' THEN \'pending\' ' +
          'WHEN LOWER(status) = \'banned\' THEN \'banned\' ' +
          'WHEN LOWER(status) = \'deleted\' THEN \'deleted\' ' +
          'ELSE \'active\' END;',
          { transaction }
        );
        console.log('✅ Normalized TEXT column values to standard ENUM values');
        
      } else if (statusColumn.type.includes('enum') || statusColumn.type.includes('USER-DEFINED')) {
        console.log('🔄 [SCENARIO C] Column is already ENUM type - verifying values...');
        
        // Just verify the values are correct
        await queryInterface.sequelize.query(
          'UPDATE users SET status = \'active\' WHERE status NOT IN (\'active\', \'pending\', \'suspended\', \'banned\', \'deleted\');',
          { transaction }
        );
        console.log('✅ ENUM column values verified and corrected');
        
      } else {
        console.log('🔄 [SCENARIO D] Unknown column type - converting to TEXT first...');
        
        // Convert unknown type to TEXT with safe defaults
        await queryInterface.sequelize.query(
          'ALTER TABLE users ALTER COLUMN status TYPE TEXT USING \'active\';',
          { transaction }
        );
        console.log('✅ Converted unknown type to TEXT with default values');
      }
      
      // Step 4: Create ENUM type if it doesn't exist
      console.log('🔧 [STEP 4] Creating ENUM type...');
      await queryInterface.sequelize.query(
        'DO $$ BEGIN ' +
        'CREATE TYPE public.enum_users_status AS ENUM(\'active\', \'pending\', \'suspended\', \'banned\', \'deleted\'); ' +
        'EXCEPTION WHEN duplicate_object THEN null; ' +
        'END $$;',
        { transaction }
      );
      console.log('✅ ENUM type created or already exists');
      
      // Step 5: Convert column to ENUM type
      console.log('🔧 [STEP 5] Converting column to ENUM type...');
      await queryInterface.sequelize.query(
        'ALTER TABLE users ALTER COLUMN status TYPE public.enum_users_status USING status::public.enum_users_status;',
        { transaction }
      );
      console.log('✅ Column converted to ENUM type');
      
      // Step 6: Set constraints
      console.log('🔧 [STEP 6] Setting column constraints...');
      await queryInterface.sequelize.query(
        'ALTER TABLE users ALTER COLUMN status SET NOT NULL;',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE users ALTER COLUMN status SET DEFAULT \'active\';',
        { transaction }
      );
      console.log('✅ Column constraints applied');
      
      // Step 7: Verify final state
      console.log('🔍 [STEP 7] Verifying final migration state...');
      const finalColumnInfo = await queryInterface.describeTable('users');
      const finalStatusColumn = finalColumnInfo.status;
      console.log('📋 Final status column info:', JSON.stringify(finalStatusColumn, null, 2));
      
      const finalData = await queryInterface.sequelize.query(
        'SELECT DISTINCT status, COUNT(*) as count FROM users GROUP BY status ORDER BY count DESC;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      console.log('📊 Final status values in database:', finalData);
      
      // Test ENUM functionality
      await queryInterface.sequelize.query(
        'SELECT \'active\'::public.enum_users_status as test_enum;',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      console.log('✅ ENUM functionality test passed');
      
      await transaction.commit();
      console.log('🎉 [SUCCESS] Ultimate production status column migration completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [ERROR] Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [ROLLBACK] Reverting ultimate production status column migration...');
      
      // Convert back to TEXT
      await queryInterface.sequelize.query(
        'ALTER TABLE users ALTER COLUMN status TYPE TEXT;',
        { transaction }
      );
      
      // Drop ENUM type
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS public.enum_users_status;',
        { transaction }
      );
      
      await transaction.commit();
      console.log('✅ [ROLLBACK] Migration reverted successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [ROLLBACK ERROR] Failed to revert migration:', error);
      throw error;
    }
  }
};

