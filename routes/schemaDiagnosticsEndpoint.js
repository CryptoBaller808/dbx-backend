const express = require('express');
const router = express.Router();

// Schema diagnostics endpoint that runs the standalone script logic
router.get('/', async (req, res) => {
  console.log('🔍 Starting Database Schema Diagnostics...');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 Environment: Production');

  const report = {
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
  };

  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      const error = 'DATABASE_URL environment variable not found';
      report.errors.push(error);
      console.error('❌', error);
      return res.status(200).json(report);
    }

    console.log('✅ DATABASE_URL found:', report.environment.database_url_preview);

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
    report.connection.status = 'successful';
    report.connection.dialect = 'postgres';
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
        report.tables.users.exists = true;
        console.log('✅ Users table exists');

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

        console.log('📋 Users table columns:', report.tables.users.columns.join(', '));

        // Get user count
        const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
        report.tables.users.count = parseInt(userCount[0].count);
        console.log('👤 Total users:', report.tables.users.count);

        // Check for admin user
        const [adminCheck] = await sequelize.query("SELECT id, email, role_id FROM users WHERE email = 'admin@dbx.com'");
        report.tables.users.admin_exists = adminCheck.length > 0;
        
        if (adminCheck.length > 0) {
          report.tables.users.admin_user = adminCheck[0];
          report.admin_checks.admin_user_exists = true;
          console.log('✅ Admin user (admin@dbx.com) exists');
        } else {
          console.log('❌ Admin user (admin@dbx.com) does NOT exist');
        }

      } else {
        report.tables.users = { exists: false, error: 'Table not found' };
        console.log('❌ Users table does NOT exist');
      }

    } catch (error) {
      report.tables.users = { exists: false, error: error.message };
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
        report.tables.roles.exists = true;
        console.log('✅ Roles table exists');

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

        console.log('📋 Roles table columns:', report.tables.roles.columns.join(', '));

        // Get roles data
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        report.tables.roles.data = rolesData;
        report.tables.roles.count = rolesData.length;
        
        console.log('🎭 Total roles:', rolesData.length);

        // Check for admin role by ID
        const adminRoleById = rolesData.find(role => role.id === 2);
        report.tables.roles.admin_role_id_2_exists = !!adminRoleById;
        
        // Check for admin role by name
        const adminRoleByName = rolesData.find(role => role.name === 'admin');
        report.tables.roles.admin_role_by_name_exists = !!adminRoleByName;

        if (adminRoleById) {
          report.tables.roles.admin_role_id_2 = adminRoleById;
          report.admin_checks.admin_role_exists = true;
          console.log('✅ Admin role with ID 2 exists:', adminRoleById.name);
        } else {
          console.log('❌ Admin role with ID 2 does NOT exist');
        }

        if (adminRoleByName) {
          report.tables.roles.admin_role_by_name = adminRoleByName;
          if (!report.admin_checks.admin_role_exists) {
            report.admin_checks.admin_role_exists = true;
          }
          console.log('✅ Admin role by name exists: ID', adminRoleByName.id);
        } else {
          console.log('❌ Admin role by name "admin" does NOT exist');
        }

      } else {
        report.tables.roles = { exists: false, error: 'Table not found' };
        console.log('❌ Roles table does NOT exist');
      }

    } catch (error) {
      report.tables.roles = { exists: false, error: error.message };
      console.error('❌ Error checking roles table:', error.message);
    }

    // Close connection
    await sequelize.close();
    console.log('🔌 Database connection closed');

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    report.success = true;
    
    console.log('📊 SCHEMA VALIDATION SUMMARY');
    console.log('================================');
    console.log('Database Connection:', report.connection.status === 'successful' ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Users Table:', report.tables.users.exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Roles Table:', report.tables.roles.exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin User (admin@dbx.com):', report.admin_checks.admin_user_exists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin Role (ID 2 or name "admin"):', report.admin_checks.admin_role_exists ? '✅ EXISTS' : '❌ MISSING');

    if (report.tables.users.exists && report.tables.roles.exists) {
      console.log('🎉 DATABASE SCHEMA: READY FOR ADMIN CREATION');
    } else {
      console.log('⚠️  DATABASE SCHEMA: REQUIRES SETUP');
    }

    console.log('🔍 Schema diagnostics completed successfully!');
    
    res.status(200).json(report);

  } catch (error) {
    report.errors.push(`Connection error: ${error.message}`);
    report.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error.message);
    res.status(200).json(report);
  }
});

module.exports = router;

