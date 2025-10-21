/**
 * Temporary Admin Setup Route
 * Simple route to create admin user using raw SQL
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Simple admin creation endpoint using raw SQL
router.post('/createAdmin', async (req, res) => {
  try {
    console.log('🔄 [TempAdmin] Starting temporary admin creation...');
    
    // Get database connection from models
    const { sequelize } = require('../models');
    
    console.log('🔄 [TempAdmin] Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ [TempAdmin] Database connection successful');
    
    // Create roles table if it doesn't exist
    console.log('🔄 [TempAdmin] Creating roles table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create users table if it doesn't exist
    console.log('🔄 [TempAdmin] Creating users table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        role_id INTEGER DEFAULT 2,
        status VARCHAR(50) DEFAULT 'active',
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✅ [TempAdmin] Tables created/verified');
    
    // Check if admin role exists
    const [roleResults] = await sequelize.query('SELECT id FROM roles WHERE name = ?', {
      replacements: ['admin']
    });
    
    let adminRoleId;
    if (roleResults.length === 0) {
      console.log('🔄 [TempAdmin] Creating admin role...');
      const [insertRoleResults] = await sequelize.query(`
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
      console.log('✅ [TempAdmin] Admin role created with ID:', adminRoleId);
    } else {
      adminRoleId = roleResults[0].id;
      console.log('✅ [TempAdmin] Admin role found with ID:', adminRoleId);
    }
    
    // Check if admin user exists
    const [userResults] = await sequelize.query('SELECT id, email FROM users WHERE email = ?', {
      replacements: ['admin@dbx.com']
    });
    
    if (userResults.length > 0) {
      console.log('⚠️  [TempAdmin] Admin user already exists');
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
    console.log('🔄 [TempAdmin] Creating admin user...');
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
    
    console.log('✅ [TempAdmin] Admin user created successfully');
    
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
    console.log('✅ [TempAdmin] Admin user verified');
    
    return res.json({
      success: true,
      message: 'Admin user created and verified successfully',
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_name: adminUser.role_name
      }
    });
    
  } catch (error) {
    console.error('❌ [TempAdmin] Error in temporary admin creation:', error);
    return res.status(500).json({
      success: false,
      message: 'Temporary admin creation failed',
      error: error.message,
      stack: error.stack
    });
  }
});

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Temporary admin setup route is working',
    timestamp: new Date().toISOString()
  });
});

// Database diagnostics endpoint
router.get('/db-diagnostics', async (req, res) => {
  console.log('🔍 Database Diagnostics requested via temp-admin route...');
  
  const report = {
    success: false,
    timestamp: new Date().toISOString(),
    environment: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
    },
    connection: {},
    tables: {},
    errors: []
  };
  
  try {
    // Get database connection from models
    const { sequelize } = require('../models');
    
    // Test connection
    await sequelize.authenticate();
    report.connection.status = 'successful';
    report.connection.dialect = 'postgres';
    
    const queryInterface = sequelize.getQueryInterface();
    
    // Check users table
    try {
      const usersStructure = await queryInterface.describeTable('users');
      report.tables.users = {
        exists: true,
        columns: Object.keys(usersStructure),
        required_columns: {
          id: 'id' in usersStructure,
          email: 'email' in usersStructure,
          password: 'password' in usersStructure,
          role_id: 'role_id' in usersStructure
        },
        column_details: usersStructure
      };
      
      // Get user count
      const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
      report.tables.users.count = parseInt(userCount[0].count);
      
      // Check for admin user
      const [adminCheck] = await sequelize.query("SELECT id, email FROM users WHERE email = 'admin@dbx.com'");
      report.tables.users.admin_exists = adminCheck.length > 0;
      if (adminCheck.length > 0) {
        report.tables.users.admin_user = adminCheck[0];
      }
      
    } catch (error) {
      report.tables.users = { exists: false, error: error.message };
    }
    
    // Check roles table
    try {
      const rolesStructure = await queryInterface.describeTable('roles');
      report.tables.roles = {
        exists: true,
        columns: Object.keys(rolesStructure),
        required_columns: {
          id: 'id' in rolesStructure,
          name: 'name' in rolesStructure
        },
        column_details: rolesStructure
      };
      
      // Get roles data
      const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
      report.tables.roles.data = rolesData;
      report.tables.roles.admin_role_exists = rolesData.some(role => role.name === 'admin');
      report.tables.roles.role_id_2_exists = rolesData.some(role => role.id === 2);
      
    } catch (error) {
      report.tables.roles = { exists: false, error: error.message };
    }
    
    report.success = true;
    
  } catch (error) {
    report.errors.push(`Connection error: ${error.message}`);
    report.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error);
  }
  
  res.json(report);
});

module.exports = router;

