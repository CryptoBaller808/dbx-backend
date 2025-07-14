'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        -- Check if the enum type exists, if not create it
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_nft_bridge_transactions_status'
        ) THEN
          CREATE TYPE enum_nft_bridge_transactions_status AS ENUM (
            'INITIATED', 'BURNING', 'BURNED', 'MINTING', 'COMPLETED', 'FAILED', 'CANCELLED'
          );
        END IF;
        
        -- Add BURN_COMPLETED if it doesn't exist
        BEGIN
          ALTER TYPE enum_nft_bridge_transactions_status ADD VALUE IF NOT EXISTS 'BURN_COMPLETED';
        EXCEPTION WHEN duplicate_object THEN 
          NULL; -- Value already exists, ignore
        END;
        
        -- Add VERIFYING if it doesn't exist
        BEGIN
          ALTER TYPE enum_nft_bridge_transactions_status ADD VALUE IF NOT EXISTS 'VERIFYING';
        EXCEPTION WHEN duplicate_object THEN 
          NULL; -- Value already exists, ignore
        END;
        
      END$$;
    `);
    
    console.log('✅ Added BURN_COMPLETED and VERIFYING to enum_nft_bridge_transactions_status');
  },

  down: async (queryInterface, Sequelize) => {
    // PostgreSQL doesn't support removing enum values safely
    // This would require recreating the enum type and updating all references
    console.log('⚠️  Cannot safely remove enum values in PostgreSQL');
    return Promise.resolve();
  }
};

