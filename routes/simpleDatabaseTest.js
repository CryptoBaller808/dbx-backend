const express = require('express');
const router = express.Router();

// Ultra-simple database test - just check environment and basic connection
router.get('/simple-test', async (req, res) => {
    console.log('🔍 Simple Database Test requested...');
    
    const report = {
        timestamp: new Date().toISOString(),
        environment: {
            database_url_exists: !!process.env.DATABASE_URL,
            database_url_length: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
            node_env: process.env.NODE_ENV || 'not set'
        },
        test_results: {}
    };
    
    try {
        // Just try to require Sequelize
        const { Sequelize } = require('sequelize');
        report.test_results.sequelize_available = true;
        
        if (process.env.DATABASE_URL) {
            // Try basic connection without any table operations
            const sequelize = new Sequelize(process.env.DATABASE_URL, {
                dialect: 'postgres',
                logging: false,
                dialectOptions: {
                    ssl: {
                        require: true,
                        rejectUnauthorized: false
                    }
                }
            });
            
            await sequelize.authenticate();
            report.test_results.connection_successful = true;
            
            // Try a very simple query
            const [results] = await sequelize.query("SELECT 1 as test");
            report.test_results.query_test = results[0].test === 1;
            
            await sequelize.close();
            report.test_results.connection_closed = true;
        } else {
            report.test_results.connection_successful = false;
            report.test_results.error = 'No DATABASE_URL';
        }
        
        report.success = true;
        
    } catch (error) {
        report.success = false;
        report.test_results.error = error.message;
        console.error('❌ Simple test failed:', error);
    }
    
    res.json(report);
});

module.exports = router;

