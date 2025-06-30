'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [Migration] Starting user status BOOLEAN to ENUM conversion...');
      
      // Step 1: Check if users table exists
      const tableExists = await queryInterface.showAllTables().then(tables => 
        tables.includes('users')
      );
      
      if (!tableExists) {
        console.log('⚠️ [Migration] Users table does not exist, creating it first...');
        
        // Create users table if it doesn't exist
        await queryInterface.createTable('users', {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
          },
          username: {
            type: Sequelize.STRING(50),
            allowNull: false,
            unique: true
          },
          email: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: true
          },
          password: {
            type: Sequelize.STRING(255),
            allowNull: false
          },
          status: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          }
        }, { transaction });
        
        console.log('✅ [Migration] Users table created with boolean status');
      }
      
      // Step 2: Check current status column type
      let tableDescription;
      try {
        tableDescription = await queryInterface.describeTable('users');
      } catch (error) {
        console.log('ℹ️ [Migration] Could not describe table, checking if status column exists via query...');
        
        // Alternative method to check column type
        const [columnInfo] = await queryInterface.sequelize.query(`
          SELECT column_name, data_type, udt_name, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'status';
        `, { transaction });
        
        if (columnInfo.length > 0) {
          const column = columnInfo[0];
          console.log(`📋 [Migration] Found status column: type=${column.data_type}, udt=${column.udt_name}`);
          tableDescription = { status: { type: column.data_type } };
        } else {
          console.log('⚠️ [Migration] Status column not found');
          tableDescription = {};
        }
      }
      
      const statusColumn = tableDescription.status;
      
      console.log(`📋 [Migration] Current status column type: ${statusColumn?.type || 'unknown'}`);
      
      if (statusColumn) {
        // Step 3: Drop constraints before column type change
        console.log('🔄 [Migration] Step 1: Dropping constraints...');
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
          `, { transaction });
        } catch (error) {
          console.log('ℹ️ [Migration] No DEFAULT constraint to drop');
        }
        
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;
          `, { transaction });
        } catch (error) {
          console.log('ℹ️ [Migration] No NOT NULL constraint to drop');
        }
        
        // Step 4: Convert column to TEXT with CASE statement to handle boolean values
        console.log('🔄 [Migration] Step 2: Converting boolean column to TEXT with value mapping...');
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
        
        console.log('✅ [Migration] Boolean values converted to TEXT with proper mapping');
        
        // Step 5: Pre-clean the data - Convert any remaining invalid values to valid ENUM strings
        console.log('🧼 [Migration] Step 3: Pre-cleaning data - converting any invalid values to valid ENUM strings...');
        
        // First, let's see what data we have after conversion
        const [currentData] = await queryInterface.sequelize.query(`
          SELECT "status", COUNT(*) as count 
          FROM "users" 
          GROUP BY "status" 
          ORDER BY count DESC;
        `, { transaction });
        
        if (currentData.length > 0) {
          console.log('📊 [Migration] Current status values in database:');
          currentData.forEach(row => {
            console.log(`   - "${row.status}": ${row.count} users`);
          });
        } else {
          console.log('📊 [Migration] No users found in database');
        }
        
        // Pre-clean: Convert any invalid values to 'active' as safe default
        await queryInterface.sequelize.query(`
          UPDATE "users"
          SET "status" = 'active'
          WHERE "status" NOT IN ('active', 'pending', 'suspended', 'banned', 'deleted')
             OR "status" IS NULL;
        `, { transaction });
        
        console.log('✅ [Migration] Data pre-cleaning completed');
        
        // Verify data after cleaning
        const [cleanedData] = await queryInterface.sequelize.query(`
          SELECT "status", COUNT(*) as count 
          FROM "users" 
          GROUP BY "status" 
          ORDER BY count DESC;
        `, { transaction });
        
        if (cleanedData.length > 0) {
          console.log('📊 [Migration] Status values after cleaning:');
          cleanedData.forEach(row => {
            console.log(`   - "${row.status}": ${row.count} users`);
          });
        }
        
        // Step 6: Create ENUM type safely with transaction-safe block
        console.log('🧱 [Migration] Step 4: Creating ENUM type with transaction-safe block...');
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
        
        console.log('✅ [Migration] ENUM type created or already exists');
        
        // Step 7: Verify all data is valid before conversion
        console.log('🔍 [Migration] Step 5: Verifying all data is valid for ENUM conversion...');
        const [invalidData] = await queryInterface.sequelize.query(`
          SELECT "status", COUNT(*) as count 
          FROM "users" 
          WHERE "status" NOT IN ('active', 'pending', 'suspended', 'banned', 'deleted')
          GROUP BY "status";
        `, { transaction });
        
        if (invalidData.length > 0) {
          console.log('⚠️ [Migration] Found invalid data that needs cleaning:');
          invalidData.forEach(row => {
            console.log(`   - "${row.status}": ${row.count} users`);
          });
          
          // Final cleanup - convert any remaining invalid values
          await queryInterface.sequelize.query(`
            UPDATE "users"
            SET "status" = 'active'
            WHERE "status" NOT IN ('active', 'pending', 'suspended', 'banned', 'deleted');
          `, { transaction });
          
          console.log('✅ [Migration] Final cleanup completed');
        } else {
          console.log('✅ [Migration] All data is valid for ENUM conversion');
        }
        
        // Step 8: Convert column to ENUM (only after data is confirmed valid)
        console.log('🔄 [Migration] Step 6: Converting column to ENUM...');
        await queryInterface.sequelize.query(`
          ALTER TABLE "users"
            ALTER COLUMN "status"
            TYPE "public"."enum_users_status"
            USING ("status"::"public"."enum_users_status");
        `, { transaction });
        
        console.log('✅ [Migration] Column converted to ENUM');
        
        // Step 9: Restore constraints
        console.log('🔄 [Migration] Step 7: Restoring constraints...');
        await queryInterface.sequelize.query(`
          ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';
        `, { transaction });
        
        await queryInterface.sequelize.query(`
          ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;
        `, { transaction });
        
        console.log('✅ [Migration] Constraints restored');
        
        // Step 10: Verify the migration
        console.log('🔍 [Migration] Step 8: Verifying migration...');
        const [verifyResults] = await queryInterface.sequelize.query(`
          SELECT COUNT(*) as total_users,
                 COUNT(CASE WHEN "status" = 'active' THEN 1 END) as active_users,
                 COUNT(CASE WHEN "status" = 'suspended' THEN 1 END) as suspended_users
          FROM "users";
        `, { transaction });
        
        const stats = verifyResults[0];
        console.log(`✅ [Migration] Verification: ${stats.total_users} total users, ${stats.active_users} active, ${stats.suspended_users} suspended`);
        
        // Final column check
        const [finalColumnInfo] = await queryInterface.sequelize.query(`
          SELECT column_name, data_type, udt_name, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'status';
        `, { transaction });
        
        if (finalColumnInfo.length > 0) {
          const finalColumn = finalColumnInfo[0];
          console.log(`✅ [Migration] Final column: type=${finalColumn.data_type}, udt=${finalColumn.udt_name}, default=${finalColumn.column_default}`);
        }
        
      } else {
        console.log('⚠️ [Migration] Status column not found in users table');
      }
      
      await transaction.commit();
      console.log('🎉 [Migration] User status BOOLEAN to ENUM conversion completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Failed to convert user status column:', error.message);
      console.error('❌ [Migration] Error details:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 [Migration] Reverting user status ENUM to BOOLEAN...');
      
      const tableExists = await queryInterface.showAllTables().then(tables => 
        tables.includes('users')
      );
      
      if (tableExists) {
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
        
        console.log('✅ [Migration] Successfully reverted status column to BOOLEAN');
      }
      
      await transaction.commit();
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Failed to revert status column:', error.message);
      throw error;
    }
  }
};

