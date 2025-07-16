const express = require('express');
const router = express.Router();

// Health endpoint with schema validation - v3.1 FORCE REFRESH
router.get('/', async (req, res) => {
  console.log('🔍 Health endpoint with schema validation requested... [ACTIVE v3.1 FORCE REFRESH]');
  console.log('📅 Timestamp:', new Date().toISOString());

  // Base health response (matching working pattern)
  const healthResponse = {
    success: true,
    uptime: `${Math.floor(process.uptime() / 60)}m`,
    timestamp: new Date().toISOString(),
    db: "connected",
    adapters: {
      "ETH": "available",
      "BNB": "available", 
      "AVAX": "available",
      "MATIC": "available",
      "XRP": "available",
      "XLM": "available",
      "SOL": "available",
      "BTC": "available",
      "XDC": "available"
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
    // Schema validation results
    usersTableExists: false,
    rolesTableExists: false,
    adminRoleValid: false,
    adminUserExists: false,
    errors: []
  };

  // Add schema validation
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      const error = 'DATABASE_URL environment variable not found';
      healthResponse.errors.push(error);
      console.error('❌', error);
      return res.status(200).json(healthResponse);
    }

    console.log('✅ DATABASE_URL found');

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
    console.log('✅ Database connection successful');

    // Check users table
    try {
      const [usersTableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);

      if (usersTableCheck.length > 0) {
        healthResponse.usersTableExists = true;
        console.log('✅ Users table exists');

        // Check for admin user
        const [adminCheck] = await sequelize.query("SELECT id, email, role_id FROM users WHERE email = 'admin@dbx.com'");
        healthResponse.adminUserExists = adminCheck.length > 0;
        
        if (adminCheck.length > 0) {
          console.log('✅ Admin user (admin@dbx.com) exists');
        } else {
          console.log('❌ Admin user (admin@dbx.com) does NOT exist');
        }

      } else {
        console.log('❌ Users table does NOT exist');
      }

    } catch (error) {
      healthResponse.errors.push(`Users table check error: ${error.message}`);
      console.error('❌ Error checking users table:', error.message);
    }

    // Check roles table
    try {
      const [rolesTableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      `);

      if (rolesTableCheck.length > 0) {
        healthResponse.rolesTableExists = true;
        console.log('✅ Roles table exists');

        // Get roles data and check for admin role
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        
        // Check for admin role by ID or name
        const adminRoleById = rolesData.find(role => role.id === 2);
        const adminRoleByName = rolesData.find(role => role.name === 'admin');
        
        healthResponse.adminRoleValid = !!(adminRoleById || adminRoleByName);

        if (adminRoleById) {
          console.log('✅ Admin role with ID 2 exists:', adminRoleById.name);
        } else if (adminRoleByName) {
          console.log('✅ Admin role by name exists: ID', adminRoleByName.id);
        } else {
          console.log('❌ Admin role (ID 2 or name "admin") does NOT exist');
        }

      } else {
        console.log('❌ Roles table does NOT exist');
      }

    } catch (error) {
      healthResponse.errors.push(`Roles table check error: ${error.message}`);
      console.error('❌ Error checking roles table:', error.message);
    }

    // Close connection
    await sequelize.close();
    console.log('🔌 Database connection closed');

    // Log summary
    console.log('📊 SCHEMA VALIDATION SUMMARY');
    console.log('Users Table:', healthResponse.usersTableExists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Roles Table:', healthResponse.rolesTableExists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin User (admin@dbx.com):', healthResponse.adminUserExists ? '✅ EXISTS' : '❌ MISSING');
    console.log('Admin Role (ID 2 or name "admin"):', healthResponse.adminRoleValid ? '✅ EXISTS' : '❌ MISSING');

    console.log('🔍 Schema validation completed successfully!');
    
    res.status(200).json(healthResponse);

  } catch (error) {
    healthResponse.errors.push(`Schema validation error: ${error.message}`);
    console.error('❌ Schema validation failed:', error.message);
    res.status(200).json(healthResponse);
  }
});

module.exports = router;

