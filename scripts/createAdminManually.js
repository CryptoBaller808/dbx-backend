const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function createAdminUserManually() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 [Manual Setup] Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ [Manual Setup] Connected to database successfully');

    // Create roles table if it doesn't exist
    console.log('🔄 [Manual Setup] Creating roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ [Manual Setup] Roles table created/verified');

    // Create users table if it doesn't exist
    console.log('🔄 [Manual Setup] Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        role_id INTEGER REFERENCES roles(id),
        status VARCHAR(50) DEFAULT 'active',
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ [Manual Setup] Users table created/verified');

    // Check if admin role exists
    console.log('🔄 [Manual Setup] Checking for admin role...');
    const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    
    let adminRoleId;
    if (roleResult.rows.length === 0) {
      console.log('🔄 [Manual Setup] Creating admin role...');
      const roleInsert = await client.query(`
        INSERT INTO roles (name, description, permissions) 
        VALUES ($1, $2, $3) 
        RETURNING id
      `, ['admin', 'Administrator role with full access', JSON.stringify({ all: true })]);
      adminRoleId = roleInsert.rows[0].id;
      console.log('✅ [Manual Setup] Admin role created with ID:', adminRoleId);
    } else {
      adminRoleId = roleResult.rows[0].id;
      console.log('✅ [Manual Setup] Admin role found with ID:', adminRoleId);
    }

    // Check if admin user exists
    console.log('🔄 [Manual Setup] Checking for admin user...');
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', ['admin@dbx.com']);
    
    if (userResult.rows.length === 0) {
      console.log('🔄 [Manual Setup] Creating admin user...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
      console.log('✅ [Manual Setup] Password hashed successfully');
      
      // Insert admin user
      const userInsert = await client.query(`
        INSERT INTO users (username, email, password, first_name, last_name, role_id, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, username
      `, ['admin', 'admin@dbx.com', hashedPassword, 'Admin', 'User', adminRoleId, 'active', true]);
      
      const newAdmin = userInsert.rows[0];
      console.log('✅ [Manual Setup] Admin user created successfully:');
      console.log('   ID:', newAdmin.id);
      console.log('   Email:', newAdmin.email);
      console.log('   Username:', newAdmin.username);
      
      return {
        success: true,
        message: 'Admin user created successfully',
        admin: newAdmin
      };
    } else {
      console.log('⚠️  [Manual Setup] Admin user already exists with ID:', userResult.rows[0].id);
      return {
        success: false,
        message: 'Admin user already exists',
        admin_id: userResult.rows[0].id
      };
    }

  } catch (error) {
    console.error('❌ [Manual Setup] Error:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔄 [Manual Setup] Database connection closed');
  }
}

// Export for use in routes or run directly
module.exports = createAdminUserManually;

// If run directly
if (require.main === module) {
  createAdminUserManually()
    .then(result => {
      console.log('🎉 [Manual Setup] Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 [Manual Setup] Failed:', error);
      process.exit(1);
    });
}

