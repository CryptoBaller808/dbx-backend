const bcrypt = require('bcrypt');
const db = require('./models');

async function resetAdminPassword() {
  console.log('🔐 Resetting admin password using models...');
  
  const newPassword = 'Admin@2025';
  console.log('📝 New password:', newPassword);
  
  try {
    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔒 Password hashed successfully');
    console.log('Hash preview:', hashedPassword.substring(0, 30) + '...');
    
    // Initialize database connection
    console.log('🔌 Initializing database connection...');
    await db.sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Find admin user
    console.log('👤 Finding admin user...');
    const adminUser = await db.users.findOne({
      where: { email: 'admin@dbx.com' }
    });
    
    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    console.log('📊 Current admin user:');
    console.log(`  - ID: ${adminUser.id}`);
    console.log(`  - Email: ${adminUser.email}`);
    console.log(`  - Role ID: ${adminUser.role_id}`);
    console.log(`  - Current password hash: ${adminUser.password.substring(0, 20)}...`);
    
    // Update password
    console.log('🔄 Updating admin password...');
    adminUser.password = hashedPassword;
    await adminUser.save();
    
    console.log('✅ Admin password updated successfully');
    
    // Verify the update
    console.log('🔍 Verifying password update...');
    const isValid = await bcrypt.compare(newPassword, adminUser.password);
    console.log('🔍 Password verification test:', isValid ? '✅ VALID' : '❌ INVALID');
    
    if (isValid) {
      console.log('🎉 Password reset completed successfully!');
      console.log('📧 Login credentials:');
      console.log(`   Email: admin@dbx.com`);
      console.log(`   Password: ${newPassword}`);
    } else {
      console.log('❌ Password verification failed!');
    }
    
  } catch (error) {
    console.error('❌ Error during password reset:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

resetAdminPassword().catch(console.error);
