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

// Database diagnostics endpoint
router.get('/db-diagnostics', async (req, res) => {
  console.log('🔍 Database Diagnostics requested...');
  
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
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      report.errors.push('DATABASE_URL environment variable not found');
      return res.json(report);
    }
    
    // Try to load Sequelize and connect
    const { Sequelize } = require('sequelize');
    
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
    
    // Test connection
    await sequelize.authenticate();
    report.connection.status = 'successful';
    report.connection.dialect = 'postgres';
    
    // Check users table using raw SQL
    try {
      // Check if users table exists
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      
      if (tableCheck.length > 0) {
        report.tables.users = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        report.tables.users.columns = columnInfo.map(col => col.column_name);
        report.tables.users.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          email: columnInfo.some(col => col.column_name === 'email'),
          password: columnInfo.some(col => col.column_name === 'password'),
          role_id: columnInfo.some(col => col.column_name === 'role_id')
        };
        report.tables.users.column_details = columnInfo;
      
      // Get user count
      const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
      report.tables.users.count = parseInt(userCount[0].count);
      
      // Check for admin user
      const [adminCheck] = await sequelize.query("SELECT id, email FROM users WHERE email = 'admin@dbx.com'");
      report.tables.users.admin_exists = adminCheck.length > 0;
      if (adminCheck.length > 0) {
        report.tables.users.admin_user = adminCheck[0];
      }
      } else {
        report.tables.users = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      report.tables.users = { exists: false, error: error.message };
    }
    
    // Check roles table using raw SQL
    try {
      // Check if roles table exists
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      `);
      
      if (tableCheck.length > 0) {
        report.tables.roles = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'roles'
          ORDER BY ordinal_position
        `);
        
        report.tables.roles.columns = columnInfo.map(col => col.column_name);
        report.tables.roles.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          name: columnInfo.some(col => col.column_name === 'name')
        };
        report.tables.roles.column_details = columnInfo;
        
        // Get roles data
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        report.tables.roles.data = rolesData;
        report.tables.roles.admin_role_exists = rolesData.some(role => role.name === 'admin');
        report.tables.roles.role_id_2_exists = rolesData.some(role => role.id === 2);
      } else {
        report.tables.roles = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      report.tables.roles = { exists: false, error: error.message };
    }
    
    await sequelize.close();
    report.success = true;
    
  } catch (error) {
    report.errors.push(`Connection error: ${error.message}`);
    report.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error);
  }
  
  res.json(report);
});

module.exports = router;

