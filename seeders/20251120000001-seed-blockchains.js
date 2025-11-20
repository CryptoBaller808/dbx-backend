'use strict';

/**
 * Seeder: Seed blockchains
 * 
 * Seeds the blockchains table with the 4 supported blockchains:
 * - XRP Ledger
 * - Stellar
 * - XDC
 * - Bitcoin
 * 
 * This seeder is idempotent - safe to run multiple times.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🌱 [Blockchains Seeder] Seeding blockchains...');
    
    try {
      // Check if table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('blockchains')) {
        console.log('⚠️ [Blockchains Seeder] Table does not exist, skipping seed');
        return;
      }

      // Define the 4 blockchains to seed
      const blockchains = [
        {
          name: 'XRP Ledger',
          symbol: 'XRP',
          chainId: 'xrpl',
          nodeUrl: null, // Will be loaded from UBAL_XRP_RPC_URL env var
          explorerUrl: 'https://livenet.xrpl.org',
          nativeCurrency: 'XRP',
          decimals: 6,
          adapterType: 'account',
          isActive: true,
          config: JSON.stringify({
            networkType: 'account-based',
            supportsSmartContracts: false,
            consensusMechanism: 'federated',
          }),
          logo: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'Stellar',
          symbol: 'XLM',
          chainId: 'stellar',
          nodeUrl: null, // Will be loaded from UBAL_XLM_RPC_URL env var
          explorerUrl: 'https://stellarchain.io',
          nativeCurrency: 'XLM',
          decimals: 7,
          adapterType: 'account',
          isActive: true,
          config: JSON.stringify({
            networkType: 'account-based',
            supportsSmartContracts: true,
            consensusMechanism: 'federated',
          }),
          logo: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'XDC',
          symbol: 'XDC',
          chainId: 'xdc',
          nodeUrl: null, // Will be loaded from UBAL_XDC_RPC_URL env var
          explorerUrl: 'https://explorer.xinfin.network',
          nativeCurrency: 'XDC',
          decimals: 18,
          adapterType: 'evm',
          isActive: true,
          config: JSON.stringify({
            networkType: 'evm',
            supportsSmartContracts: true,
            consensusMechanism: 'xdpos',
          }),
          logo: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'Bitcoin',
          symbol: 'BTC',
          chainId: 'bitcoin',
          nodeUrl: null, // Will be loaded from UBAL_BTC_RPC_URL env var
          explorerUrl: 'https://blockchair.com/bitcoin',
          nativeCurrency: 'BTC',
          decimals: 8,
          adapterType: 'utxo',
          isActive: true,
          config: JSON.stringify({
            networkType: 'utxo',
            supportsSmartContracts: false,
            consensusMechanism: 'proof-of-work',
          }),
          logo: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      // Use bulkInsert with updateOnDuplicate for idempotency
      // This will insert new records or update existing ones based on chainId
      for (const blockchain of blockchains) {
        const [results] = await queryInterface.sequelize.query(
          `INSERT INTO blockchains (name, symbol, "chainId", "nodeUrl", "explorerUrl", "nativeCurrency", decimals, "adapterType", "isActive", config, logo, created_at, updated_at)
           VALUES (:name, :symbol, :chainId, :nodeUrl, :explorerUrl, :nativeCurrency, :decimals, :adapterType, :isActive, :config::jsonb, :logo, :created_at, :updated_at)
           ON CONFLICT ("chainId") DO UPDATE SET
             name = EXCLUDED.name,
             symbol = EXCLUDED.symbol,
             "explorerUrl" = EXCLUDED."explorerUrl",
             "nativeCurrency" = EXCLUDED."nativeCurrency",
             decimals = EXCLUDED.decimals,
             "adapterType" = EXCLUDED."adapterType",
             config = EXCLUDED.config,
             updated_at = EXCLUDED.updated_at
           RETURNING *`,
          {
            replacements: blockchain,
            type: Sequelize.QueryTypes.INSERT,
          }
        );
        
        console.log(`✅ [Blockchains Seeder] Seeded/updated: ${blockchain.name} (${blockchain.chainId})`);
      }

      console.log('✅ [Blockchains Seeder] All blockchains seeded successfully');
      
    } catch (error) {
      console.error('❌ [Blockchains Seeder] Seeding failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [Blockchains Seeder] Rolling back blockchain seeds...');
    
    try {
      // Delete only the 4 blockchains we seeded
      await queryInterface.bulkDelete('blockchains', {
        chainId: {
          [Sequelize.Op.in]: ['xrpl', 'stellar', 'xdc', 'bitcoin']
        }
      }, {});
      
      console.log('✅ [Blockchains Seeder] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Blockchains Seeder] Rollback failed:', error);
      throw error;
    }
  }
};
