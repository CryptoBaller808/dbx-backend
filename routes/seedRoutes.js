/**
 * Seed Management Routes
 * HTTP endpoints for checking and running database seeding
 */

const express = require('express');
const router = express.Router();
const { runSeed, checkSeedStatus } = require('../lib/seeding');
const { getMigrationStatus, migrateOnBoot, baselineMigrations, baselineAndRunAllowlist } = require('../lib/migrations');

/**
 * Create verbose error response when SEED_DEBUG=1 is set
 * @param {Error} error - The error object
 * @param {string} where - Function or file where error occurred
 * @param {Object} context - Additional context (e.g., schema info)
 * @returns {Object} Verbose error object
 */
function createVerboseError(error, where, context = {}) {
  const DEBUG = coerceBool(process.env.SEED_DEBUG);
  
  if (!DEBUG) {
    // Return generic error when SEED_DEBUG is not enabled
    return {
      success: false,
      message: "Server error",
      error: "Internal server error",
      timestamp: new Date().toISOString()
    };
  }
  
  const verboseError = {
    success: false,
    message: "Server error",
    error: {
      name: error.name || 'UnknownError',
      message: error.message || 'No error message',
      code: error.code || null,
      sql: error.parent?.sql || error.sql || null,
      parameters: error.parent?.parameters || null,
      detail: error.parent?.detail || null,
      schema: error.parent?.schema || null,
      table: error.parent?.table || null,
      constraint: error.parent?.constraint || null,
      stackTop: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : null
    },
    where: where || 'unknown',
    ts: new Date().toISOString()
  };
  
  // Add dynamic schema probe context if available
  if (context.availableColumns) {
    verboseError.schemaInfo = {
      availableColumns: context.availableColumns,
      requiredNoDefault: context.requiredNoDefault,
      columnMapping: context.columnMapping
    };
  }
  
  // Generate request ID for tracking
  const requestId = require('crypto').randomBytes(8).toString('hex');
  verboseError.requestId = requestId;
  
  // Log to Railway logs for debugging
  console.error(`[MIGRATION-ERROR] RequestID: ${requestId}`, JSON.stringify(verboseError, null, 2));
  
  return verboseError;
}

/**
 * Check if verbose error mode is enabled
 * @returns {boolean} True if SEED_DEBUG=1 is set
 */
function isVerboseMode() {
  return coerceBool(process.env.SEED_DEBUG);
}

/**
 * Coerce environment variable to boolean
 * @param {string} value - Environment variable value
 * @returns {boolean} True if value is truthy
 */
function coerceBool(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

/**
 * @route GET /admindashboard/auth/diag/version
 * @desc Get version information including commit SHA and branch
 * @access Public (for deployment verification)
 */
router.get('/auth/diag/version', async (req, res) => {
  try {
    const versionInfo = {
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "unknown",
      branch: process.env.RAILWAY_GIT_BRANCH || process.env.GIT_BRANCH || "unknown",
      builtAt: new Date().toISOString()
    };
    
    console.log('[VERSION] Version info requested:', versionInfo);
    
    res.json(versionInfo);
    
  } catch (error) {
    console.error('[VERSION] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get version information',
      details: error.message
    });
  }
});

/**
 * @route GET /admindashboard/auth/diagnostics
 * @desc Comprehensive diagnostics and file discovery (requires secret key)
 * @access Protected (requires SEED_WEB_KEY)
 */
