const bcrypt = require('bcrypt');
const { Sequelize, DataTypes } = require('sequelize');

async function createAdminWithPassword() {
  console.log('🔐 Creating admin user with known password...');
  
  // Use a simple, known password for testing
  const plainPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  
  console.log('📝 Password details:');
  console.log('Plain password:', plainPassword);
  console.log('Hashed password:', hashedPassword);
  
  try {
    // Connect to database
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
    console.log('✅ Database connected');

    // Update admin user password
    const [results] = await sequelize.query(`
      UPDATE users 
      SET password = '${hashedPassword}' 
      WHERE email = 'admin@dbx.com'
    `);
    
    console.log('✅ Admin password updated successfully');
    
    // Verify the update
    const [adminUser] = await sequelize.query(`
      SELECT id, email, password, role_id 
      FROM users 
      WHERE email = 'admin@dbx.com'
    `);
    
    if (adminUser.length > 0) {
      console.log('👤 Admin user details:');
      console.log('- ID:', adminUser[0].id);
      console.log('- Email:', adminUser[0].email);
      console.log('- Role ID:', adminUser[0].role_id);
      console.log('- Password hash updated:', adminUser[0].password.substring(0, 20) + '...');
      
      // Test password verification
      const isValid = await bcrypt.compare(plainPassword, adminUser[0].password);
      console.log('🔍 Password verification:', isValid ? '✅ VALID' : '❌ INVALID');
    }
    
    await sequelize.close();
    console.log('🔌 Database connection closed');
    
    console.log('\n🎉 Admin user ready for login!');
    console.log('📧 Email: admin@dbx.com');
    console.log('🔑 Password:', plainPassword);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createAdminWithPassword().catch(console.error);
