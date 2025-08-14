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

/**
 * Baseline (mark as executed) legacy migrations without running them
 * @param {Object} sequelize - Sequelize instance
 * @param {Array} migrationNames - Array of migration filenames to baseline
 * @returns {Object} Baseline results
 */
async function baselineMigrations(sequelize, migrationNames = []) {
  try {
    console.log('[MIGRATION] Starting baseline process for legacy migrations...');
    
    if (!sequelize) {
      throw new Error('Sequelize instance is required');
    }
    
    if (!Array.isArray(migrationNames) || migrationNames.length === 0) {
      return {
        success: true,
        baselined: 0,
        migrations: [],
        message: 'No migrations to baseline'
      };
    }
    
    const umzug = createMigrationRunner(sequelize);
    
    // Get current executed migrations to avoid duplicates
    const executed = await umzug.executed();
    const executedNames = executed.map(m => m.name);
    
    // Filter out already executed migrations
    const toBaseline = migrationNames.filter(name => !executedNames.includes(name));
    
    if (toBaseline.length === 0) {
      console.log('[MIGRATION] All specified migrations are already executed');
      return {
        success: true,
        baselined: 0,
        migrations: [],
        message: 'All specified migrations already executed'
      };
    }
    
    console.log(`[MIGRATION] Baselining ${toBaseline.length} legacy migrations:`, toBaseline);
    
    // Insert migration records directly into SequelizeMeta table
    const baselinePromises = toBaseline.map(async (migrationName) => {
      try {
        await sequelize.query(`
          INSERT INTO "SequelizeMeta" (name) 
          VALUES (:migrationName)
          ON CONFLICT (name) DO NOTHING;
        `, {
          replacements: { migrationName },
          type: sequelize.QueryTypes.INSERT
        });
        
        console.log(`[MIGRATION] Baselined: ${migrationName}`);
        return { name: migrationName, success: true };
        
      } catch (error) {
        console.error(`[MIGRATION] Failed to baseline ${migrationName}:`, error.message);
        return { name: migrationName, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(baselinePromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`[MIGRATION] Baseline complete: ${successful.length} successful, ${failed.length} failed`);
    
    return {
      success: failed.length === 0,
      baselined: successful.length,
      migrations: successful.map(r => r.name),
      failed: failed.length > 0 ? failed : undefined,
      message: `Baselined ${successful.length} legacy migrations`
    };
    
  } catch (error) {
    console.error('[MIGRATION] Baseline process failed:', error.message);
    return {
      success: false,
      baselined: 0,
      migrations: [],
      error: error.message
    };
  }
}

/**
 * Baseline legacy migrations and run allowlisted ones
 * @param {Object} sequelize - Sequelize instance
 * @param {Array} allowlist - Array of migration filenames to execute
 * @returns {Object} Combined baseline and execution results
 */
async function baselineAndRunAllowlist(sequelize, { allowlist = [] } = {}) {
  try {
    console.log('[MIGRATION] Starting baseline + allowlist execution...');
    
    if (!sequelize) {
      throw new Error('Sequelize instance is required');
    }
    
    if (!Array.isArray(allowlist)) {
      throw new Error('Allowlist must be an array');
    }
    
    const umzug = createMigrationRunner(sequelize);
    
    // Get all pending migrations
    const pending = await umzug.pending();
    const pendingNames = pending.map(m => m.name);
    
    console.log(`[MIGRATION] Found ${pendingNames.length} pending migrations`);
    console.log(`[MIGRATION] Allowlist contains ${allowlist.length} migrations`);
    
    // Split pending migrations into allowlist and legacy
    const allowlistMigrations = pendingNames.filter(name => allowlist.includes(name));
    const legacyMigrations = pendingNames.filter(name => !allowlist.includes(name));
    
    console.log(`[MIGRATION] Allowlist migrations to execute: ${allowlistMigrations.length}`, allowlistMigrations);
    console.log(`[MIGRATION] Legacy migrations to baseline: ${legacyMigrations.length}`, legacyMigrations);
    
    // Baseline legacy migrations first
    const baselineResult = await baselineMigrations(sequelize, legacyMigrations);
    
    // Execute allowlisted migrations
    let executionResult = {
      success: true,
      executed: 0,
      migrations: [],
      errors: []
    };
    
    if (allowlistMigrations.length > 0) {
      console.log('[MIGRATION] Executing allowlisted migrations...');
      
      for (const migrationName of allowlistMigrations) {
        try {
          console.log(`[MIGRATION] Executing: ${migrationName}`);
          
          // Execute single migration
          await umzug.up({ migrations: [migrationName] });
          
          executionResult.executed++;
          executionResult.migrations.push(migrationName);
          
          console.log(`[MIGRATION] ✅ Successfully executed: ${migrationName}`);
          
        } catch (error) {
          console.error(`[MIGRATION] ❌ Failed to execute ${migrationName}:`, error.message);
          console.error('[MIGRATION] Stack trace:', error.stack);
          
          executionResult.success = false;
          executionResult.errors.push({
            migration: migrationName,
            error: error.message,
            stack: error.stack
          });
          
          // Continue with other migrations even if one fails
        }
      }
    }
    
    // Combine results
    const combinedResult = {
      success: baselineResult.success && executionResult.success,
      baselined: baselineResult.baselined,
      executed: executionResult.executed,
      files: {
        baselined: baselineResult.migrations,
        executed: executionResult.migrations
      },
      summary: {
        totalPending: pendingNames.length,
        baselined: baselineResult.baselined,
        executed: executionResult.executed,
        errors: executionResult.errors.length
      }
    };
    
    if (executionResult.errors.length > 0) {
      combinedResult.errors = executionResult.errors;
    }
    
    console.log('[MIGRATION] Baseline + allowlist execution complete:', combinedResult.summary);
    
    return combinedResult;
    
  } catch (error) {
    console.error('[MIGRATION] Baseline + allowlist execution failed:', error.message);
    console.error('[MIGRATION] Stack trace:', error.stack);
    
    return {
      success: false,
      baselined: 0,
      executed: 0,
      files: { baselined: [], executed: [] },
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Run migrations on boot if environment variable is set
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Migration results or null if not enabled
 */
async function runOnBootIfEnv(sequelize) {
  try {
    // Check if boot migrations are enabled
    if (process.env.RUN_MIGRATIONS_ON_BOOT !== 'true') {
      console.log('[MIGRATION] Boot migrations disabled (RUN_MIGRATIONS_ON_BOOT != true)');
      return null;
    }
    
    console.log('[MIGRATION] Boot migrations enabled, starting process...');
    
    // Parse allowlist from environment
    const allowlistEnv = process.env.MIGRATION_ALLOWLIST || '';
    const allowlist = allowlistEnv
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    console.log('[MIGRATION] Environment allowlist:', allowlist);
    
    if (allowlist.length === 0) {
      console.warn('[MIGRATION] No migrations in MIGRATION_ALLOWLIST, running all pending migrations');
      return await migrateOnBoot(sequelize);
    }
    
    // Run baseline + allowlist process
    const result = await baselineAndRunAllowlist(sequelize, { allowlist });
    
    // Log clear summary as requested
    console.log(`[MIGRATIONS] baselined:${result.baselined} executed:${result.executed} files:[${result.files.executed.join(', ')}]`);
    
    return result;
    
  } catch (error) {
    console.error('[MIGRATION] Boot migration process failed:', error.message);
    console.error('[MIGRATION] Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

module.exports = {
  migrateOnBoot,
  getMigrationStatus,
  createMigrationRunner,
  baselineMigrations,
  baselineAndRunAllowlist,
  runOnBootIfEnv
};

