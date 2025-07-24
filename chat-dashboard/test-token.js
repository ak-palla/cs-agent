/**
 * Token validation test
 * Run: node test-token.js YOUR_TOKEN_HERE
 */

const https = require('https');

const token = process.argv[2];
if (!token) {
  console.log('Usage: node test-token.js YOUR_TOKEN');
  process.exit(1);
}

console.log('Testing token:', token.substring(0, 8) + '...');

const options = {
  hostname: 'teams.webuildtrades.co',
  port: 443,
  path: '/api/v4/users/me',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      const user = JSON.parse(data);
      console.log('✅ Token is valid!');
      console.log(`User: ${user.username} (${user.email})`);
    } else {
      console.log('❌ Token is invalid or expired');
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();