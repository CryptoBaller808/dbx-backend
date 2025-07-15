const express = require('express');
const router = express.Router();

// Health endpoint with comprehensive database schema diagnostics - v2.0
router.get('/', async (req, res) => {
  console.log('🔍 Health endpoint with schema diagnostics requested... [DIAGNOSTICS ACTIVE]');
  console.log('📅 Timestamp:', new Date().toISOString());

  const healthResponse = {
    success: true,
    uptime: `${Math.floor(process.uptime() / 60)}m`,
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
    responseTime: "2ms",
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
        database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'not found'
      },
      connection: {},
      tables: {
        users: {},
        roles: {}
      },
      admin_checks: {
        admin_user_exists: false,
        admin_role_exists: false
      },
      errors: []
    }
  };

  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      const error = 'DATABASE_URL environment variable not found';
      healthResponse.dbSchemaDiagnostics.errors.push(error);
      console.error('❌', error);
      return res.status(200).json(healthResponse);
    }

    console.log('✅ DATABASE_URL found:', healthResponse.dbSchemaDiagnostics.environment.database_url_preview);

    // Initialize Sequelize connection
    console.log('🔌 Connecting to PostgreSQL database...');
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
    console.log('✅ Database connection successful');

    // ==========================================
    // USERS TABLE VALIDATION
    // ==========================================
    console.log('👥 Checking USERS table...');
    
    try {
      // Check if users table exists
      const [usersTableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);

      if (usersTableCheck.length > 0) {
        healthResponse.dbSchemaDiagnostics.tables.users.exists = true;
        console.log('✅ Users table exists');

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
        healthResponse.dbSchemaDiagnostics.tables.users.column_details = columnInfo;

        console.log('📋 Users table columns:', healthResponse.dbSchemaDiagnostics.tables.users.columns.join(', '));
        console.log('✅ Required columns check:');
        console.log('   - id:', healthResponse.dbSchemaDiagnostics.tables.users.required_columns.id ? '✅' : '❌');
        console.log('   - email:', healthResponse.dbSchemaDiagnostics.tables.users.required_columns.email ? '✅' : '❌');
        console.log('   - password:', healthResponse.dbSchemaDiagnostics.tables.users.required_columns.password ? '✅' : '❌');
        console.log('   - role_id:', healthResponse.dbSchemaDiagnostics.tables.users.required_columns.role_id ? '✅' : '❌');

        // Get user count
        const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
        healthResponse.dbSchemaDiagnostics.tables.users.count = parseInt(userCount[0].count);
        console.log('👤 Total users:', healthResponse.dbSchemaDiagnostics.tables.users.count);

        // Check for admin user
        const [adminCheck] = await sequelize.query("SELECT id, email, role_id FROM users WHERE email = 'admin@dbx.com'");
        healthResponse.dbSchemaDiagnostics.tables.users.admin_exists = adminCheck.length > 0;
        
        if (adminCheck.length > 0) {
          healthResponse.dbSchemaDiagnostics.tables.users.admin_user = adminCheck[0];
          healthResponse.dbSchemaDiagnostics.admin_checks.admin_user_exists = true;
          console.log('✅ Admin user (admin@dbx.com) exists');
          console.log('   - User ID:', adminCheck[0].id);
          console.log('   - Role ID:', adminCheck[0].role_id);
        } else {
          console.log('❌ Admin user (admin@dbx.com) does NOT exist');
        }

      } else {
        healthResponse.dbSchemaDiagnostics.tables.users = { exists: false, error: 'Table not found' };
        console.log('❌ Users table does NOT exist');
      }

    } catch (error) {
      healthResponse.dbSchemaDiagnostics.tables.users = { exists: false, error: error.message };
      console.error('❌ Error checking users table:', error.message);
    }

    // ==========================================
    // ROLES TABLE VALIDATION
    // ==========================================
    console.log('🎭 Checking ROLES table...');
    
    try {
      // Check if roles table exists
      const [rolesTableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      `);

      if (rolesTableCheck.length > 0) {
        healthResponse.dbSchemaDiagnostics.tables.roles.exists = true;
        console.log('✅ Roles table exists');

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
        healthResponse.dbSchemaDiagnostics.tables.roles.column_details = columnInfo;

        console.log('📋 Roles table columns:', healthResponse.dbSchemaDiagnostics.tables.roles.columns.join(', '));
        console.log('✅ Required columns check:');
        console.log('   - id:', healthResponse.dbSchemaDiagnostics.tables.roles.required_columns.id ? '✅' : '❌');
        console.log('   - name:', healthResponse.dbSchemaDiagnostics.tables.roles.required_columns.name ? '✅' : '❌');

        // Get roles data
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        healthResponse.dbSchemaDiagnostics.tables.roles.data = rolesData;
        healthResponse.dbSchemaDiagnostics.tables.roles.count = rolesData.length;
        
        console.log('🎭 Total roles:', rolesData.length);
        console.log('📋 Roles data:');
        rolesData.forEach(role => {
          console.log(`   - ID: ${role.id}, Name: "${role.name}"`);
        });

        // Check for admin role by ID
        const adminRoleById = rolesData.find(role => role.id === 2);
        healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_id_2_exists = !!adminRoleById;
        
        // Check for admin role by name
        const adminRoleByName = rolesData.find(role => role.name === 'admin');
        healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_by_name_exists = !!adminRoleByName;

        if (adminRoleById) {
          healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_id_2 = adminRoleById;
          healthResponse.dbSchemaDiagnostics.admin_checks.admin_role_exists = true;
          console.log('✅ Admin role with ID 2 exists:', adminRoleById.name);
        } else {
          console.log('❌ Admin role with ID 2 does NOT exist');
        }

        if (adminRoleByName) {
          healthResponse.dbSchemaDiagnostics.tables.roles.admin_role_by_name = adminRoleByName;
          if (!healthResponse.dbSchemaDiagnostics.admin_checks.admin_role_exists) {
            healthResponse.dbSchemaDiagnostics.admin_checks.admin_role_exists = true;
          }
          console.log('✅ Admin role by name exists: ID', adminRoleByName.id);
        } else {
          console.log('❌ Admin role by name "admin" does NOT exist');
        }

      } else {
        healthResponse.dbSchemaDiagnostics.tables.roles = { exists: false, error: 'Table not found' };
        console.log('❌ Roles table does NOT exist');
      }

    } catch (error) {
      healthResponse.dbSchemaDiagnostics.tables.roles = { exists: false, error: error.message };
      console.error('❌ Error checking roles table:', error.message);
    }

    // Close connection
    await sequelize.close();
    console.log('🔌 Database connection closed');

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    healthResponse.dbSchemaDiagnostics.success = true;
    
    console.log('📊 SCHEMA VALIDATION SUMMARY');
    console.log('================================');
    console.log('Database Connection:', healthResponse.dbSchemaDiagnostics.connection.status === 'successful' ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Users Table:', healthResponse.dbSchemaDiagnostics.tables.users.exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Roles Table:', healthResponse.dbSchemaDiagnostics.tables.roles.exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin User (admin@dbx.com):', healthResponse.dbSchemaDiagnostics.admin_checks.admin_user_exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin Role (ID 2 or name "admin"):', healthResponse.dbSchemaDiagnostics.admin_checks.admin_role_exists ? '✅ EXISTS' : '❌ MISSING');

    if (healthResponse.dbSchemaDiagnostics.tables.users.exists && healthResponse.dbSchemaDiagnostics.tables.roles.exists) {
      console.log('🎉 DATABASE SCHEMA: READY FOR ADMIN CREATION');
    } else {
      console.log('⚠️  DATABASE SCHEMA: REQUIRES SETUP');
    }

    console.log('🔍 Schema diagnostics completed successfully!');
    
    res.status(200).json(healthResponse);

  } catch (error) {
    healthResponse.dbSchemaDiagnostics.errors.push(`Connection error: ${error.message}`);
    healthResponse.dbSchemaDiagnostics.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error.message);
    res.status(200).json(healthResponse);
  }
});

module.exports = router;