router.get('/auth/diagnostics', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    
    // Check for secret key
    const providedKey = req.query.key || req.headers['x-seed-key'];
    const requiredKey = process.env.SEED_WEB_KEY;
    
    if (!requiredKey) {
      return res.status(503).json({
        success: false,
        error: 'Diagnostics endpoint not configured (SEED_WEB_KEY not set)'
      });
    }
    
    if (!providedKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key required (provide ?key=... or x-seed-key header)'
      });
    }
    
    if (providedKey !== requiredKey) {
      console.warn('[DIAGNOSTICS] Invalid key attempt from:', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid secret key'
      });
    }
    
    // Environment variables check (return booleans only, no values)
    const envCheck = {
      JWT_SECRET: !!process.env.JWT_SECRET,
      SEED_ADMIN_EMAIL: !!process.env.SEED_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: !!process.env.SEED_ADMIN_PASSWORD,
      SEED_WEB_KEY: !!process.env.SEED_WEB_KEY,
      RUN_MIGRATIONS_ON_BOOT: process.env.RUN_MIGRATIONS_ON_BOOT || '',
      RUN_SEEDS_ON_BOOT: process.env.RUN_SEEDS_ON_BOOT || ''
    };
    
    // File discovery
    const migrationsDirectory = path.resolve(__dirname, '..', 'migrations');
    const libDirectory = path.resolve(__dirname, '..', 'lib');
    
    let migrationFiles = [];
    let libFiles = [];
    let migrationsDirExists = false;
    let libDirExists = false;
    
    try {
      migrationsDirExists = fs.existsSync(migrationsDirectory);
      if (migrationsDirExists) {
        migrationFiles = fs.readdirSync(migrationsDirectory).filter(f => f.endsWith('.js')).sort();
      }
    } catch (err) {
      console.warn('[DIAGNOSTICS] Error reading migrations directory:', err.message);
    }
    
    try {
      libDirExists = fs.existsSync(libDirectory);
      if (libDirExists) {
        libFiles = fs.readdirSync(libDirectory).filter(f => f.endsWith('.js')).sort();
      }
    } catch (err) {
      console.warn('[DIAGNOSTICS] Error reading lib directory:', err.message);
    }
    
    // Database connection check
    let dbConnected = false;
    let dbError = null;
    try {
      const { sequelize } = require('../models');
      if (sequelize) {
        await sequelize.authenticate();
        dbConnected = true;
      }
    } catch (err) {
      dbError = err.message;
    }
    
    console.log('[DIAGNOSTICS] Comprehensive diagnostics completed');
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      paths: {
        migrationsDirectory,
        libDirectory,
        migrationsDirExists,
        libDirExists
      },
      files: {
        migrations: migrationFiles,
        lib: libFiles
      },
      database: {
        connected: dbConnected,
        error: dbError
      },
      recommendation: 'Remove SEED_WEB_KEY after successful setup'
    });
    
  } catch (error) {
    console.error('[DIAGNOSTICS] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to run diagnostics',
      details: error.message
    });
  }
});

/**
 * @route GET /admindashboard/auth/env-check
 * @desc Check environment variables (requires secret key)
 * @access Protected (requires SEED_WEB_KEY)
 */
router.get('/auth/env-check', async (req, res) => {
  try {
    // Check for secret key
    const providedKey = req.query.key || req.headers['x-seed-key'];
    const requiredKey = process.env.SEED_WEB_KEY;
    
    if (!requiredKey) {
      return res.status(503).json({
        success: false,
        error: 'Environment check endpoint not configured (SEED_WEB_KEY not set)'
      });
    }
    
    if (!providedKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key required (provide ?key=... or x-seed-key header)'
      });
    }
    
    if (providedKey !== requiredKey) {
      console.warn('[ENV-CHECK] Invalid key attempt from:', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid secret key'
      });
    }
    
    // Check environment variables (return booleans only, no values)
    const envCheck = {
      JWT_SECRET: !!process.env.JWT_SECRET,
      SEED_ADMIN_EMAIL: !!process.env.SEED_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: !!process.env.SEED_ADMIN_PASSWORD,
      SEED_WEB_KEY: !!process.env.SEED_WEB_KEY,
      RUN_MIGRATIONS_ON_BOOT: process.env.RUN_MIGRATIONS_ON_BOOT || '',
      RUN_SEEDS_ON_BOOT: process.env.RUN_SEEDS_ON_BOOT || '',
      SEED_DEBUG: coerceBool(process.env.SEED_DEBUG),
      SEED_ADMIN_NAME: !!process.env.SEED_ADMIN_NAME,
      SEED_ADMIN_USERNAME: !!process.env.SEED_ADMIN_USERNAME
    };
    
    console.log('[ENV-CHECK] Environment variables checked');
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      recommendation: 'Remove SEED_WEB_KEY after successful setup'
    });
    
  } catch (error) {
    console.error('[ENV-CHECK] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check environment variables'
    });
  }
});

