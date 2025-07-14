const { Sequelize } = require('sequelize');

// Safe schema introspection script - NO SYNC OR ALTER OPERATIONS
async function performSafeSchemaCheck() {
    console.log('🔍 Starting Safe Schema Introspection...');
    
    let sequelize;
    try {
        // Initialize Sequelize connection
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('DATABASE_URL environment variable not found');
        }
        
        console.log('✅ DATABASE_URL found, connecting...');
        sequelize = new Sequelize(databaseUrl, {
            dialect: 'postgres',
            logging: false, // Reduce noise
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            }
        });
        
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connection successful');
        
        const queryInterface = sequelize.getQueryInterface();
        
        // Check users table
        console.log('\n🔍 Checking USERS table...');
        try {
            const usersTableStructure = await queryInterface.describeTable('users');
            console.log('✅ USERS table exists');
            console.log('📋 USERS table columns:');
            
            const requiredUserColumns = ['id', 'email', 'password', 'role_id'];
            const foundUserColumns = Object.keys(usersTableStructure);
            
            console.log('   Found columns:', foundUserColumns);
            
            requiredUserColumns.forEach(col => {
                if (foundUserColumns.includes(col)) {
                    console.log(`   ✅ ${col}: EXISTS`);
                    console.log(`      Type: ${usersTableStructure[col].type}`);
                    console.log(`      Null: ${usersTableStructure[col].allowNull}`);
                    if (usersTableStructure[col].defaultValue !== undefined) {
                        console.log(`      Default: ${usersTableStructure[col].defaultValue}`);
                    }
                } else {
                    console.log(`   ❌ ${col}: MISSING`);
                }
            });
            
        } catch (error) {
            console.log('❌ USERS table does not exist or cannot be accessed');
            console.log('   Error:', error.message);
        }
        
        // Check roles table
        console.log('\n🔍 Checking ROLES table...');
        try {
            const rolesTableStructure = await queryInterface.describeTable('roles');
            console.log('✅ ROLES table exists');
            console.log('📋 ROLES table columns:');
            
            const requiredRoleColumns = ['id', 'name'];
            const foundRoleColumns = Object.keys(rolesTableStructure);
            
            console.log('   Found columns:', foundRoleColumns);
            
            requiredRoleColumns.forEach(col => {
                if (foundRoleColumns.includes(col)) {
                    console.log(`   ✅ ${col}: EXISTS`);
                    console.log(`      Type: ${rolesTableStructure[col].type}`);
                    console.log(`      Null: ${rolesTableStructure[col].allowNull}`);
                    if (rolesTableStructure[col].defaultValue !== undefined) {
                        console.log(`      Default: ${rolesTableStructure[col].defaultValue}`);
                    }
                } else {
                    console.log(`   ❌ ${col}: MISSING`);
                }
            });
            
            // Check for role data
            console.log('\n🔍 Checking ROLES data...');
            const [results] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
            if (results.length > 0) {
                console.log('✅ ROLES data found:');
                results.forEach(role => {
                    console.log(`   ID: ${role.id}, Name: ${role.name}`);
                    if (role.id === 2) {
                        console.log('   ✅ Admin role (ID: 2) exists');
                    }
                });
            } else {
                console.log('❌ ROLES table is empty');
            }
            
        } catch (error) {
            console.log('❌ ROLES table does not exist or cannot be accessed');
            console.log('   Error:', error.message);
        }
        
        // Check for any existing users
        console.log('\n🔍 Checking existing USERS data...');
        try {
            const [userResults] = await sequelize.query('SELECT id, email FROM users LIMIT 5');
            if (userResults.length > 0) {
                console.log('✅ USERS data found:');
                userResults.forEach(user => {
                    console.log(`   ID: ${user.id}, Email: ${user.email}`);
                });
            } else {
                console.log('ℹ️ USERS table exists but is empty');
            }
        } catch (error) {
            console.log('❌ Cannot query USERS data');
            console.log('   Error:', error.message);
        }
        
        console.log('\n🎯 Schema Introspection Complete');
        
    } catch (error) {
        console.error('❌ Schema introspection failed:', error.message);
        console.error('Full error:', error);
    } finally {
        if (sequelize) {
            await sequelize.close();
            console.log('✅ Database connection closed');
        }
    }
}

// Run the introspection
performSafeSchemaCheck()
    .then(() => {
        console.log('🎉 Safe schema check completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Safe schema check failed:', error);
        process.exit(1);
    });

