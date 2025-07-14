/**
 * Database Diagnostics Script
 * Comprehensive analysis of production PostgreSQL schema
 */

async function runDatabaseDiagnostics() {
  try {
    console.log('🔍 [DB Diagnostics] Starting comprehensive database analysis...');
    
    const db = require('../models');
    const { QueryTypes } = require('sequelize');
    
    console.log('🔍 [DB Diagnostics] Testing database connection...');
    await db.sequelize.authenticate();
    console.log('✅ [DB Diagnostics] Database connection successful');
    
    const results = {
      connection: true,
      tables: {},
      models: {},
      associations: {},
      data_samples: {}
    };
    
    // 1. Check available models
    console.log('🔍 [DB Diagnostics] Checking available Sequelize models...');
    const availableModels = Object.keys(db).filter(key => 
      key !== 'Sequelize' && key !== 'sequelize'
    );
    results.models.available = availableModels;
    console.log('📋 [DB Diagnostics] Available models:', availableModels);
    
    // 2. Check users table structure
    console.log('🔍 [DB Diagnostics] Analyzing users table structure...');
    try {
      const usersTableInfo = await db.sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, { type: QueryTypes.SELECT });
      
      results.tables.users = {
        exists: true,
        columns: usersTableInfo,
        column_names: usersTableInfo.map(col => col.column_name)
      };
      
      console.log('✅ [DB Diagnostics] Users table found with columns:', 
        usersTableInfo.map(col => `${col.column_name} (${col.data_type})`));
      
      // Check specifically for role_id column
      const roleIdColumn = usersTableInfo.find(col => col.column_name === 'role_id');
      results.tables.users.role_id_exists = !!roleIdColumn;
      if (roleIdColumn) {
        console.log('✅ [DB Diagnostics] role_id column found:', roleIdColumn);
      } else {
        console.log('❌ [DB Diagnostics] role_id column NOT found in users table');
      }
      
    } catch (error) {
      console.log('❌ [DB Diagnostics] Users table analysis failed:', error.message);
      results.tables.users = { exists: false, error: error.message };
    }
    
    // 3. Check roles table structure
    console.log('🔍 [DB Diagnostics] Analyzing roles table structure...');
    try {
      const rolesTableInfo = await db.sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'roles' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, { type: QueryTypes.SELECT });
      
      results.tables.roles = {
        exists: true,
        columns: rolesTableInfo,
        column_names: rolesTableInfo.map(col => col.column_name)
      };
      
      console.log('✅ [DB Diagnostics] Roles table found with columns:', 
        rolesTableInfo.map(col => `${col.column_name} (${col.data_type})`));
      
    } catch (error) {
      console.log('❌ [DB Diagnostics] Roles table analysis failed:', error.message);
      results.tables.roles = { exists: false, error: error.message };
    }
    
    // 4. Check roles table data
    console.log('🔍 [DB Diagnostics] Checking roles table data...');
    try {
      const rolesData = await db.sequelize.query(`
        SELECT id, name, description FROM roles ORDER BY id;
      `, { type: QueryTypes.SELECT });
      
      results.data_samples.roles = rolesData;
      console.log('📋 [DB Diagnostics] Roles data:', rolesData);
      
      // Check for admin role and role with id 2
      const adminRole = rolesData.find(role => 
        role.name && role.name.toLowerCase().includes('admin')
      );
      const roleId2 = rolesData.find(role => role.id === 2);
      
      results.data_samples.admin_role_exists = !!adminRole;
      results.data_samples.role_id_2_exists = !!roleId2;
      
      if (adminRole) {
        console.log('✅ [DB Diagnostics] Admin role found:', adminRole);
      } else {
        console.log('⚠️ [DB Diagnostics] No admin role found');
      }
      
      if (roleId2) {
        console.log('✅ [DB Diagnostics] Role with ID 2 found:', roleId2);
      } else {
        console.log('⚠️ [DB Diagnostics] No role with ID 2 found');
      }
      
    } catch (error) {
      console.log('❌ [DB Diagnostics] Roles data check failed:', error.message);
      results.data_samples.roles_error = error.message;
    }
    
    // 5. Check users table data
    console.log('🔍 [DB Diagnostics] Checking users table data...');
    try {
      const usersData = await db.sequelize.query(`
        SELECT id, username, email, role_id FROM users LIMIT 5;
      `, { type: QueryTypes.SELECT });
      
      results.data_samples.users = usersData;
      console.log('📋 [DB Diagnostics] Users sample data:', usersData);
      
      // Check for existing admin user
      const adminUser = await db.sequelize.query(`
        SELECT id, username, email, role_id FROM users WHERE email = 'admin@dbx.com';
      `, { type: QueryTypes.SELECT });
      
      results.data_samples.admin_user_exists = adminUser.length > 0;
      if (adminUser.length > 0) {
        results.data_samples.admin_user = adminUser[0];
        console.log('✅ [DB Diagnostics] Admin user found:', adminUser[0]);
      } else {
        console.log('⚠️ [DB Diagnostics] Admin user not found');
      }
      
    } catch (error) {
      console.log('❌ [DB Diagnostics] Users data check failed:', error.message);
      results.data_samples.users_error = error.message;
    }
    
    // 6. Check foreign key constraints
    console.log('🔍 [DB Diagnostics] Checking foreign key constraints...');
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
      
      results.tables.foreign_keys = foreignKeys;
      console.log('📋 [DB Diagnostics] Foreign key constraints:', foreignKeys);
      
    } catch (error) {
      console.log('❌ [DB Diagnostics] Foreign key check failed:', error.message);
      results.tables.foreign_keys_error = error.message;
    }
    
    // 7. Test Sequelize model access
    console.log('🔍 [DB Diagnostics] Testing Sequelize model access...');
    try {
      if (db.User) {
        const userModelTest = await db.User.findAll({ limit: 1 });
        results.models.user_model_works = true;
        console.log('✅ [DB Diagnostics] User model accessible');
      } else {
        results.models.user_model_works = false;
        console.log('❌ [DB Diagnostics] User model not found');
      }
      
      if (db.Role) {
        const roleModelTest = await db.Role.findAll({ limit: 1 });
        results.models.role_model_works = true;
        console.log('✅ [DB Diagnostics] Role model accessible');
      } else {
        results.models.role_model_works = false;
        console.log('❌ [DB Diagnostics] Role model not found');
      }
      
    } catch (error) {
      console.log('❌ [DB Diagnostics] Model access test failed:', error.message);
      results.models.access_error = error.message;
    }
    
    console.log('🎯 [DB Diagnostics] Diagnostics completed successfully');
    return {
      success: true,
      message: 'Database diagnostics completed',
      results: results
    };
    
  } catch (error) {
    console.error('❌ [DB Diagnostics] Diagnostics failed:', error);
    return {
      success: false,
      message: 'Database diagnostics failed',
      error: error.message,
      stack: error.stack
    };
  }
}

module.exports = runDatabaseDiagnostics;

