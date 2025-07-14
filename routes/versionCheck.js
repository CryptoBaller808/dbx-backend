/**
 * Version Check Route
 * Simple route to verify which version is deployed
 */

const express = require('express');
const router = express.Router();

// Version check endpoint
router.get('/version', (req, res) => {
  res.json({
    success: true,
    message: 'Version check endpoint',
    version: '7a8ad96-foreign-key-fix',
    timestamp: new Date().toISOString(),
    commit: 'Fix foreign key definition and prevent conflicting ALTER queries',
    features: [
      'Foreign key references object implemented',
      'alter: false sync strategy',
      'CASCADE/NO ACTION constraints',
      'Production-safe migrations'
    ]
  });
});

// Deployment status check
router.get('/deployment-status', (req, res) => {
  res.json({
    success: true,
    deployment: {
      commit: '7a8ad96',
      branch: 'main',
      timestamp: new Date().toISOString(),
      status: 'foreign-key-fix-deployed',
      sql_fixes: [
        'REFERENCES inside SET DEFAULT resolved',
        'Proper foreign key constraints',
        'No conflicting ALTER queries'
      ]
    }
  });
});

module.exports = router;

