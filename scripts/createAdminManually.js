/**
 * Manual Admin User Creation Script
 * Creates admin user directly in the database
 */

const bcrypt = require('bcrypt');

async function createAdminUserManually() {
  try {
    console.log('🔄 [Manual Admin] Starting manual admin creation process...');
    
    // Import database models
    const db = require('../models');
    
    console.log('🔄 [Manual Admin] Testing database connection...');
    
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ [Manual Admin] Database connection successful');
    
    console.log('🔄 [Manual Admin] Syncing database tables...');
    
    // Sync database to ensure tables exist
    await db.sequelize.sync({ alter: true });
    console.log('✅ [Manual Admin] Database sync completed');
    
    console.log('🔄 [Manual Admin] Checking available models...');
    const availableModels = Object.keys(db).filter(key => 
      key !== 'Sequelize' && 
      key !== 'sequelize' && 
      key !== 'initializeDatabase'
    );
    console.log('📋 [Manual Admin] Available models:', availableModels);
    
    // Check if User and Role models exist
    if (!db.User && !db.users) {
      throw new Error('User model not found in database models');
    }
    
    if (!db.Role && !db.roles) {
      throw new Error('Role model not found in database models');
    }
    
    // Use the correct model references
    const UserModel = db.User || db.users;
    const RoleModel = db.Role || db.roles;
    
    console.log('✅ [Manual Admin] User and Role models found');
    
    console.log('🔄 [Manual Admin] Checking if admin user already exists...');
    
    // Check if admin user already exists
    const existingAdmin = await UserModel.findOne({
      where: { email: 'admin@dbx.com' }
    });
    
    if (existingAdmin) {
      console.log('⚠️  [Manual Admin] Admin user already exists');
      return {
        success: true,
        message: 'Admin user already exists',
        admin_exists: true,
        admin_id: existingAdmin.id,
        admin_email: existingAdmin.email
      };
    }
    
    console.log('🔄 [Manual Admin] Creating admin role...');
    
    // Find or create admin role
    let adminRole = await RoleModel.findOne({
      where: { name: 'admin' }
    });
    
    if (!adminRole) {
      adminRole = await RoleModel.create({
        name: 'admin',
        description: 'Administrator role with full access',
        permissions: { all: true }
      });
      console.log('✅ [Manual Admin] Admin role created');
    } else {
      console.log('✅ [Manual Admin] Admin role already exists');
    }
    
    console.log('🔄 [Manual Admin] Hashing password...');
    
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    console.log('✅ [Manual Admin] Password hashed successfully');
    
    console.log('🔄 [Manual Admin] Creating admin user...');
    
    // Create admin user
    const adminUser = await UserModel.create({
      username: 'admin',
      email: 'admin@dbx.com',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role_id: adminRole.id,
      status: 'active',
      email_verified: true
    });
    
    console.log('✅ [Manual Admin] Admin user created successfully');
    
    return {
      success: true,
      message: 'Admin user created successfully',
      admin_creation: {
        success: true,
        user_created: true,
        admin_id: adminUser.id,
        admin_email: adminUser.email,
        admin_username: adminUser.username,
        role_id: adminUser.role_id,
        role_name: adminRole.name
      }
    };
    
  } catch (error) {
    console.error('❌ [Manual Admin] Error creating admin user:', error);
    console.error('🔧 [Manual Admin] Error message:', error.message);
    console.error('📋 [Manual Admin] Stack trace:', error.stack);
    
    return {
      success: false,
      message: 'Failed to create admin user',
      error: error.message,
      stack: error.stack
    };
  }
}

module.exports = createAdminUserManually;

// If this script is run directly
if (require.main === module) {
  createAdminUserManually()
    .then(result => {
      console.log('🎯 [Manual Admin] Final result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [Manual Admin] Unhandled error:', error);
      process.exit(1);
    });
}

