'use strict';

/**
 * Migration: Create blockchains table
 * 
 * This migration creates the blockchains table required for UBAL
 * (Unified Blockchain Abstraction Layer) configuration.
 * 
 * Uses snake_case column names following PostgreSQL best practices.
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
        chain_id: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
          comment: 'Unique chain identifier for UBAL (e.g., "xrpl", "stellar")',
        },
        node_url: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'RPC node URL - loaded from env vars at runtime',
        },
        explorer_url: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Block explorer URL',
        },
        native_currency: {
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
        adapter_type: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: 'Adapter type: "account", "evm", "utxo"',
        },
        is_active: {
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
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      // Create index on chain_id for faster lookups
      await queryInterface.addIndex('blockchains', ['chain_id'], {
        unique: true,
        name: 'blockchains_chain_id_unique',
      });

      // Create index on is_active for filtering
      await queryInterface.addIndex('blockchains', ['is_active'], {
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
