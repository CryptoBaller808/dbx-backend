/**
 * Database migration utility
 * Handles schema migrations for MySQL using Sequelize
 */
const Sequelize = require('sequelize');
const path = require('path');
const fs = require('fs');
const db = require('../models');

/**
 * Creates migration tables if they don't exist
 */
async function initMigrationTable() {
  try {
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS sequelize_migrations (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        run_on DATETIME NOT NULL
      );
    `);
    console.log('Migration table initialized');
  } catch (error) {
    console.error('Failed to initialize migration table:', error);
    throw error;
  }
}

/**
 * Gets list of migrations that have been run
 */
async function getRunMigrations() {
  try {
    const [results] = await db.sequelize.query(
      'SELECT name FROM sequelize_migrations ORDER BY name'
    );
    return results.map(r => r.name);
  } catch (error) {
    console.error('Failed to get run migrations:', error);
    throw error;
  }
}

/**
 * Gets list of all migration files
 */
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '../migrations');
  
  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir);
  }
  
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort();
}

/**
 * Runs pending migrations
 */
async function runMigrations() {
  try {
    await initMigrationTable();
    
    const runMigrations = await getRunMigrations();
    const migrationFiles = getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      file => !runMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }
    
    console.log(`Running ${pendingMigrations.length} migrations...`);
    
    const migrationsDir = path.join(__dirname, '../migrations');
    
    for (const file of pendingMigrations) {
      const migration = require(path.join(migrationsDir, file));
      
      console.log(`Running migration: ${file}`);
      
      const transaction = await db.sequelize.transaction();
      
      try {
        await migration.up(db.sequelize.queryInterface, Sequelize);
        
        await db.sequelize.query(
          'INSERT INTO sequelize_migrations (name, run_on) VALUES (?, ?)',
          {
            replacements: [file, new Date()],
            transaction
          }
        );
        
        await transaction.commit();
        console.log(`Migration ${file} successful`);
      } catch (error) {
        await transaction.rollback();
        console.error(`Migration ${file} failed:`, error);
        throw error;
      }
    }
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration process failed:', error);
    throw error;
  }
}

/**
 * Creates a new migration file
 */
function createMigration(name) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const fileName = `${timestamp}-${name}.js`;
  
  const migrationsDir = path.join(__dirname, '../migrations');
  
  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir);
  }
  
  const template = `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', {
     *   id: {
     *     type: Sequelize.INTEGER,
     *     primaryKey: true,
     *     autoIncrement: true
     *   },
     *   name: {
     *     type: Sequelize.STRING,
     *     allowNull: false
     *   },
     *   createdAt: {
     *     type: Sequelize.DATE,
     *     allowNull: false
     *   },
     *   updatedAt: {
     *     type: Sequelize.DATE,
     *     allowNull: false
     *   }
     * });
     */
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
`;
  
  fs.writeFileSync(path.join(migrationsDir, fileName), template);
  console.log(`Created migration file: ${fileName}`);
  
  return fileName;
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runMigrations,
  createMigration
};
