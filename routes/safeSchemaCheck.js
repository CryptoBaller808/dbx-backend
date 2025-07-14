const express = require('express');
const router = express.Router();

// Simple safe schema introspection route
router.get('/safe-schema-check', async (req, res) => {
    console.log('🔍 Safe Schema Check requested...');
    
    const report = {
        success: false,
        timestamp: new Date().toISOString(),
        database_url_exists: false,
        connection_test: false,
        tables: {},
        errors: []
    };
    
    try {
        // Check if DATABASE_URL exists
        const databaseUrl = process.env.DATABASE_URL;
        report.database_url_exists = !!databaseUrl;
        
        if (!databaseUrl) {
            report.errors.push('DATABASE_URL environment variable not found');
            return res.json(report);
        }
        
        // Try to load Sequelize
        const { Sequelize } = require('sequelize');
        
        const sequelize = new Sequelize(databaseUrl, {
            dialect: 'postgres',
            logging: false,
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            }
        });
        
        // Test basic connection
        await sequelize.authenticate();
        report.connection_test = true;
        console.log('✅ Database connection successful');
        
        const queryInterface = sequelize.getQueryInterface();
        
        // Check users table
        try {
            const usersStructure = await queryInterface.describeTable('users');
            report.tables.users = {
                exists: true,
                columns: Object.keys(usersStructure),
                has_id: 'id' in usersStructure,
                has_email: 'email' in usersStructure,
                has_password: 'password' in usersStructure,
                has_role_id: 'role_id' in usersStructure,
                structure: usersStructure
            };
            
            // Get user count
            const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
            report.tables.users.count = parseInt(userCount[0].count);
            
        } catch (error) {
            report.tables.users = {
                exists: false,
                error: error.message
            };
        }
        
        // Check roles table
        try {
            const rolesStructure = await queryInterface.describeTable('roles');
            report.tables.roles = {
                exists: true,
                columns: Object.keys(rolesStructure),
                has_id: 'id' in rolesStructure,
                has_name: 'name' in rolesStructure,
                structure: rolesStructure
            };
            
            // Get roles data
            const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
            report.tables.roles.data = rolesData;
            report.tables.roles.admin_role_exists = rolesData.some(role => role.id === 2);
            
        } catch (error) {
            report.tables.roles = {
                exists: false,
                error: error.message
            };
        }
        
        await sequelize.close();
        report.success = true;
        
    } catch (error) {
        report.errors.push(`Main error: ${error.message}`);
        console.error('❌ Schema check failed:', error);
    }
    
    res.json(report);
});

module.exports = router;