/**
 * @route GET /admindashboard/auth/seed-check
 * @desc Check seeding status (roles and admin user existence)
 * @access Public (for deployment verification)
 */
router.get('/auth/seed-check', async (req, res) => {
  try {
    const { sequelize } = require('../models');
    
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
        details: 'Sequelize instance not found'
      });
    }
    
    // Test database connection first
    try {
      await sequelize.authenticate();
    } catch (dbError) {
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message
      });
    }
    
    // Get seeding status with enhanced error handling
    let seedStatus;
    try {
      seedStatus = await checkSeedStatus(sequelize);
    } catch (seedError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to check seed status',
        details: seedError.message
      });
    }
    
    if (seedStatus.error) {
      return res.status(500).json({
        success: false,
        error: 'Seed status check failed',
        details: seedStatus.error
      });
    }
    
    // Get migration status for additional context
    let migrationStatus;
    try {
      migrationStatus = await getMigrationStatus(sequelize);
    } catch (migrationError) {
      console.warn('[SEED-CHECK] Migration status check failed:', migrationError.message);
      migrationStatus = { error: migrationError.message };
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      seeding: {
        roles: seedStatus.roles,
        adminPresent: seedStatus.adminPresent,
        adminInfo: seedStatus.adminInfo,
        ready: seedStatus.ready
      },
      migrations: {
        executed: migrationStatus.executed || 0,
        pending: migrationStatus.pending || 0,
        error: migrationStatus.error || null
      }
    });
    
  } catch (error) {
    console.error('[SEED-CHECK] Unexpected error:', error.name, error.message);
    console.error('[SEED-CHECK] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Unexpected error during seed check',
      details: `${error.name}: ${error.message}`
    });
  }
});

/**
 * @route POST /admindashboard/auth/seed-run
 * @desc Run idempotent seeding process (requires secret key)
 * @access Protected (requires SEED_WEB_KEY)
 */
