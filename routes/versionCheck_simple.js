const express = require('express');
const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Simple version route test working',
    timestamp: new Date().toISOString()
  });
});

// Basic version endpoint
router.get('/version', (req, res) => {
  res.json({
    success: true,
    message: 'Version check endpoint',
    version: 'simple-test',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

