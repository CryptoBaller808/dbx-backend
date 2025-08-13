'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('[MIGRATION] Adding role_id column to Admins table...');
      
      // 1. Ensure roles table exists and has required roles
      console.log('[MIGRATION] Ensuring roles exist...');
      await queryInterface.sequelize.query(`
        INSERT INTO roles (name, description, "createdAt", "updatedAt")
        VALUES 
          ('Admin', 'Administrator role with full access', NOW(), NOW()),
          ('User', 'Standard user role', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
      `, { transaction });
      
      // 2. Check if role_id column already exists
      const [columns] = await queryInterface.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Admins' AND column_name = 'role_id';
      `, { transaction });
      
      if (columns.length === 0) {
        console.log('[MIGRATION] Adding role_id column to Admins...');
        
        // 3. Add role_id column (nullable initially for safe migration)
        await queryInterface.addColumn('Admins', 'role_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Foreign key reference to roles table'
        }, { transaction });
        
        // 4. Add foreign key constraint
        console.log('[MIGRATION] Adding foreign key constraint...');
        await queryInterface.addConstraint('Admins', {
          fields: ['role_id'],
          type: 'foreign key',
          name: 'admins_role_id_fkey',
          references: {
            table: 'roles',
            field: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
        
        console.log('[MIGRATION] role_id column and FK constraint added successfully');
      } else {
        console.log('[MIGRATION] role_id column already exists, skipping column creation');
      }
      
      // 5. Backfill existing admins with Admin role
      console.log('[MIGRATION] Backfilling existing admins with Admin role...');
      const [updateResult] = await queryInterface.sequelize.query(`
        UPDATE "Admins" 
        SET role_id = (SELECT id FROM roles WHERE name = 'Admin' LIMIT 1)
        WHERE role_id IS NULL;
      `, { transaction });
      
      console.log(`[MIGRATION] Backfilled ${updateResult.rowCount || 0} admin records with Admin role`);
      
      // 6. Verify the migration worked
      const [verifyResult] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as admin_count
        FROM "Admins" a
        JOIN roles r ON a.role_id = r.id
        WHERE r.name = 'Admin';
      `, { transaction });
      
      const adminCount = verifyResult[0]?.admin_count || 0;
      console.log(`[MIGRATION] Verification: ${adminCount} admins now have Admin role`);
      
      await transaction.commit();
      console.log('[MIGRATION] Successfully added role_id to Admins with FK constraint and backfill');
      
    } catch (error) {
      await transaction.rollback();
      console.error('[MIGRATION] Failed to add role_id to Admins:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('[MIGRATION] Removing role_id column from Admins...');
      
      // 1. Remove foreign key constraint
      try {
        await queryInterface.removeConstraint('Admins', 'admins_role_id_fkey', { transaction });
        console.log('[MIGRATION] Foreign key constraint removed');
      } catch (error) {
        console.warn('[MIGRATION] Foreign key constraint may not exist:', error.message);
      }
      
      // 2. Remove role_id column
      try {
        await queryInterface.removeColumn('Admins', 'role_id', { transaction });
        console.log('[MIGRATION] role_id column removed');
      } catch (error) {
        console.warn('[MIGRATION] role_id column may not exist:', error.message);
      }
      
      await transaction.commit();
      console.log('[MIGRATION] Successfully removed role_id from Admins');
      
    } catch (error) {
      await transaction.rollback();
      console.error('[MIGRATION] Failed to remove role_id from Admins:', error.message);
      throw error;
    }
  }
};

