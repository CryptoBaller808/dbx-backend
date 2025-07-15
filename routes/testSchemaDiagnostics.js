const express = require('express');
const router = express.Router();

// Test schema diagnostics endpoint
router.get('/', async (req, res) => {
  console.log('🔍 Test schema diagnostics endpoint requested...');
  console.log('📅 Timestamp:', new Date().toISOString());

  const diagnosticsResponse = {
    success: true,
    timestamp: new Date().toISOString(),
    endpoint: "test-schema-diagnostics",
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
  };

  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      const error = 'DATABASE_URL environment variable not found';
      diagnosticsResponse.errors.push(error);
      console.error('❌', error);
      return res.status(200).json(diagnosticsResponse);
    }

    console.log('✅ DATABASE_URL found:', diagnosticsResponse.environment.database_url_preview);

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
    diagnosticsResponse.connection.status = 'successful';
    diagnosticsResponse.connection.dialect = 'postgres';
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
        diagnosticsResponse.tables.users.exists = true;
        console.log('✅ Users table exists');

        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);

        diagnosticsResponse.tables.users.columns = columnInfo.map(col => col.column_name);
        diagnosticsResponse.tables.users.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          email: columnInfo.some(col => col.column_name === 'email'),
          password: columnInfo.some(col => col.column_name === 'password'),
          role_id: columnInfo.some(col => col.column_name === 'role_id')
        };
        diagnosticsResponse.tables.users.column_details = columnInfo;

        console.log('📋 Users table columns:', diagnosticsResponse.tables.users.columns.join(', '));
        console.log('✅ Required columns check:');
        console.log('   - id:', diagnosticsResponse.tables.users.required_columns.id ? '✅' : '❌');
        console.log('   - email:', diagnosticsResponse.tables.users.required_columns.email ? '✅' : '❌');
        console.log('   - password:', diagnosticsResponse.tables.users.required_columns.password ? '✅' : '❌');
        console.log('   - role_id:', diagnosticsResponse.tables.users.required_columns.role_id ? '✅' : '❌');

        // Get user count
        const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
        diagnosticsResponse.tables.users.count = parseInt(userCount[0].count);
        console.log('👤 Total users:', diagnosticsResponse.tables.users.count);

        // Check for admin user
        const [adminCheck] = await sequelize.query("SELECT id, email, role_id FROM users WHERE email = 'admin@dbx.com'");
        diagnosticsResponse.tables.users.admin_exists = adminCheck.length > 0;
        
        if (adminCheck.length > 0) {
          diagnosticsResponse.tables.users.admin_user = adminCheck[0];
          diagnosticsResponse.admin_checks.admin_user_exists = true;
          console.log('✅ Admin user (admin@dbx.com) exists');
          console.log('   - User ID:', adminCheck[0].id);
          console.log('   - Role ID:', adminCheck[0].role_id);
        } else {
          console.log('❌ Admin user (admin@dbx.com) does NOT exist');
        }

      } else {
        diagnosticsResponse.tables.users = { exists: false, error: 'Table not found' };
        console.log('❌ Users table does NOT exist');
      }

    } catch (error) {
      diagnosticsResponse.tables.users = { exists: false, error: error.message };
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
        diagnosticsResponse.tables.roles.exists = true;
        console.log('✅ Roles table exists');

        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'roles'
          ORDER BY ordinal_position
        `);

        diagnosticsResponse.tables.roles.columns = columnInfo.map(col => col.column_name);
        diagnosticsResponse.tables.roles.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          name: columnInfo.some(col => col.column_name === 'name')
        };
        diagnosticsResponse.tables.roles.column_details = columnInfo;

        console.log('📋 Roles table columns:', diagnosticsResponse.tables.roles.columns.join(', '));
        console.log('✅ Required columns check:');
        console.log('   - id:', diagnosticsResponse.tables.roles.required_columns.id ? '✅' : '❌');
        console.log('   - name:', diagnosticsResponse.tables.roles.required_columns.name ? '✅' : '❌');

        // Get roles data
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        diagnosticsResponse.tables.roles.data = rolesData;
        diagnosticsResponse.tables.roles.count = rolesData.length;
        
        console.log('🎭 Total roles:', rolesData.length);
        console.log('📋 Roles data:');
        rolesData.forEach(role => {
          console.log(`   - ID: ${role.id}, Name: "${role.name}"`);
        });

        // Check for admin role by ID
        const adminRoleById = rolesData.find(role => role.id === 2);
        diagnosticsResponse.tables.roles.admin_role_id_2_exists = !!adminRoleById;
        
        // Check for admin role by name
        const adminRoleByName = rolesData.find(role => role.name === 'admin');
        diagnosticsResponse.tables.roles.admin_role_by_name_exists = !!adminRoleByName;

        if (adminRoleById) {
          diagnosticsResponse.tables.roles.admin_role_id_2 = adminRoleById;
          diagnosticsResponse.admin_checks.admin_role_exists = true;
          console.log('✅ Admin role with ID 2 exists:', adminRoleById.name);
        } else {
          console.log('❌ Admin role with ID 2 does NOT exist');
        }

        if (adminRoleByName) {
          diagnosticsResponse.tables.roles.admin_role_by_name = adminRoleByName;
          if (!diagnosticsResponse.admin_checks.admin_role_exists) {
            diagnosticsResponse.admin_checks.admin_role_exists = true;
          }
          console.log('✅ Admin role by name exists: ID', adminRoleByName.id);
        } else {
          console.log('❌ Admin role by name "admin" does NOT exist');
        }

      } else {
        diagnosticsResponse.tables.roles = { exists: false, error: 'Table not found' };
        console.log('❌ Roles table does NOT exist');
      }

    } catch (error) {
      diagnosticsResponse.tables.roles = { exists: false, error: error.message };
      console.error('❌ Error checking roles table:', error.message);
    }

    // Close connection
    await sequelize.close();
    console.log('🔌 Database connection closed');

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    diagnosticsResponse.success = true;
    
    console.log('📊 SCHEMA VALIDATION SUMMARY');
    console.log('================================');
    console.log('Database Connection:', diagnosticsResponse.connection.status === 'successful' ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Users Table:', diagnosticsResponse.tables.users.exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Roles Table:', diagnosticsResponse.tables.roles.exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin User (admin@dbx.com):', diagnosticsResponse.admin_checks.admin_user_exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin Role (ID 2 or name "admin"):', diagnosticsResponse.admin_checks.admin_role_exists ? '✅ EXISTS' : '❌ MISSING');

    if (diagnosticsResponse.tables.users.exists && diagnosticsResponse.tables.roles.exists) {
      console.log('🎉 DATABASE SCHEMA: READY FOR ADMIN CREATION');
    } else {
      console.log('⚠️  DATABASE SCHEMA: REQUIRES SETUP');
    }

    console.log('🔍 Schema diagnostics completed successfully!');
    
    res.status(200).json(diagnosticsResponse);

  } catch (error) {
    diagnosticsResponse.errors.push(`Connection error: ${error.message}`);
    diagnosticsResponse.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error.message);
    res.status(200).json(diagnosticsResponse);
  }
});

module.exports = router;

