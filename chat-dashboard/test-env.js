// Test script to verify environment variables
console.log('Environment variables check:');
console.log('PWD:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXT_PUBLIC_TRELLO_API_KEY:', process.env.NEXT_PUBLIC_TRELLO_API_KEY);
console.log('TRELLO_API_SECRET:', process.env.TRELLO_API_SECRET);
console.log('NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI:', process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI);

// Check if .env.local exists
const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env.local');
console.log('env.local exists:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
  console.log('env.local size:', fs.statSync(envPath).size);
}