router.post('/auth/seed-run', async (req, res) => {
  try {
    const { sequelize } = require('../models');
    
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
        details: 'Sequelize instance not found'
      });
    }
    
    // Check for secret key
    const providedKey = req.query.key || req.headers['x-seed-key'];
    const requiredKey = process.env.SEED_WEB_KEY;
    
    if (!requiredKey) {
      return res.status(503).json({
        success: false,
        error: 'Seeding endpoint not configured (SEED_WEB_KEY not set)',
        details: 'Environment variable SEED_WEB_KEY is required'
      });
    }
    
    if (!providedKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key required (provide ?key=... or x-seed-key header)',
        details: 'Authentication required for seeding operations'
      });
    }
    
    if (providedKey !== requiredKey) {
      console.warn('[SEED-RUN] Invalid seed key attempt from:', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid secret key',
        details: 'Provided key does not match configured SEED_WEB_KEY'
      });
    }
    
    // Parse request body for dry-run option
    const { dryRun } = req.body || {};
    const isDryRun = !!dryRun;
    
    console.log('[SEED-RUN] Starting seeding process...', isDryRun ? '(DRY RUN)' : '');
    
    // Test database connection first
    try {
      await sequelize.authenticate();
      console.log('[SEED-RUN] Database connection verified');
    } catch (dbError) {
      console.error('[SEED-RUN] Database connection failed:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message
      });
    }
    
    // Check environment variables required for seeding
    const requiredEnvVars = ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required environment variables',
        details: `Required: ${missingEnvVars.join(', ')}`
      });
    }
    
    // If dry run, return configuration check without executing
    if (isDryRun) {
      console.log('[SEED-RUN] Dry run mode - checking configuration only');
      
      // Get current seed status
      let seedStatus;
      try {
        seedStatus = await checkSeedStatus(sequelize);
      } catch (seedError) {
        return res.status(500).json({
          success: false,
          error: 'Failed to check current seed status',
          details: seedError.message
        });
      }
      
      return res.json({
        success: true,
        dryRun: true,
        timestamp: new Date().toISOString(),
        configuration: {
          environmentVariables: {
            SEED_ADMIN_EMAIL: !!process.env.SEED_ADMIN_EMAIL,
            SEED_ADMIN_PASSWORD: !!process.env.SEED_ADMIN_PASSWORD,
            JWT_SECRET: !!process.env.JWT_SECRET
          },
          currentStatus: {
            roles: seedStatus.roles,
            adminPresent: seedStatus.adminPresent,
            ready: seedStatus.ready
          }
        },
        recommendation: 'Set dryRun: false to execute seeding'
      });
    }
    
    // Run seeding process
    let seedResult;
    try {
      seedResult = await runSeed(sequelize);
    } catch (seedError) {
      console.error('[SEED-RUN] Seeding process failed:', seedError.message);
      return res.status(500).json({
        success: false,
        error: 'Seeding process failed',
        details: seedError.message
      });
    }
    
    if (seedResult.success) {
      console.log('[SEED-RUN] Seeding completed successfully');
      console.log('[SEED-RUN] SECURITY: Consider removing SEED_WEB_KEY environment variable');
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        summary: seedResult.summary,
        details: {
          roles: seedResult.roles,
          admin: seedResult.admin
        },
        recommendation: 'Remove SEED_WEB_KEY environment variable for security'
      });
    } else {
      console.error('[SEED-RUN] Seeding failed:', seedResult.error);
      
      res.status(500).json({
        success: false,
        error: 'Seeding process failed',
        details: seedResult.summary || seedResult.error
      });
    }
    
  } catch (error) {
    console.error('[SEED-RUN] Unexpected error:', error.name, error.message);
    console.error('[SEED-RUN] Stack trace:', error.stack);
    
    // Use enhanced verbose error function
    const verboseError = createVerboseError(error, 'seed-run');
    return res.status(500).json(verboseError);
  }
});

/**
 * @route GET /admindashboard/auth/migration-status
 * @desc Get migration status for debugging
 * @access Public (for deployment verification)
 */
router.get('/auth/migration-status', async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const path = require('path');
    const fs = require('fs');
    
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available',
        details: 'Sequelize instance not found'
      });
    }
    
    // Test database connection first
    try {
      await sequelize.authenticate();
    } catch (dbError) {
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message
      });
    }
    
    // Get migration status with enhanced error handling
    let migrationStatus;
    try {
      migrationStatus = await getMigrationStatus(sequelize);
    } catch (migrationError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get migration status',
        details: migrationError.message
      });
    }
    
    if (migrationStatus.error) {
      return res.status(500).json({
        success: false,
        error: 'Migration status check failed',
        details: migrationStatus.error
      });
    }
    
    // Add file discovery information
    const migrationsDirectory = path.resolve(__dirname, '..', 'migrations');
    let availableFiles = [];
    let directoryExists = false;
    
    try {
      directoryExists = fs.existsSync(migrationsDirectory);
      if (directoryExists) {
        availableFiles = fs.readdirSync(migrationsDirectory)
          .filter(f => f.endsWith('.js'))
          .sort();
      }
    } catch (fileError) {
      console.warn('[MIGRATION-STATUS] Error reading migrations directory:', fileError.message);
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      migrations: {
        ...migrationStatus,
        directory: {
          path: migrationsDirectory,
          exists: directoryExists,
          availableFiles: availableFiles
        }
      }
    });
    
  } catch (error) {
    console.error('[MIGRATION-STATUS] Unexpected error:', error.name, error.message);
    console.error('[MIGRATION-STATUS] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Unexpected error during migration status check',
      details: `${error.name}: ${error.message}`
    });
  }
});

/**
 * @route POST /admindashboard/auth/run-migrations
 * @desc Run pending migrations (requires secret key)
 * @access Protected (requires SEED_WEB_KEY)
 */
