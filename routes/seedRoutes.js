/**
 * Seed Management Routes
 * HTTP endpoints for checking and running database seeding
 */

const express = require('express');
const router = express.Router();
const { runSeed, checkSeedStatus } = require('../lib/seeding');
const { getMigrationStatus, migrateOnBoot, baselineMigrations } = require('../lib/migrations');

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
        error: 'Database connection not available'
      });
    }
    
    // Get seeding status
    const seedStatus = await checkSeedStatus(sequelize);
    
    if (seedStatus.error) {
      return res.status(500).json({
        success: false,
        error: seedStatus.error
      });
    }
    
    // Get migration status for additional context
    const migrationStatus = await getMigrationStatus(sequelize);
    
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
    console.error('[SEED-CHECK] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check seed status'
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
        error: 'Database connection not available'
      });
    }
    
    // Check for secret key
    const providedKey = req.query.key || req.headers['x-seed-key'];
    const requiredKey = process.env.SEED_WEB_KEY;
    
    if (!requiredKey) {
      return res.status(503).json({
        success: false,
        error: 'Seeding endpoint not configured (SEED_WEB_KEY not set)'
      });
    }
    
    if (!providedKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key required (provide ?key=... or x-seed-key header)'
      });
    }
    
    if (providedKey !== requiredKey) {
      console.warn('[SEED-RUN] Invalid seed key attempt from:', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid secret key'
      });
    }
    
    console.log('[SEED-RUN] Starting seeding process...');
    
    // Run seeding process
    const seedResult = await runSeed(sequelize);
    
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
        details: seedResult.summary
      });
    }
    
  } catch (error) {
    console.error('[SEED-RUN] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to run seeding process'
    });
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
    
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }
    
    const migrationStatus = await getMigrationStatus(sequelize);
    
    if (migrationStatus.error) {
      return res.status(500).json({
        success: false,
        error: migrationStatus.error
      });
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      migrations: migrationStatus
    });
    
  } catch (error) {
    console.error('[MIGRATION-STATUS] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get migration status'
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
    
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }
    
    // Check for secret key
    const providedKey = req.query.key || req.headers['x-seed-key'];
    const requiredKey = process.env.SEED_WEB_KEY;
    
    if (!requiredKey) {
      return res.status(503).json({
        success: false,
        error: 'Migration endpoint not configured (SEED_WEB_KEY not set)'
      });
    }
    
    if (!providedKey) {
      return res.status(400).json({
        success: false,
        error: 'Secret key required (provide ?key=... or x-seed-key header)'
      });
    }
    
    if (providedKey !== requiredKey) {
      console.warn('[RUN-MIGRATIONS] Invalid migration key attempt from:', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid secret key'
      });
    }
    
    console.log('[RUN-MIGRATIONS] Starting migration execution...');
    
    // Check for allowlist in request body
    const { allowlist } = req.body || {};
    
    if (allowlist && Array.isArray(allowlist)) {
      console.log('[RUN-MIGRATIONS] Allowlist mode: executing only specified migrations');
      console.log('[RUN-MIGRATIONS] Allowlist:', allowlist);
      
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
        return res.status(500).json({
          success: false,
          error: 'Failed to baseline legacy migrations',
          details: baselineResult.error,
          phase: 'baseline'
        });
      }
      
      console.log(`[RUN-MIGRATIONS] Baselined ${baselineResult.baselined} legacy migrations`);
      
      // Now run only allowlisted migrations
      const { Umzug, SequelizeStorage } = require('umzug');
      const path = require('path');
      
      const umzug = new Umzug({
        migrations: {
          glob: path.resolve(__dirname, '..', 'migrations', '*.js'),
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
        return res.json({
          success: true,
          timestamp: new Date().toISOString(),
          executed: 0,
          files: [],
          baselined: baselineResult.baselined,
          baselinedFiles: baselineResult.migrations,
          summary: `Baselined ${baselineResult.baselined} legacy migrations, no allowlisted migrations to execute`,
          recommendation: 'Remove SEED_WEB_KEY environment variable for security'
        });
      }
      
      // Execute allowlisted migrations
      const executed = await umzug.up({ migrations: allowlistedPending.map(m => m.name) });
      
      console.log('[RUN-MIGRATIONS] Allowlist execution completed successfully');
      console.log('[RUN-MIGRATIONS] SECURITY: Consider removing SEED_WEB_KEY environment variable');
      
      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        executed: executed.length,
        files: executed.map(m => m.name),
        baselined: baselineResult.baselined,
        baselinedFiles: baselineResult.migrations,
        summary: `Baselined ${baselineResult.baselined} legacy migrations, executed ${executed.length} allowlisted migrations`,
        recommendation: 'Remove SEED_WEB_KEY environment variable for security'
      });
      
    } else {
      // Original behavior: run all pending migrations
      console.log('[RUN-MIGRATIONS] Standard mode: executing all pending migrations');
      
      // Run migrations using existing Umzug runner
      const migrationResult = await migrateOnBoot(sequelize);
    
    if (migrationResult.success !== false) {
      console.log('[RUN-MIGRATIONS] Migrations completed successfully');
      console.log('[RUN-MIGRATIONS] SECURITY: Consider removing SEED_WEB_KEY environment variable');
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        executed: migrationResult.ran || 0,
        files: migrationResult.migrations || [],
        summary: `Executed ${migrationResult.ran || 0} migrations`,
        recommendation: 'Remove SEED_WEB_KEY environment variable for security'
      });
    } else {
      console.error('[RUN-MIGRATIONS] Migration execution failed:', migrationResult.error);
      
      res.status(500).json({
        success: false,
        error: 'Migration execution failed',
        details: migrationResult.error || 'Unknown migration error',
        executed: migrationResult.ran || 0,
        files: migrationResult.migrations || []
      });
    }
    } // End of else block for standard migration mode
    
  } catch (error) {
    console.error('[RUN-MIGRATIONS] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to run migrations'
    });
  }
});

module.exports = router;

