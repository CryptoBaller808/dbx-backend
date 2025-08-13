/**
 * Add unique constraints migration
 * Ensures uniqueness for roles.name and Admins.email
 * Safe to run multiple times - ignores if constraints already exist
 */

module.exports = {
  up: async ({ context: queryInterface, Sequelize }) => {
    console.log('[MIGRATION] Adding unique constraints...');
    
    try {
      // Add unique constraint for roles.name
      await queryInterface.addConstraint('roles', {
        fields: ['name'],
        type: 'unique',
        name: 'roles_name_unique'
      });
      console.log('✅ [MIGRATION] Added unique constraint: roles_name_unique');
    } catch (error) {
      console.log('ℹ️ [MIGRATION] Unique constraint roles_name_unique already exists or failed:', error.message);
    }
    
    try {
      // Add unique constraint for Admins.email
      await queryInterface.addConstraint('Admins', {
        fields: ['email'],
        type: 'unique',
        name: 'admins_email_unique'
      });
      console.log('✅ [MIGRATION] Added unique constraint: admins_email_unique');
    } catch (error) {
      console.log('ℹ️ [MIGRATION] Unique constraint admins_email_unique already exists or failed:', error.message);
    }
    
    console.log('[MIGRATION] Unique constraints migration completed');
  },

  down: async ({ context: queryInterface }) => {
    console.log('[MIGRATION] Removing unique constraints...');
    
    try {
      await queryInterface.removeConstraint('roles', 'roles_name_unique');
      console.log('✅ [MIGRATION] Removed unique constraint: roles_name_unique');
    } catch (error) {
      console.log('ℹ️ [MIGRATION] Could not remove roles_name_unique:', error.message);
    }
    
    try {
      await queryInterface.removeConstraint('Admins', 'admins_email_unique');
      console.log('✅ [MIGRATION] Removed unique constraint: admins_email_unique');
    } catch (error) {
      console.log('ℹ️ [MIGRATION] Could not remove admins_email_unique:', error.message);
    }
    
    console.log('[MIGRATION] Unique constraints rollback completed');
  }
};

