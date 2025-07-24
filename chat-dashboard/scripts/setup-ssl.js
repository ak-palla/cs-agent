const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '..', 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Generate self-signed certificates for localhost
const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.log('Generating SSL certificates for localhost...');
  
  try {
    // Try using mkcert first (better option)
    execSync('mkcert -version', { stdio: 'ignore' });
    execSync(`mkcert -key-file "${keyPath}" -cert-file "${certPath}" localhost 127.0.0.1`, {
      stdio: 'inherit'
    });
    console.log('✅ SSL certificates generated using mkcert');
  } catch (error) {
    console.log('mkcert not available, generating self-signed certificates...');
    
    // Fallback to openssl
    try {
      const opensslCommand = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=Local/L=Local/O=Dev/OU=Dev/CN=localhost"`;
      execSync(opensslCommand, { stdio: 'inherit' });
      console.log('✅ SSL certificates generated using openssl');
    } catch (opensslError) {
      console.error('❌ Failed to generate SSL certificates:', opensslError.message);
      process.exit(1);
    }
  }
} else {
  console.log('✅ SSL certificates already exist');
}

console.log('SSL certificates are ready at:');
console.log('Key:', keyPath);
console.log('Cert:', certPath);