/**
 * Simple Admin Setup Route
 * Works with existing database schema without table creation
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Simple admin creation endpoint using existing schema
router.post('/createAdmin', async (req, res) => {
  try {
    console.log('🔄 [SimpleAdmin] Starting admin creation...');
    
    // Get database connection from models
    const { sequelize } = require('../models');
    
    console.log('🔄 [SimpleAdmin] Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ [SimpleAdmin] Database connection successful');
    
    // Check if admin role exists, if not create it
    const [roleResults] = await sequelize.query('SELECT id FROM roles WHERE name = ?', {
      replacements: ['admin']
    });
    
    let adminRoleId;
    if (roleResults.length === 0) {
      console.log('🔄 [SimpleAdmin] Creating admin role...');
      await sequelize.query(`
        INSERT INTO roles (name, description, permissions, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
      `, {
        replacements: ['admin', 'Administrator role with full access', JSON.stringify({ all: true })]
      });
      
      // Get the inserted role ID
      const [newRoleResults] = await sequelize.query('SELECT id FROM roles WHERE name = ?', {
        replacements: ['admin']
      });
      adminRoleId = newRoleResults[0].id;
      console.log('✅ [SimpleAdmin] Admin role created with ID:', adminRoleId);
    } else {
      adminRoleId = roleResults[0].id;
      console.log('✅ [SimpleAdmin] Admin role found with ID:', adminRoleId);
    }
    
    // Check if admin user exists
    const [userResults] = await sequelize.query('SELECT id, email FROM users WHERE email = ?', {
      replacements: ['admin@dbx.com']
    });
    
    if (userResults.length > 0) {
      console.log('⚠️  [SimpleAdmin] Admin user already exists');
      return res.json({
        success: true,
        message: 'Admin user already exists',
        admin: {
          id: userResults[0].id,
          email: userResults[0].email
        }
      });
    }
    
    // Create admin user
    console.log('🔄 [SimpleAdmin] Creating admin user...');
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
    await sequelize.query(`
      INSERT INTO users (
        username, email, password, first_name, last_name, 
        role_id, status, email_verified, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, {
      replacements: [
        'admin',
        'admin@dbx.com',
        hashedPassword,
        'Admin',
        'User',
        adminRoleId,
        'active',
        true
      ]
    });
    
    console.log('✅ [SimpleAdmin] Admin user created successfully');
    
    // Verify the user
    const [verifyResults] = await sequelize.query(`
      SELECT u.id, u.email, u.username, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `, {
      replacements: ['admin@dbx.com']
    });
    
    if (verifyResults.length === 0) {
      throw new Error('Admin user was created but cannot be retrieved');
    }
    
    const adminUser = verifyResults[0];
    console.log('✅ [SimpleAdmin] Admin user verified');
    
    return res.json({
      success: true,
      message: 'Admin user created and verified successfully',
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_name: adminUser.role_name
      },
      credentials: {
        username: 'admin',
        email: 'admin@dbx.com',
        password: 'dbxsupersecure'
      }
    });
    
  } catch (error) {
    console.error('❌ [SimpleAdmin] Error in admin creation:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin creation failed',
      error: error.message,
      stack: error.stack
    });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Simple admin setup route is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

