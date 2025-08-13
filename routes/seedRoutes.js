/**
 * Seed Management Routes
 * HTTP endpoints for checking and running database seeding
 */

const express = require('express');
const router = express.Router();
const { runSeed, checkSeedStatus } = require('../lib/seeding');
const { getMigrationStatus } = require('../lib/migrations');

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

module.exports = router;

