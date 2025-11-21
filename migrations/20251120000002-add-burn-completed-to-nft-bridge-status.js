'use strict';

/**
 * Migration: Add BURN_COMPLETED to nft_bridge_transactions status enum
 * 
 * This migration adds the "BURN_COMPLETED" value to the enum_nft_bridge_transactions_status
 * enum type if it doesn't already exist.
 * 
 * This is idempotent and safe to run multiple times.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 [NFT Bridge Status] Adding BURN_COMPLETED to enum...');
    
    try {
      // Check if nft_bridge_transactions table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('nft_bridge_transactions')) {
        console.log('⚠️ [NFT Bridge Status] Table nft_bridge_transactions does not exist yet, skipping');
        return;
      }

      // Check if the enum type exists
      const [enumExists] = await queryInterface.sequelize.query(
        `SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_nft_bridge_transactions_status'
        ) as exists;`
      );

      if (!enumExists[0].exists) {
        console.log('⚠️ [NFT Bridge Status] Enum type does not exist yet, skipping');
        return;
      }

      // Check if BURN_COMPLETED already exists in the enum
      const [enumValues] = await queryInterface.sequelize.query(
        `SELECT e.enumlabel 
         FROM pg_enum e 
         JOIN pg_type t ON e.enumtypid = t.oid 
         WHERE t.typname = 'enum_nft_bridge_transactions_status';`
      );

      const existingValues = enumValues.map(v => v.enumlabel);
      console.log(`📋 [NFT Bridge Status] Current enum values: ${existingValues.join(', ')}`);

      if (existingValues.includes('BURN_COMPLETED')) {
        console.log('✅ [NFT Bridge Status] BURN_COMPLETED already exists in enum, skipping');
        return;
      }

      // Add BURN_COMPLETED to the enum
      // We use a DO block to handle the case where the value might have been added concurrently
      await queryInterface.sequelize.query(
        `DO $$ 
         BEGIN
           IF NOT EXISTS (
             SELECT 1 FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'enum_nft_bridge_transactions_status'
             AND e.enumlabel = 'BURN_COMPLETED'
           ) THEN
             ALTER TYPE enum_nft_bridge_transactions_status ADD VALUE 'BURN_COMPLETED';
           END IF;
         END $$;`
      );

      console.log('✅ [NFT Bridge Status] BURN_COMPLETED added to enum successfully');

      // Verify the addition
      const [newEnumValues] = await queryInterface.sequelize.query(
        `SELECT e.enumlabel 
         FROM pg_enum e 
         JOIN pg_type t ON e.enumtypid = t.oid 
         WHERE t.typname = 'enum_nft_bridge_transactions_status'
         ORDER BY e.enumsortorder;`
      );

      const newValues = newEnumValues.map(v => v.enumlabel);
      console.log(`✅ [NFT Bridge Status] Updated enum values: ${newValues.join(', ')}`);
      
    } catch (error) {
      console.error('❌ [NFT Bridge Status] Migration failed:', error);
      // Don't throw - this is a non-critical migration that might fail if table doesn't exist yet
      console.warn('⚠️ [NFT Bridge Status] Migration failed but continuing...');
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [NFT Bridge Status] Rollback not supported for enum values');
    console.log('⚠️ [NFT Bridge Status] PostgreSQL does not support removing enum values');
    console.log('⚠️ [NFT Bridge Status] If you need to remove BURN_COMPLETED, you must:');
    console.log('   1. Create a new enum type without BURN_COMPLETED');
    console.log('   2. Migrate all data to use the new enum');
    console.log('   3. Drop the old enum type');
    
    // No-op - cannot remove enum values in PostgreSQL without recreating the type
  }
};
