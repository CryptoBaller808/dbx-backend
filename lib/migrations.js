/**
 * Programmatic Migration Runner
 * Safely runs pending migrations on boot using Umzug
 */

const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');

/**
 * Initialize Umzug migration runner
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Umzug instance
 */
function createMigrationRunner(sequelize) {
  // Resolve migrations directory path for production compatibility
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');
  const globPattern = path.join(migrationsDir, '*.js');
  
  // Enhanced logging for debugging path resolution
  console.log('[MIGRATION] Umzug configuration:');
  console.log('[MIGRATION] __dirname:', __dirname);
  console.log('[MIGRATION] Migrations directory:', migrationsDir);
  console.log('[MIGRATION] Glob pattern:', globPattern);
  
  // Verify migrations directory exists
  const fs = require('fs');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js'));
    console.log(`[MIGRATION] Found ${migrationFiles.length} migration files:`, migrationFiles);
  } else {
    console.warn('[MIGRATION] Migrations directory does not exist:', migrationsDir);
  }
  
  return new Umzug({
    migrations: {
      glob: globPattern,
      resolve: ({ name, path: migrationPath }) => {
        console.log(`[MIGRATION] Loading migration: ${name} from ${migrationPath}`);
        const migration = require(migrationPath);
        return {
          name,
          up: async () => migration.up(sequelize.getQueryInterface(), sequelize.constructor),
          down: async () => migration.down(sequelize.getQueryInterface(), sequelize.constructor),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: {
      info: (message) => console.log(`[MIGRATION] ${message}`),
      warn: (message) => console.warn(`[MIGRATION] ${message}`),
      error: (message) => console.error(`[MIGRATION] ${message}`),
    },
  });
}

/**
 * Run pending migrations on boot
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Migration results
 */
async function migrateOnBoot(sequelize) {
  try {
    console.log('[MIGRATION] Starting boot migration check...');
    
    if (!sequelize) {
      throw new Error('Sequelize instance is required');
    }

    const umzug = createMigrationRunner(sequelize);
    
    // Get pending migrations
    const pending = await umzug.pending();
    console.log(`[MIGRATION] Found ${pending.length} pending migrations`);
    
    if (pending.length === 0) {
      console.log('[MIGRATION] No pending migrations to run');
      return { ran: 0, migrations: [] };
    }
    
    // Run pending migrations
    console.log('[MIGRATION] Running pending migrations...');
    const executed = await umzug.up();
    
    const migrationNames = executed.map(m => m.name);
    console.log(`[MIGRATION] Successfully ran ${executed.length} migrations:`, migrationNames);
    
    return {
      ran: executed.length,
      migrations: migrationNames,
      success: true
    };
    
  } catch (error) {
    console.error('[MIGRATION] Boot migration failed:', error.message);
    
    // Don't crash the server - log error and continue
    return {
      ran: 0,
      migrations: [],
      success: false,
      error: error.message
    };
  }
}

/**
 * Get migration status
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Migration status
 */
async function getMigrationStatus(sequelize) {
  try {
    if (!sequelize) {
      return { error: 'Sequelize instance not available' };
    }

    // Get path information for debugging
    const migrationsDir = path.resolve(__dirname, '..', 'migrations');
    const globPattern = path.join(migrationsDir, '*.js');
    
    const umzug = createMigrationRunner(sequelize);
    
    const [executed, pending] = await Promise.all([
      umzug.executed(),
      umzug.pending()
    ]);
    
    return {
      executed: executed.length,
      pending: pending.length,
      executedMigrations: executed.map(m => m.name),
      pendingMigrations: pending.map(m => m.name),
      paths: {
        migrationsDirectory: migrationsDir,
        globPattern: globPattern,
        __dirname: __dirname
      }
    };
    
  } catch (error) {
    console.error('[MIGRATION] Failed to get migration status:', error.message);
    return { error: error.message };
  }
}

module.exports = {
  migrateOnBoot,
  getMigrationStatus,
  createMigrationRunner
};

