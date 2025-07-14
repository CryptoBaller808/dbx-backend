/**
 * Simple Admin Creation Route
 * Creates the default admin user via HTTP endpoint using safe script
 */

const express = require('express');
const router = express.Router();

// POST endpoint for admin creation
router.post('/create-default-admin', async (req, res) => {
  try {
    console.log('🚀 [Simple Admin POST] Starting safe admin creation...');
    
    const createAdminSafe = require('../scripts/createAdminSafe');
    const result = await createAdminSafe();
    
    console.log('✅ [Simple Admin POST] Safe admin creation completed:', result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ [Simple Admin POST] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin user',
      error: error.message
    });
  }
});

// GET endpoint for easy testing
router.get('/create-default-admin', async (req, res) => {
  try {
    console.log('🚀 [Simple Admin GET] Starting safe admin creation...');
    
    const createAdminSafe = require('../scripts/createAdminSafe');
    const result = await createAdminSafe();
    
    console.log('✅ [Simple Admin GET] Safe admin creation completed:', result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ [Simple Admin GET] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin user',
      error: error.message
    });
  }
});

module.exports = router;

