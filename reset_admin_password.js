const bcrypt = require('bcrypt');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

async function resetAdminPassword() {
  console.log('🔐 Resetting admin password to secure value...');
  
  // New secure password
  const newPassword = 'Admin@2025';
  console.log('📝 New password:', newPassword);
  
  // Hash password with bcrypt (10 salt rounds)
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  console.log('🔒 Password hashed successfully');
  console.log('Hash preview:', hashedPassword.substring(0, 30) + '...');
  
  try {
    // Connect to database with proper environment loading
    console.log('🔌 Connecting to database...');
    
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });

    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // First, check the current database schema for users table
    console.log('🔍 Checking users table schema...');
    
    const [tableInfo] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Users table columns:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check for timestamp column naming
    const hasCreatedAt = tableInfo.some(col => col.column_name === 'created_at');
    const hasUpdatedAt = tableInfo.some(col => col.column_name === 'updated_at');
    const hasCreatedAtCamel = tableInfo.some(col => col.column_name === 'createdAt');
    const hasUpdatedAtCamel = tableInfo.some(col => col.column_name === 'updatedAt');
    
    console.log('🕐 Timestamp columns found:');
    console.log(`  - created_at: ${hasCreatedAt ? '✅' : '❌'}`);
    console.log(`  - updated_at: ${hasUpdatedAt ? '✅' : '❌'}`);
    console.log(`  - createdAt: ${hasCreatedAtCamel ? '✅' : '❌'}`);
    console.log(`  - updatedAt: ${hasUpdatedAtCamel ? '✅' : '❌'}`);

    // Get current admin user data
    console.log('👤 Checking current admin user...');
    const [currentAdmin] = await sequelize.query(`
      SELECT id, email, password, role_id, 
             ${hasCreatedAt ? 'created_at' : (hasCreatedAtCamel ? '"createdAt"' : 'NULL')} as created_at,
             ${hasUpdatedAt ? 'updated_at' : (hasUpdatedAtCamel ? '"updatedAt"' : 'NULL')} as updated_at
      FROM users 
      WHERE email = 'admin@dbx.com'
    `);
    
    if (currentAdmin.length === 0) {
      console.log('❌ Admin user not found!');
      await sequelize.close();
      return;
    }
    
    const admin = currentAdmin[0];
    console.log('📊 Current admin user:');
    console.log(`  - ID: ${admin.id}`);
    console.log(`  - Email: ${admin.email}`);
    console.log(`  - Role ID: ${admin.role_id}`);
    console.log(`  - Current password hash: ${admin.password.substring(0, 20)}...`);
    console.log(`  - Created: ${admin.created_at}`);
    console.log(`  - Updated: ${admin.updated_at}`);

    // Update admin password using direct SQL to avoid model issues
    console.log('🔄 Updating admin password...');
    
    const updateQuery = `
      UPDATE users 
      SET password = $1,
          ${hasUpdatedAt ? 'updated_at' : (hasUpdatedAtCamel ? '"updatedAt"' : 'updated_at')} = NOW()
      WHERE email = 'admin@dbx.com'
    `;
    
    await sequelize.query(updateQuery, {
      bind: [hashedPassword]
    });
    
    console.log('✅ Admin password updated successfully');

    // Verify the update
    console.log('🔍 Verifying password update...');
    const [updatedAdmin] = await sequelize.query(`
      SELECT id, email, password, role_id
      FROM users 
      WHERE email = 'admin@dbx.com'
    `);
    
    if (updatedAdmin.length > 0) {
      const verifyAdmin = updatedAdmin[0];
      console.log('📊 Updated admin user:');
      console.log(`  - ID: ${verifyAdmin.id}`);
      console.log(`  - Email: ${verifyAdmin.email}`);
      console.log(`  - Role ID: ${verifyAdmin.role_id}`);
      console.log(`  - New password hash: ${verifyAdmin.password.substring(0, 30)}...`);
      
      // Test password verification
      const isValid = await bcrypt.compare(newPassword, verifyAdmin.password);
      console.log('🔍 Password verification test:', isValid ? '✅ VALID' : '❌ INVALID');
      
      if (isValid) {
        console.log('🎉 Password reset completed successfully!');
        console.log('📧 Login credentials:');
        console.log(`   Email: admin@dbx.com`);
        console.log(`   Password: ${newPassword}`);
      } else {
        console.log('❌ Password verification failed!');
      }
    }
    
    await sequelize.close();
    console.log('🔌 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error during password reset:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

resetAdminPassword().catch(console.error);
