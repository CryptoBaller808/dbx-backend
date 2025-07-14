/**
 * Standalone Admin User Creation Test
 * Tests database connectivity and admin user creation outside of Express routes
 */

const bcrypt = require('bcrypt');

async function testAdminCreation() {
  try {
    console.log('🔄 [Test] Starting standalone admin creation test...');
    
    // Test 1: Basic database connection
    console.log('🔄 [Test] Testing basic database connection...');
    const { Sequelize } = require('sequelize');
    
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: console.log
    });
    
    await sequelize.authenticate();
    console.log('✅ [Test] Basic database connection successful');
    
    // Test 2: Import models
    console.log('🔄 [Test] Importing database models...');
    const db = require('./models');
    console.log('✅ [Test] Models imported successfully');
    
    // Test 3: Check available models
    const availableModels = Object.keys(db).filter(key => 
      key !== 'Sequelize' && 
      key !== 'sequelize' && 
      key !== 'initializeDatabase'
    );
    console.log('📋 [Test] Available models:', availableModels);
    
    // Test 4: Sync database
    console.log('🔄 [Test] Syncing database...');
    await db.sequelize.sync({ alter: true });
    console.log('✅ [Test] Database sync completed');
    
    // Test 5: Check User and Role models
    const UserModel = db.User || db.users;
    const RoleModel = db.Role || db.roles;
    
    if (!UserModel) {
      throw new Error('User model not found');
    }
    if (!RoleModel) {
      throw new Error('Role model not found');
    }
    
    console.log('✅ [Test] User and Role models found');
    
    // Test 6: Create admin role
    console.log('🔄 [Test] Creating admin role...');
    const [adminRole, roleCreated] = await RoleModel.findOrCreate({
      where: { name: 'admin' },
      defaults: {
        name: 'admin',
        description: 'Administrator role with full access',
        permissions: { all: true }
      }
    });
    
    console.log(`✅ [Test] Admin role ${roleCreated ? 'created' : 'found'} with ID: ${adminRole.id}`);
    
    // Test 7: Check if admin user exists
    console.log('🔄 [Test] Checking for existing admin user...');
    const existingAdmin = await UserModel.findOne({
      where: { email: 'admin@dbx.com' }
    });
    
    if (existingAdmin) {
      console.log('⚠️  [Test] Admin user already exists');
      console.log('📋 [Test] Admin details:', {
        id: existingAdmin.id,
        email: existingAdmin.email,
        username: existingAdmin.username,
        role_id: existingAdmin.role_id
      });
      
      return {
        success: true,
        message: 'Admin user already exists',
        admin: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          username: existingAdmin.username,
          role_id: existingAdmin.role_id
        }
      };
    }
    
    // Test 8: Create admin user
    console.log('🔄 [Test] Creating admin user...');
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
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
    
    console.log('✅ [Test] Admin user created successfully');
    console.log('📋 [Test] Admin details:', {
      id: adminUser.id,
      email: adminUser.email,
      username: adminUser.username,
      role_id: adminUser.role_id
    });
    
    // Test 9: Verify admin user can be found
    console.log('🔄 [Test] Verifying admin user can be retrieved...');
    const verifyAdmin = await UserModel.findOne({
      where: { email: 'admin@dbx.com' }
    });
    
    if (!verifyAdmin) {
      throw new Error('Admin user was created but cannot be retrieved');
    }
    
    console.log('✅ [Test] Admin user verification successful');
    
    // Test 10: Test password comparison
    console.log('🔄 [Test] Testing password comparison...');
    const passwordMatch = await bcrypt.compare('dbxsupersecure', verifyAdmin.password);
    
    if (!passwordMatch) {
      throw new Error('Password comparison failed');
    }
    
    console.log('✅ [Test] Password comparison successful');
    
    return {
      success: true,
      message: 'Admin user created and verified successfully',
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role_id: adminUser.role_id,
        password_hash_length: adminUser.password.length
      },
      tests_passed: [
        'Database connection',
        'Model import',
        'Database sync',
        'Model validation',
        'Role creation',
        'User creation',
        'User verification',
        'Password comparison'
      ]
    };
    
  } catch (error) {
    console.error('❌ [Test] Error in admin creation test:', error);
    console.error('🔧 [Test] Error message:', error.message);
    console.error('📋 [Test] Stack trace:', error.stack);
    
    return {
      success: false,
      message: 'Admin creation test failed',
      error: error.message,
      stack: error.stack
    };
  }
}

// Run the test
if (require.main === module) {
  testAdminCreation()
    .then(result => {
      console.log('🎯 [Test] Final result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [Test] Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = testAdminCreation;

