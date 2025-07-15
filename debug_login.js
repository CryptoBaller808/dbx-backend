const axios = require('axios');

async function debugLogin() {
  console.log('🔍 Debugging admin login...');
  
  try {
    const response = await axios.post('https://dbx-backend.onrender.com/admindashboard/user/loginAdmin', {
      email: 'admin@dbx.com',
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return status < 600; // Accept any status code less than 600
      }
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Data:', response.data);
    
    if (response.data.access_token) {
      console.log('🔑 JWT Token received!');
      console.log('Token preview:', response.data.access_token.substring(0, 50) + '...');
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

debugLogin();
