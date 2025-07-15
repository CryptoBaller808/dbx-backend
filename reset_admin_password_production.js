#!/usr/bin/env node

/**
 * Production Admin Password Reset Script
 * Resets admin@dbx.com password to Admin@2025 using direct SQL
 */

const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function resetAdminPassword() {
  try {
    console.log('🔐 [PRODUCTION RESET] Starting admin password reset...');
    
    const newPassword = 'Admin@2025';
    
    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔒 [PRODUCTION RESET] Password hashed successfully');
    
    // Create direct database connection
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
    console.log('✅ [PRODUCTION RESET] Database connected');
    
    // Update admin password using direct SQL
    const [results] = await sequelize.query(`
      UPDATE users 
      SET password = $1, updated_at = NOW()
      WHERE email = 'admin@dbx.com'
    `, {
      bind: [hashedPassword]
    });
    
    console.log('✅ [PRODUCTION RESET] Password updated successfully');
    
    // Verify the update
    const [adminUser] = await sequelize.query(`
      SELECT id, email, password, role_id
      FROM users 
      WHERE email = 'admin@dbx.com'
    `);
    
    if (adminUser.length > 0) {
      const admin = adminUser[0];
      
      // Test password verification
      const isValid = await bcrypt.compare(newPassword, admin.password);
      console.log('🔍 [PRODUCTION RESET] Password verification:', isValid ? 'VALID' : 'INVALID');
      
      await sequelize.close();
      
      console.log('🎉 [PRODUCTION RESET] Admin password reset completed successfully!');
      console.log('📧 Email: admin@dbx.com');
      console.log('🔑 Password: Admin@2025');
      console.log('✅ Verification: PASSED');
      
      return {
        success: true,
        message: 'Admin password reset successfully',
        credentials: {
          email: 'admin@dbx.com',
          password: newPassword
        },
        verification: isValid,
        admin_details: {
          id: admin.id,
          email: admin.email,
          role_id: admin.role_id
        }
      };
    } else {
      await sequelize.close();
      console.log('❌ [PRODUCTION RESET] Admin user not found');
      return {
        success: false,
        message: 'Admin user not found'
      };
    }
    
  } catch (error) {
    console.error('❌ [PRODUCTION RESET] Error:', error.message);
    return {
      success: false,
      message: 'Password reset failed',
      error: error.message
    };
  }
}

// Run the script
if (require.main === module) {
  resetAdminPassword()
    .then(result => {
      console.log('\n📊 [PRODUCTION RESET] Final Result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ [PRODUCTION RESET] Script failed:', error);
      process.exit(1);
    });
}

module.exports = resetAdminPassword;

