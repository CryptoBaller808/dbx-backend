/**
 * Direct Admin User Creation Script
 * Creates admin user directly using raw SQL queries to bypass model issues
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createAdminDirect() {
  let client;
  
  try {
    console.log('🔄 [Direct] Starting direct admin creation...');
    
    // Get DATABASE_URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable not found');
    }
    
    console.log('✅ [Direct] DATABASE_URL found');
    
    // Create PostgreSQL client
    client = new Client({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔄 [Direct] Connecting to database...');
    await client.connect();
    console.log('✅ [Direct] Database connection established');
    
    // Check if tables exist and create them if needed
    console.log('🔄 [Direct] Checking/creating tables...');
    
    // Create roles table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        profile_image VARCHAR(255),
        cover_image VARCHAR(255),
        bio TEXT,
        website VARCHAR(255),
        twitter VARCHAR(255),
        instagram VARCHAR(255),
        role_id INTEGER DEFAULT 2,
        status VARCHAR(50) DEFAULT 'active',
        email_verified BOOLEAN DEFAULT false,
        verification_token VARCHAR(255),
        reset_password_token VARCHAR(255),
        reset_password_expires TIMESTAMP,
        xrp_wallet_address VARCHAR(255),
        xlm_wallet_address VARCHAR(255),
        xdc_wallet_address VARCHAR(255),
        solana_wallet_address VARCHAR(255),
        sanctions_checked BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✅ [Direct] Tables created/verified');
    
    // Check if admin role exists
    console.log('🔄 [Direct] Checking for admin role...');
    const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    
    let adminRoleId;
    if (roleResult.rows.length === 0) {
      console.log('🔄 [Direct] Creating admin role...');
      const insertRoleResult = await client.query(`
        INSERT INTO roles (name, description, permissions, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id
      `, ['admin', 'Administrator role with full access', JSON.stringify({ all: true })]);
      
      adminRoleId = insertRoleResult.rows[0].id;
      console.log('✅ [Direct] Admin role created with ID:', adminRoleId);
    } else {
      adminRoleId = roleResult.rows[0].id;
      console.log('✅ [Direct] Admin role found with ID:', adminRoleId);
    }
    
    // Check if admin user exists
    console.log('🔄 [Direct] Checking for admin user...');
    const userResult = await client.query('SELECT id, email FROM users WHERE email = $1', ['admin@dbx.com']);
    
    if (userResult.rows.length > 0) {
      console.log('⚠️  [Direct] Admin user already exists');
      return {
        success: true,
        message: 'Admin user already exists',
        admin: {
          id: userResult.rows[0].id,
          email: userResult.rows[0].email
        }
      };
    }
    
    // Create admin user
    console.log('🔄 [Direct] Creating admin user...');
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
    const insertUserResult = await client.query(`
      INSERT INTO users (
        username, email, password, first_name, last_name, 
        role_id, status, email_verified, "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, email, username
    `, [
      'admin',
      'admin@dbx.com',
      hashedPassword,
      'Admin',
      'User',
      adminRoleId,
      'active',
      true
    ]);
    
    const adminUser = insertUserResult.rows[0];
    console.log('✅ [Direct] Admin user created successfully');
    
    // Verify the user can be retrieved
    console.log('🔄 [Direct] Verifying admin user...');
    const verifyResult = await client.query(`
      SELECT u.id, u.email, u.username, u.password, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `, ['admin@dbx.com']);
    
    if (verifyResult.rows.length === 0) {
      throw new Error('Admin user was created but cannot be retrieved');
    }
    
    const verifiedUser = verifyResult.rows[0];
    console.log('✅ [Direct] Admin user verified');
    
    // Test password comparison
    console.log('🔄 [Direct] Testing password...');
    const passwordMatch = await bcrypt.compare('dbxsupersecure', verifiedUser.password);
    
    if (!passwordMatch) {
      throw new Error('Password comparison failed');
    }
    
    console.log('✅ [Direct] Password verification successful');
    
    return {
      success: true,
      message: 'Admin user created and verified successfully',
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_name: verifiedUser.role_name
      },
      tests_passed: [
        'Database connection',
        'Table creation',
        'Role creation',
        'User creation',
        'User verification',
        'Password comparison'
      ]
    };
    
  } catch (error) {
    console.error('❌ [Direct] Error in direct admin creation:', error);
    return {
      success: false,
      message: 'Direct admin creation failed',
      error: error.message,
      stack: error.stack
    };
  } finally {
    if (client) {
      await client.end();
      console.log('🔄 [Direct] Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  createAdminDirect()
    .then(result => {
      console.log('🎯 [Direct] Final result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [Direct] Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = createAdminDirect;

