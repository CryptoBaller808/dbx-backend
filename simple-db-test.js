// Standalone database diagnostics script
const { Sequelize } = require('sequelize');

async function testDatabase() {
  console.log('🔍 Starting database diagnostics...');
  
  const report = {
    success: false,
    timestamp: new Date().toISOString(),
    environment: {
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not found'
    },
    connection: {},
    tables: {},
    errors: []
  };
  
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      report.errors.push('DATABASE_URL environment variable not found');
      console.log('❌ DATABASE_URL not found');
      return report;
    }
    
    console.log('✅ DATABASE_URL found');
    
    // Try to load Sequelize and connect
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
    
    // Test connection
    await sequelize.authenticate();
    report.connection.status = 'successful';
    report.connection.dialect = 'postgres';
    console.log('✅ Database connection successful');
    
    // Check users table
    try {
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      
      if (tableCheck.length > 0) {
        console.log('✅ Users table exists');
        report.tables.users = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        report.tables.users.columns = columnInfo.map(col => col.column_name);
        report.tables.users.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          email: columnInfo.some(col => col.column_name === 'email'),
          password: columnInfo.some(col => col.column_name === 'password'),
          role_id: columnInfo.some(col => col.column_name === 'role_id')
        };
        
        console.log('📋 Users table columns:', report.tables.users.columns);
        console.log('✅ Required columns check:', report.tables.users.required_columns);
        
        // Get user count
        const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
        report.tables.users.count = parseInt(userCount[0].count);
        console.log(`📊 Users count: ${report.tables.users.count}`);
        
        // Check for admin user
        const [adminCheck] = await sequelize.query("SELECT id, email FROM users WHERE email = 'admin@dbx.com'");
        report.tables.users.admin_exists = adminCheck.length > 0;
        if (adminCheck.length > 0) {
          report.tables.users.admin_user = adminCheck[0];
          console.log('✅ Admin user exists:', adminCheck[0]);
        } else {
          console.log('❌ Admin user does not exist');
        }
      } else {
        console.log('❌ Users table does not exist');
        report.tables.users = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      console.log('❌ Users table error:', error.message);
      report.tables.users = { exists: false, error: error.message };
    }
    
    // Check roles table
    try {
      const [tableCheck] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      `);
      
      if (tableCheck.length > 0) {
        console.log('✅ Roles table exists');
        report.tables.roles = { exists: true };
        
        // Get column information
        const [columnInfo] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'roles'
          ORDER BY ordinal_position
        `);
        
        report.tables.roles.columns = columnInfo.map(col => col.column_name);
        report.tables.roles.required_columns = {
          id: columnInfo.some(col => col.column_name === 'id'),
          name: columnInfo.some(col => col.column_name === 'name')
        };
        
        console.log('📋 Roles table columns:', report.tables.roles.columns);
        console.log('✅ Required columns check:', report.tables.roles.required_columns);
        
        // Get roles data
        const [rolesData] = await sequelize.query('SELECT id, name FROM roles ORDER BY id');
        report.tables.roles.data = rolesData;
        report.tables.roles.admin_role_exists = rolesData.some(role => role.name === 'admin');
        report.tables.roles.role_id_2_exists = rolesData.some(role => role.id === 2);
        
        console.log('📊 Roles data:', rolesData);
        console.log('✅ Admin role exists:', report.tables.roles.admin_role_exists);
        console.log('✅ Role ID 2 exists:', report.tables.roles.role_id_2_exists);
      } else {
        console.log('❌ Roles table does not exist');
        report.tables.roles = { exists: false, error: 'Table not found' };
      }
      
    } catch (error) {
      console.log('❌ Roles table error:', error.message);
      report.tables.roles = { exists: false, error: error.message };
    }
    
    await sequelize.close();
    report.success = true;
    console.log('🎉 Database diagnostics completed successfully');
    
  } catch (error) {
    report.errors.push(`Connection error: ${error.message}`);
    report.connection.status = 'failed';
    console.error('❌ Database diagnostics failed:', error);
  }
  
  return report;
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDatabase()
    .then(report => {
      console.log('\n📋 FINAL REPORT:');
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testDatabase };