router.post('/auth/run-migrations', async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const { Umzug, SequelizeStorage } = require('umzug');
    const path = require('path');
    
    // Initialize response structure
    const response = {
      success: false,
      paths: {
        migrationsDirectory: '',
        globPattern: '',
        found: []
      },
      input: {
        allowlist: null,
        dryRun: false
      },
      match: {
        intersection: [],
        missingFromFound: []
      },
      executed: 0,
      files: [],
      baselined: 0,
      baselinedFiles: [],
      error: null
    };
    
    if (!sequelize) {
      response.error = 'Database connection not available';
      return res.status(500).json(response);
    }
    
    // Check for secret key
    const providedKey = req.query.key || req.headers['x-seed-key'];
    const requiredKey = process.env.SEED_WEB_KEY;
    
    if (!requiredKey) {
      response.error = 'Migration endpoint not configured (SEED_WEB_KEY not set)';
      return res.status(503).json(response);
    }
    
    if (!providedKey) {
      response.error = 'Secret key required (provide ?key=... or x-seed-key header)';
      return res.status(400).json(response);
    }
    
    if (providedKey !== requiredKey) {
      console.warn('[RUN-MIGRATIONS] Invalid migration key attempt from:', req.ip);
      response.error = 'Invalid secret key';
      return res.status(401).json(response);
    }
    
    // Parse request body
    const { allowlist, dryRun } = req.body || {};
    response.input.allowlist = allowlist || null;
    response.input.dryRun = !!dryRun;
    
    console.log('[RUN-MIGRATIONS] Starting migration execution...');
    console.log('[RUN-MIGRATIONS] Input:', response.input);
    
    // Set up paths and discover migrations
    const migrationsDirectory = path.resolve(__dirname, '..', 'migrations');
    const globPattern = path.join(migrationsDirectory, '*.js');
    response.paths.migrationsDirectory = migrationsDirectory;
    response.paths.globPattern = globPattern;
    
    console.log('[RUN-MIGRATIONS] Migrations directory:', migrationsDirectory);
    console.log('[RUN-MIGRATIONS] Glob pattern:', globPattern);
    
    // Discover available migration files
    const fs = require('fs');
    try {
      const files = fs.readdirSync(migrationsDirectory);
      response.paths.found = files.filter(f => f.endsWith('.js')).sort();
      console.log('[RUN-MIGRATIONS] Found migration files:', response.paths.found);
    } catch (err) {
      console.error('[RUN-MIGRATIONS] Error reading migrations directory:', err.message);
      response.error = `Error reading migrations directory: ${err.message}`;
      return res.status(500).json(response);
    }
    
    // Calculate intersection and missing files if allowlist provided
    if (allowlist && Array.isArray(allowlist)) {
      response.match.intersection = allowlist.filter(file => response.paths.found.includes(file));
      response.match.missingFromFound = allowlist.filter(file => !response.paths.found.includes(file));
      
      console.log('[RUN-MIGRATIONS] Allowlist intersection:', response.match.intersection);
      console.log('[RUN-MIGRATIONS] Missing from found:', response.match.missingFromFound);
      
      if (response.match.missingFromFound.length > 0) {
        response.error = `Allowlisted files not found: ${response.match.missingFromFound.join(', ')}`;
        return res.status(400).json(response);
      }
    }
    
    // If dry run, return discovery information without executing
    if (response.input.dryRun) {
      console.log('[RUN-MIGRATIONS] Dry run mode - returning discovery information');
      response.success = true;
      return res.json(response);
    }
    
    // Execute migrations based on mode
    if (allowlist && Array.isArray(allowlist)) {
      console.log('[RUN-MIGRATIONS] Allowlist mode: executing only specified migrations');
      
      // First, baseline legacy migrations (mark as executed without running)
      const legacyMigrations = [
        '20250101000000-create-core-tables.js',
        '20250103121127-create-transactions.js',
        '20250127000000-update-roleid-users.js',
        '20250630060805-add-updated-at-to-currency-list.js',
        '20250714000000-safe-init-migration.js',
        '20250714000001-fix-role-id-foreign-key.js',
        '20250727065016-add-roleId-constraint-to-user.js',
        '20250728081606-add-role-id-constraint.js',
        '20250813000000-consolidate-foreign-keys.js'
      ];
      
      console.log('[RUN-MIGRATIONS] Baselining legacy migrations...');
      const baselineResult = await baselineMigrations(sequelize, legacyMigrations);
      
      if (!baselineResult.success) {
        console.error('[RUN-MIGRATIONS] Baseline failed:', baselineResult.error);
        response.error = `Baseline failed: ${baselineResult.error}`;
        return res.status(500).json(response);
      }
      
      response.baselined = baselineResult.baselined;
      response.baselinedFiles = baselineResult.migrations;
      console.log(`[RUN-MIGRATIONS] Baselined ${baselineResult.baselined} legacy migrations`);
      
      // Set up Umzug for allowlisted migrations
      const umzug = new Umzug({
        migrations: {
          glob: globPattern,
          resolve: ({ name, path: migrationPath }) => {
            // Only resolve migrations that are in the allowlist
            if (!allowlist.includes(name)) {
              return null;
            }
            
            console.log(`[RUN-MIGRATIONS] Loading allowlisted migration: ${name}`);
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
      
      // Get pending migrations from allowlist
      const pending = await umzug.pending();
      const allowlistedPending = pending.filter(m => allowlist.includes(m.name));
      
      console.log(`[RUN-MIGRATIONS] Found ${allowlistedPending.length} allowlisted pending migrations:`, 
                  allowlistedPending.map(m => m.name));
      
      if (allowlistedPending.length === 0) {
        response.success = true;
        response.executed = 0;
        response.files = [];
        console.log('[RUN-MIGRATIONS] No allowlisted migrations to execute');
        return res.json(response);
      }
      
      // Execute allowlisted migrations
      const executed = await umzug.up({ migrations: allowlistedPending.map(m => m.name) });
      
      response.success = true;
      response.executed = executed.length;
      response.files = executed.map(m => m.name);
      
      console.log('[RUN-MIGRATIONS] Allowlist execution completed successfully');
      console.log('[RUN-MIGRATIONS] SECURITY: Consider removing SEED_WEB_KEY environment variable');
      
      return res.json(response);
      
    } else {
      // Original behavior: run all pending migrations
      console.log('[RUN-MIGRATIONS] Standard mode: executing all pending migrations');
      
      // Run migrations using existing Umzug runner
      const migrationResult = await migrateOnBoot(sequelize);
    
      if (migrationResult.success !== false) {
        response.success = true;
        response.executed = migrationResult.ran || 0;
        response.files = migrationResult.migrations || [];
        
        console.log('[RUN-MIGRATIONS] Migrations completed successfully');
        console.log('[RUN-MIGRATIONS] SECURITY: Consider removing SEED_WEB_KEY environment variable');
        
        return res.json(response);
      } else {
        console.error('[RUN-MIGRATIONS] Migration execution failed:', migrationResult.error);
        response.error = migrationResult.error || 'Unknown migration error';
        return res.status(500).json(response);
      }
    }
    
  } catch (error) {
    console.error('[RUN-MIGRATIONS] Error:', error.name, error.message);
    console.error('[RUN-MIGRATIONS] Stack (first 10 lines):', error.stack.split('\n').slice(0, 10).join('\n'));
    
    const response = {
      success: false,
      error: `${error.name}: ${error.message}`
    };
    
    res.status(500).json(response);
  }
});

/**
 * @route POST /admindashboard/auth/run-allowlist-server
 * @desc Server-only baseline + allowlist migration runner (no outbound HTTP)
 * @access Protected (requires SEED_WEB_KEY)
 */
router.post('/auth/run-allowlist-server', async (req, res) => {
  try {
    console.log('[RUN-ALLOWLIST-SERVER] Server-only allowlist migration request received');
    
    // Verify secret key
    const providedKey = req.headers['x-seed-key'];
    const expectedKey = process.env.SEED_WEB_KEY;
    
    if (!expectedKey) {
      return res.status(500).json({
        success: false,
        error: 'SEED_WEB_KEY not configured'
      });
    }
    
    if (providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing x-seed-key header'
      });
    }
    
    // Get allowlist from request body
    const { allowlist } = req.body;
    
    if (!Array.isArray(allowlist)) {
      return res.status(400).json({
        success: false,
        error: 'allowlist must be an array of migration filenames'
      });
    }
    
    console.log('[RUN-ALLOWLIST-SERVER] Running baseline + allowlist with:', allowlist);
    
    // Get sequelize instance
    const { sequelize } = require('../models');
    
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }
    
    // Run baseline + allowlist process
    const result = await baselineAndRunAllowlist(sequelize, { allowlist });
    
    console.log('[RUN-ALLOWLIST-SERVER] Process complete:', result.summary);
    
    // Return structured response
    const response = {
      success: result.success,
      baselined: result.baselined,
      executed: result.executed,
      files: result.files,
      summary: result.summary
    };
    
    if (!result.success && result.errors) {
      response.errors = result.errors;
    }
    
    if (!result.success && result.error) {
      response.error = result.error;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('[RUN-ALLOWLIST-SERVER] Error:', error.name, error.message);
    console.error('[RUN-ALLOWLIST-SERVER] Stack:', error.stack);
    
    // Use enhanced verbose error function
    const verboseError = createVerboseError(error, 'run-allowlist-server');
    return res.status(500).json(verboseError);
  }
});

