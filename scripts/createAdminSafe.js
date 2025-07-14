/**
 * Safe Admin User Creation Script
 * Creates admin user without dangerous sync operations
 */

const bcrypt = require('bcrypt');

async function createAdminSafe() {
  try {
    console.log('🚀 [Safe Admin] Starting safe admin creation...');
    
    // Import database models
    const db = require('../models');
    
    console.log('🔍 [Safe Admin] Available models:', Object.keys(db).filter(key => 
      key !== 'Sequelize' && key !== 'sequelize'
    ));
    
    // Check if admin user already exists
    console.log('🔍 [Safe Admin] Checking for existing admin user...');
    const existingAdmin = await db.User.findOne({
      where: { email: 'admin@dbx.com' }
    });
    
    if (existingAdmin) {
      console.log('⚠️ [Safe Admin] Admin user already exists');
      return {
        success: true,
        message: 'Admin user already exists',
        user: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          username: existingAdmin.username,
          role_id: existingAdmin.role_id
        }
      };
    }
    
    // Find or create admin role
    console.log('🔍 [Safe Admin] Finding or creating admin role...');
    let adminRole = await db.Role.findOne({
      where: { name: 'admin' }
    });
    
    if (!adminRole) {
      console.log('📦 [Safe Admin] Creating admin role...');
      adminRole = await db.Role.create({
        name: 'admin',
        description: 'Administrator role with full access'
      });
      console.log('✅ [Safe Admin] Admin role created with ID:', adminRole.id);
    } else {
      console.log('✅ [Safe Admin] Admin role found with ID:', adminRole.id);
    }
    
    // Hash the password
    console.log('🔐 [Safe Admin] Hashing password...');
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
    // Create admin user with minimal required fields
    console.log('👤 [Safe Admin] Creating admin user...');
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
    
    console.log('✅ [Safe Admin] Admin user created successfully!');
    console.log('📋 [Safe Admin] User details:', {
      id: adminUser.id,
      email: adminUser.email,
      username: adminUser.username,
      role_id: adminUser.role_id
    });
    
    return {
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_id: adminUser.role_id,
        role_name: adminRole.name
      }
    };
    
  } catch (error) {
    console.error('❌ [Safe Admin] Error:', error.message);
    console.error('📋 [Safe Admin] Stack:', error.stack);
    
    return {
      success: false,
      message: 'Failed to create admin user',
      error: error.message,
      details: error.stack
    };
  }
}

module.exports = createAdminSafe;

