const bcrypt = require('bcrypt');
const axios = require('axios');

async function testAdminLogin() {
  console.log('🔍 Testing admin login functionality...');
  
  // The password hash from the database
  const storedHash = '$2a$10$rOvHjHcw/c1q.Aq8Q2FdUeJ8H7ScqXxqWxG7tJ9kGqE8mNvZxQK4G';
  
  // Common passwords to test
  const testPasswords = ['admin', 'password', 'admin123', 'dbx123', 'Admin123'];
  
  console.log('🔐 Testing password combinations...');
  
  for (const password of testPasswords) {
    const isMatch = await bcrypt.compare(password, storedHash);
    console.log(`Password "${password}": ${isMatch ? '✅ MATCH' : '❌ No match'}`);
    
    if (isMatch) {
      console.log(`\n🎉 Found matching password: "${password}"`);
      
      // Test the login endpoint
      console.log('🌐 Testing login endpoint...');
      
      try {
        const response = await axios.post('https://dbx-backend.onrender.com/admindashboard/user/loginAdmin', {
          email: 'admin@dbx.com',
          password: password
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Login successful!');
        console.log('Response:', response.data);
        
        if (response.data.token) {
          console.log('🔑 JWT Token received:', response.data.token.substring(0, 50) + '...');
        }
        
      } catch (error) {
        console.log('❌ Login failed:');
        if (error.response) {
          console.log('Status:', error.response.status);
          console.log('Data:', error.response.data);
        } else {
          console.log('Error:', error.message);
        }
      }
      
      break;
    }
  }
}

testAdminLogin().catch(console.error);
