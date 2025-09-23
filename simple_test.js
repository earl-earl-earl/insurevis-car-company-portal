const axios = require('axios');

async function testServer() {
  try {
    console.log('Testing server connection...');
    const response = await axios.get('http://localhost:8080/api/health');
    console.log('✅ Server is responding!');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Connection failed:');
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testServer();
