/**
 * Simple Admin Creation Route
 * Creates the default admin user via HTTP endpoint
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Simple admin creation endpoint
router.post('/create-default-admin', async (req, res) => {
  try {
    console.log('🚀 [Simple Admin] Starting admin creation...');
    
    // Get database from the global models
    const db = require('../models');
    
    // Check if admin user already exists
    const existingAdmin = await db.User.findOne({ 
      where: { email: 'admin@dbx.com' } 
    });
    
    if (existingAdmin) {
      console.log('⚠️ [Simple Admin] Admin user already exists');
      return res.json({
        success: true,
        message: 'Admin user already exists',
        user: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          username: existingAdmin.username
        }
      });
    }
    
    // Find or create admin role
    let adminRole = await db.Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      console.log('📦 [Simple Admin] Creating admin role...');
      adminRole = await db.Role.create({
        name: 'admin',
        description: 'Administrator role with full access'
      });
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
    // Create admin user
    console.log('👤 [Simple Admin] Creating admin user...');
    const adminUser = await db.User.create({
      username: 'admin',
      email: 'admin@dbx.com',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role_id: adminRole.id,
      status: 'active',
      email_verified: true
    });
    
    console.log('✅ [Simple Admin] Admin user created successfully!');
    
    res.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_id: adminUser.role_id
      }
    });
    
  } catch (error) {
    console.error('❌ [Simple Admin] Error:', error);
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
    console.log('🚀 [Simple Admin GET] Starting admin creation...');
    
    // Get database from the global models
    const db = require('../models');
    
    // Check if admin user already exists
    const existingAdmin = await db.User.findOne({ 
      where: { email: 'admin@dbx.com' } 
    });
    
    if (existingAdmin) {
      console.log('⚠️ [Simple Admin GET] Admin user already exists');
      return res.json({
        success: true,
        message: 'Admin user already exists',
        user: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          username: existingAdmin.username
        }
      });
    }
    
    // Find or create admin role
    let adminRole = await db.Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      console.log('📦 [Simple Admin GET] Creating admin role...');
      adminRole = await db.Role.create({
        name: 'admin',
        description: 'Administrator role with full access'
      });
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
    // Create admin user
    console.log('👤 [Simple Admin GET] Creating admin user...');
    const adminUser = await db.User.create({
      username: 'admin',
      email: 'admin@dbx.com',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role_id: adminRole.id,
      status: 'active',
      email_verified: true
    });
    
    console.log('✅ [Simple Admin GET] Admin user created successfully!');
    
    res.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_id: adminUser.role_id
      }
    });
    
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

