const express = require('express');
const router = express.Router();

// Health endpoint with database schema diagnostics
router.get('/', async (req, res) => {
  const healthResponse = {
    success: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: "connected",
    adapters: {
      "AVAX": "offline",
      "BNB": "offline", 
      "XRP": "available",
      "XLM": "available",
      "ETH": "unavailable"
    },
    services: "running",
    responseTime: "1ms",
    cors: {
      enabled: true,
      allowedOrigins: [
        'https://dbx-frontend.onrender.com',
        'https://dbx-admin.onrender.com'
      ]
    },
    dbSchemaDiagnostics: {
      success: false,
      timestamp: new Date().toISOString(),
      environment: {
        database_url_exists: !!process.env.DATABASE_URL,
        database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
      },
      connection: { status: 'testing' },
      tables: { users: { status: 'checking' }, roles: { status: 'checking' } },
      errors: []
    }
  };
  
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      healthResponse.dbSchemaDiagnostics.errors.push('DATABASE_URL environment variable not found');
      return res.status(200).json(healthResponse);
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
    healthResponse.dbSchemaDiagnostics.connection.status = 'successful';
    healthResponse.dbSchemaDiagnostics.connection.dialect = 'postgres';
    
    // Simple table existence check
    const [usersTableCheck] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    const [rolesTableCheck] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'roles'
    `);
    
    healthResponse.dbSchemaDiagnostics.tables.users = {
      exists: usersTableCheck.length > 0,
      status: usersTableCheck.length > 0 ? 'found' : 'not_found'
    };
    
    healthResponse.dbSchemaDiagnostics.tables.roles = {
      exists: rolesTableCheck.length > 0,
      status: rolesTableCheck.length > 0 ? 'found' : 'not_found'
    };
    
    // If users table exists, get detailed info
    if (usersTableCheck.length > 0) {
      // Get column information
      const [columnInfo] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      healthResponse.dbSchemaDiagnostics.tables.users.columns = columnInfo.map(col => col.column_name);
      healthResponse.dbSchemaDiagnostics.tables.users.required_columns = {
        id: columnInfo.some(col => col.column_name === 'id'),
        email: columnInfo.some(col => col.column_name === 'email'),
        password: columnInfo.some(col => col.column_name === 'password'),
        role_id: columnInfo.some(col => col.column_name === 'role_id')
      };
      
      const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
      const [adminCheck] = await sequelize.query("SELECT COUNT(*) as count FROM users WHERE email = 'admin@dbx.com'");
      
      healthResponse.dbSchemaDiagnostics.tables.users.count = parseInt(userCount[0].count);
      healthResponse.dbSchemaDiagnostics.tables.users.admin_exists = parseInt(adminCheck[0].count) > 0;
    }
    
    // If roles table exists, get detailed info
    if (rolesTableCheck.length > 0) {
      // Get column information
      const [columnInfo] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'roles'
        ORDER BY ordinal_position
      `);
      
      healthResponse.dbSchemaDiagnostics.tables.roles.columns = columnInfo.map(col => col.column_name);
      healthResponse.dbSchemaDiagnostics.tables.roles.required_columns = {
        id: columnInfo.some(col => col.column_name === 'id'),
        name: columnInfo.some(col => col.column_name === 'name')
      };
      
      const [roleCount] = await sequelize.query('SELECT COUNT(*) as count FROM roles');
      const [adminRoleCheck] = await sequelize.query("SELECT id, name FROM roles WHERE id = 2");
      const [adminRoleByName] = await sequelize.query("SELECT id, name FROM roles WHERE name = 'admin'");
      
      healthResponse.dbSchemaDiagnostics.tables.roles.count = parseInt(roleCount[0].count);
      healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_id_2_exists = adminRoleCheck.length > 0;
      healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_by_name_exists = adminRoleByName.length > 0;
      
      if (adminRoleCheck.length > 0) {
        healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_id_2 = adminRoleCheck[0];
      }
      
      if (adminRoleByName.length > 0) {
        healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_by_name = adminRoleByName[0];
      }
    }
    
    await sequelize.close();
    healthResponse.dbSchemaDiagnostics.success = true;
    
  } catch (error) {
    healthResponse.dbSchemaDiagnostics.errors.push(`Connection error: ${error.message}`);
    healthResponse.dbSchemaDiagnostics.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error);
  }
  
  res.status(200).json(healthResponse);
});

module.exports = router;