/**
 * @route POST /admindashboard/auth/seed-direct
 * @desc Direct seed fallback endpoint with comprehensive schema adaptation
 * @access Protected (requires SEED_WEB_KEY)
 */
router.post('/auth/seed-direct', async (req, res) => {
  try {
    console.log('[SEED-DIRECT] Direct seed fallback request received');
    
    // Verify secret key
    const providedKey = req.headers['x-seed-key'];
    const expectedKey = process.env.SEED_WEB_KEY;
    
    if (!expectedKey) {
      return res.status(500).json({
        success: false,
        error: 'SEED_WEB_KEY not configured'
      });
    }
    
    if (providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing x-seed-key header'
      });
    }
    
    // Get required environment variables
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      return res.status(500).json({
        success: false,
        error: 'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be configured'
      });
    }
    
    // Get sequelize instance
    const { sequelize } = require('../models');
    
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }
    
    // Test database connection
    await sequelize.authenticate();
    console.log('[SEED-DIRECT] Database connection verified');
    
    // Use comprehensive seeding function with dynamic schema adaptation
    const result = await sequelize.transaction(async (transaction) => {
      const { ensureRolesAndAdmin } = require('../lib/seeding');
      
      console.log('[SEED-DIRECT] Using comprehensive schema adaptation...');
      
      return await ensureRolesAndAdmin({
        sequelize,
        email: adminEmail,
        plainPassword: adminPassword,
        roleName: 'Admin',
        transaction
      });
    });
    
    console.log('[SEED-DIRECT] Direct seeding completed successfully');
    console.log('[SEED-DIRECT] SECURITY: Remove this endpoint after success');
    
    const response = {
      ok: true,
      rolesUpserted: result.rolesUpserted,
      admin: result.admin,
      ts: new Date().toISOString(),
      warning: 'Remove this endpoint and SEED_WEB_KEY after success'
    };
    
    // Include schema info in verbose mode for debugging
    if (isVerboseMode()) {
      response.schemaInfo = result.schemaInfo;
      response.availableColumns = result.schemaInfo.availableColumns;
      response.requiredNoDefault = result.schemaInfo.requiredNoDefault;
      response.columnMapping = result.schemaInfo.columnMapping;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('[SEED-DIRECT] Error:', error.name, error.message);
    console.error('[SEED-DIRECT] Stack:', error.stack);
    
    // Use enhanced verbose error function with schema context
    const schemaContext = error.schemaInfo || {};
    const verboseError = createVerboseError(error, 'seed-direct', schemaContext);
    return res.status(500).json(verboseError);
  }
});

module.exports = router;

