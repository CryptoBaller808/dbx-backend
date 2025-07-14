/**
 * Direct Admin User Creation Script
 * Creates the default admin user with proper credentials
 */

const db = require('../models');
const bcrypt = require('bcrypt');

async function createDefaultAdmin() {
  try {
    console.log('🚀 [Admin Creation] Starting admin user creation...');
    
    // Wait for database connection
    await db.sequelize.authenticate();
    console.log('✅ [Admin Creation] Database connected');
    
    // Sync models to ensure tables exist
    await db.sequelize.sync({ alter: false });
    console.log('✅ [Admin Creation] Models synchronized');
    
    // Check if admin user already exists
    const existingAdmin = await db.User.findOne({ 
      where: { email: 'admin@dbx.com' } 
    });
    
    if (existingAdmin) {
      console.log('⚠️ [Admin Creation] Admin user already exists');
      return {
        success: true,
        message: 'Admin user already exists',
        user: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          username: existingAdmin.username
        }
      };
    }
    
    // Find or create admin role
    let adminRole = await db.Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      console.log('📦 [Admin Creation] Creating admin role...');
      adminRole = await db.Role.create({
        name: 'admin',
        description: 'Administrator role with full access'
      });
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
    // Create admin user
    console.log('👤 [Admin Creation] Creating admin user...');
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
    
    console.log('✅ [Admin Creation] Admin user created successfully!');
    
    return {
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_id: adminUser.role_id
      }
    };
    
  } catch (error) {
    console.error('❌ [Admin Creation] Error:', error);
    return {
      success: false,
      message: 'Failed to create admin user',
      error: error.message
    };
  } finally {
    // Close database connection
    if (db.sequelize) {
      await db.sequelize.close();
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  createDefaultAdmin().then(result => {
    console.log('🎯 [Admin Creation] Final result:', result);
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = createDefaultAdmin;

