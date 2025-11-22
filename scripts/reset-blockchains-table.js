#!/usr/bin/env node
/**
 * Reset Blockchains Table
 * 
 * This script drops and recreates the blockchains table to apply
 * the snake_case column naming changes.
 * 
 * Also clears the migration tracking so the migration runs again.
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
    
    // Remove migration tracking entry so migration runs again
    console.log('🗑️ [Reset Blockchains] Clearing migration tracking...');
    await sequelize.query(
      `DELETE FROM "SequelizeMeta" WHERE name = '20251120000000-create-blockchains-table.js'`
    );
    console.log('✅ [Reset Blockchains] Migration tracking cleared');
    
    // Close connection
    await sequelize.close();
    console.log('✅ [Reset Blockchains] Reset complete - migration will run on next startup');
    
  } catch (error) {
    console.error('❌ [Reset Blockchains] Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

resetBlockchainsTable();
