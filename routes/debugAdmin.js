/**
 * Debug Admin Route
 * Simple endpoint to test database access and model functionality
 */

const express = require('express');
const router = express.Router();

// Debug endpoint to test database access
router.get('/test-db', async (req, res) => {
  try {
    console.log('🔍 [Debug] Testing database access...');
    
    const db = require('../models');
    
    console.log('🔍 [Debug] Available models:', Object.keys(db).filter(key => 
      key !== 'Sequelize' && key !== 'sequelize'
    ));
    
    // Test basic database connection
    await db.sequelize.authenticate();
    console.log('✅ [Debug] Database connection successful');
    
    // Test User model access
    console.log('🔍 [Debug] Testing User model...');
    const userCount = await db.User.count();
    console.log('✅ [Debug] User table accessible, count:', userCount);
    
    // Test Role model access
    console.log('🔍 [Debug] Testing Role model...');
    const roleCount = await db.Role.count();
    console.log('✅ [Debug] Role table accessible, count:', roleCount);
    
    // Try to find existing admin
    console.log('🔍 [Debug] Looking for existing admin...');
    const existingAdmin = await db.User.findOne({
      where: { email: 'admin@dbx.com' }
    });
    
    res.json({
      success: true,
      message: 'Database access test successful',
      results: {
        database_connected: true,
        user_table_accessible: true,
        user_count: userCount,
        role_table_accessible: true,
        role_count: roleCount,
        admin_exists: !!existingAdmin,
        admin_details: existingAdmin ? {
          id: existingAdmin.id,
          email: existingAdmin.email,
          username: existingAdmin.username
        } : null
      }
    });
    
  } catch (error) {
    console.error('❌ [Debug] Database test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database access test failed',
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;

