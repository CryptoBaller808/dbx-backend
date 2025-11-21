#!/usr/bin/env node
/**
 * Reset Blockchains Table
 * 
 * This script drops and recreates the blockchains table to apply
 * the snake_case column naming changes.
 * 
 * Usage: node scripts/reset-blockchains-table.js
 */

const { Sequelize } = require('sequelize');

async function resetBlockchainsTable() {
  console.log('🔄 [Reset Blockchains] Starting table reset...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ [Reset Blockchains] DATABASE_URL not set');
    process.exit(1);
  }
  
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  });
  
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ [Reset Blockchains] Database connection established');
    
    // Drop the blockchains table if it exists
    console.log('🗑️ [Reset Blockchains] Dropping blockchains table...');
    await sequelize.query('DROP TABLE IF EXISTS blockchains CASCADE');
    console.log('✅ [Reset Blockchains] Table dropped successfully');
    
    // Close connection
    await sequelize.close();
    console.log('✅ [Reset Blockchains] Reset complete');
    
  } catch (error) {
    console.error('❌ [Reset Blockchains] Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

resetBlockchainsTable();
