'use strict';

/**
 * Migration: Create blockchains table
 * 
 * This migration creates the blockchains table required for UBAL
 * (Unified Blockchain Abstraction Layer) configuration.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔗 [Blockchains] Creating blockchains table...');
    
    try {
      // Check if table already exists
      const tables = await queryInterface.showAllTables();
      if (tables.includes('blockchains')) {
        console.log('⚠️ [Blockchains] Table already exists, skipping creation');
        return;
      }

      await queryInterface.createTable('blockchains', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Human-readable blockchain name (e.g., "XRP Ledger")',
        },
        symbol: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Blockchain native currency symbol (e.g., "XRP")',
        },
        chainId: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
          comment: 'Unique chain identifier for UBAL (e.g., "xrpl", "stellar")',
        },
        nodeUrl: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'RPC node URL - loaded from env vars at runtime',
        },
        explorerUrl: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Block explorer URL',
        },
        nativeCurrency: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Native currency name',
        },
        decimals: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 18,
          comment: 'Native currency decimal places',
        },
        adapterType: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Adapter type: "account", "evm", "utxo"',
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether this blockchain is active',
        },
        config: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Additional blockchain-specific configuration',
        },
        logo: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Logo URL or path',
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          field: 'created_at',
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          field: 'updated_at',
        },
      });

      // Create index on chainId for faster lookups
      await queryInterface.addIndex('blockchains', ['chainId'], {
        unique: true,
        name: 'blockchains_chain_id_unique',
      });

      // Create index on isActive for filtering
      await queryInterface.addIndex('blockchains', ['isActive'], {
        name: 'blockchains_is_active_idx',
      });

      console.log('✅ [Blockchains] Table created successfully');
      
    } catch (error) {
      console.error('❌ [Blockchains] Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [Blockchains] Rolling back blockchains table...');
    
    try {
      await queryInterface.dropTable('blockchains');
      console.log('✅ [Blockchains] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Blockchains] Rollback failed:', error);
      throw error;
    }
  }
};
