'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🌱 [SEED] Starting admin user seeding...');
    
    try {
      // Check if admin user seeding is requested via environment variables
      const adminEmail = process.env.SEED_ADMIN_EMAIL;
      const adminPassword = process.env.SEED_ADMIN_PASSWORD;
      
      if (!adminEmail || !adminPassword) {
        console.log('ℹ️ [SEED] No admin credentials provided (SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD)');
        console.log('ℹ️ [SEED] Skipping admin user creation');
        return;
      }
      
      console.log(`🔐 [SEED] Creating admin user: ${adminEmail}`);
      
      // Check if admin user already exists
      const [existingUsers] = await queryInterface.sequelize.query(`
        SELECT id FROM users WHERE email = :email LIMIT 1
      `, {
        replacements: { email: adminEmail },
        type: queryInterface.sequelize.QueryTypes.SELECT
      });
      
      if (existingUsers.length > 0) {
        console.log('ℹ️ [SEED] Admin user already exists, skipping creation');
        return;
      }
      
      // Ensure admin role exists (should be created by core tables migration)
      const [adminRoles] = await queryInterface.sequelize.query(`
        SELECT id FROM roles WHERE name = 'admin' LIMIT 1
      `, {
        type: queryInterface.sequelize.QueryTypes.SELECT
      });
      
      if (adminRoles.length === 0) {
        console.log('⚠️ [SEED] Admin role not found, creating it...');
        await queryInterface.bulkInsert('roles', [{
          id: 1,
          name: 'admin',
          description: 'Administrator role with full access',
          permissions: JSON.stringify({ all: true }),
          created_at: new Date(),
          updated_at: new Date(),
        }]);
      }
      
      // Hash the password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
      
      // Create admin user
      await queryInterface.bulkInsert('users', [{
        username: adminEmail.split('@')[0] + '_admin', // Generate username from email
        email: adminEmail,
        password: hashedPassword,
        first_name: 'System',
        last_name: 'Administrator',
        role_id: 1, // Admin role
        status: 'active',
        email_verified: true,
        sanctions_checked: true,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
      
      console.log('✅ [SEED] Admin user created successfully');
      console.log('🔐 [SEED] Password has been securely hashed with bcrypt');
      console.log('⚠️ [SEED] IMPORTANT: Remove SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from environment after deployment for security');
      
    } catch (error) {
      console.error('❌ [SEED] Admin user seeding failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [SEED] Rolling back admin user seeding...');
    
    try {
      const adminEmail = process.env.SEED_ADMIN_EMAIL;
      
      if (adminEmail) {
        await queryInterface.bulkDelete('users', {
          email: adminEmail
        });
        console.log(`✅ [SEED] Admin user ${adminEmail} removed`);
      }
      
      console.log('✅ [SEED] Rollback completed');
      
    } catch (error) {
      console.error('❌ [SEED] Rollback failed:', error);
      throw error;
    }
  }
};

