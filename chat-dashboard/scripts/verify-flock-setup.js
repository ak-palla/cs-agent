const https = require('https');
const http = require('http');

const LOCAL_URL = 'http://localhost:3000/api/flock/app-install';
const TEST_URL = 'http://localhost:3000/api/test-app-install';

console.log('🔍 Verifying Flock integration setup...');

// Test local endpoints
function testEndpoint(url, description) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url + '?challenge=test123', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const success = res.statusCode === 200 && data === 'test123';
        resolve({
          url,
          status: res.statusCode,
          response: data,
          success
        });
      });
    }).on('error', (err) => {
      resolve({
        url,
        error: err.message,
        success: false
      });
    });
  });
}

async function verifySetup() {
  console.log('📋 Testing local endpoints...');
  
  const results = await Promise.all([
    testEndpoint(LOCAL_URL, 'Flock webhook'),
    testEndpoint(TEST_URL, 'Test endpoint')
  ]);
  
  console.log('');
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.url}: OK`);
    } else {
      console.log(`❌ ${result.url}: ${result.error || result.response}`);
    }
  });
  
  console.log('');
  console.log('🎯 Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Run: ./scripts/start-with-ngrok.sh');
  console.log('3. Copy the ngrok URL');
  console.log('4. Configure in Flock dev dashboard');
}

verifySetup();