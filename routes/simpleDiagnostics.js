/**
 * Simple Database Diagnostics Route
 * Basic schema analysis that works in production environment
 */

const express = require('express');
const router = express.Router();

// Simple database schema check
router.get('/schema', async (req, res) => {
  try {
    console.log('🔍 [Simple Diagnostics] Starting schema analysis...');
    
    const db = require('../models');
    const { QueryTypes } = require('sequelize');
    
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ [Simple Diagnostics] Database connection successful');
    
    const results = {};
    
    // Check users table structure
    console.log('🔍 [Simple Diagnostics] Checking users table...');
    try {
      const usersColumns = await db.sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, { type: QueryTypes.SELECT });
      
      results.users_table = {
        exists: true,
        columns: usersColumns.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default
        })),
        role_id_exists: usersColumns.some(col => col.column_name === 'role_id')
      };
      
      console.log('✅ [Simple Diagnostics] Users table columns:', 
        usersColumns.map(col => col.column_name).join(', '));
      
    } catch (error) {
      console.log('❌ [Simple Diagnostics] Users table check failed:', error.message);
      results.users_table = { exists: false, error: error.message };
    }
    
    // Check roles table structure
    console.log('🔍 [Simple Diagnostics] Checking roles table...');
    try {
      const rolesColumns = await db.sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'roles' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, { type: QueryTypes.SELECT });
      
      results.roles_table = {
        exists: true,
        columns: rolesColumns.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default
        }))
      };
      
      console.log('✅ [Simple Diagnostics] Roles table columns:', 
        rolesColumns.map(col => col.column_name).join(', '));
      
    } catch (error) {
      console.log('❌ [Simple Diagnostics] Roles table check failed:', error.message);
      results.roles_table = { exists: false, error: error.message };
    }
    
    // Check roles data
    console.log('🔍 [Simple Diagnostics] Checking roles data...');
    try {
      const rolesData = await db.sequelize.query(`
        SELECT id, name, description FROM roles ORDER BY id;
      `, { type: QueryTypes.SELECT });
      
      results.roles_data = {
        count: rolesData.length,
        roles: rolesData,
        has_admin_role: rolesData.some(role => 
          role.name && role.name.toLowerCase().includes('admin')
        ),
        has_role_id_2: rolesData.some(role => role.id === 2)
      };
      
      console.log('✅ [Simple Diagnostics] Roles found:', rolesData);
      
    } catch (error) {
      console.log('❌ [Simple Diagnostics] Roles data check failed:', error.message);
      results.roles_data = { error: error.message };
    }
    
    // Check users data
    console.log('🔍 [Simple Diagnostics] Checking users data...');
    try {
      const usersCount = await db.sequelize.query(`
        SELECT COUNT(*) as count FROM users;
      `, { type: QueryTypes.SELECT });
      
      const adminUser = await db.sequelize.query(`
        SELECT id, username, email, role_id FROM users WHERE email = 'admin@dbx.com';
      `, { type: QueryTypes.SELECT });
      
      results.users_data = {
        total_count: usersCount[0].count,
        admin_user_exists: adminUser.length > 0,
        admin_user: adminUser.length > 0 ? adminUser[0] : null
      };
      
      console.log('✅ [Simple Diagnostics] Users count:', usersCount[0].count);
      if (adminUser.length > 0) {
        console.log('✅ [Simple Diagnostics] Admin user found:', adminUser[0]);
      } else {
        console.log('⚠️ [Simple Diagnostics] Admin user not found');
      }
      
    } catch (error) {
      console.log('❌ [Simple Diagnostics] Users data check failed:', error.message);
      results.users_data = { error: error.message };
    }
    
    // Check foreign key constraints
    console.log('🔍 [Simple Diagnostics] Checking foreign key constraints...');
    try {
      const foreignKeys = await db.sequelize.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name IN ('users', 'roles');
      `, { type: QueryTypes.SELECT });
      
      results.foreign_keys = foreignKeys;
      console.log('✅ [Simple Diagnostics] Foreign keys:', foreignKeys);
      
    } catch (error) {
      console.log('❌ [Simple Diagnostics] Foreign key check failed:', error.message);
      results.foreign_keys = { error: error.message };
    }
    
    console.log('🎯 [Simple Diagnostics] Schema analysis completed');
    
    res.json({
      success: true,
      message: 'Database schema analysis completed',
      results: results
    });
    
  } catch (error) {
    console.error('❌ [Simple Diagnostics] Schema analysis failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database schema analysis failed',
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;

