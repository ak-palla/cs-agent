const { spawn } = require('child_process');
const { execSync } = require('child_process');

console.log('🚀 Starting development server with ngrok...');

// Start ngrok on port 3000
const ngrok = spawn('ngrok', ['http', '3000'], { stdio: ['pipe', 'pipe', 'pipe'] });

ngrok.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('ngrok:', output);
  
  // Extract the public URL
  const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.ngrok\.io/);
  if (urlMatch) {
    const publicUrl = urlMatch[0];
    console.log('🌐 Public URL:', publicUrl);
    console.log('📋 Webhook URL to configure in Flock:', `${publicUrl}/api/flock/app-install`);
    console.log('📋 Test URL:', `${publicUrl}/api/test-app-install`);
  }
});

ngrok.stderr.on('data', (data) => {
  console.error('ngrok error:', data.toString());
});

// Start the Next.js development server
console.log('🎯 Starting Next.js server...');
const nextDev = spawn('npm', ['run', 'dev'], { 
  stdio: 'inherit',
  shell: true 
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down servers...');
  ngrok.kill();
  nextDev.kill();
  process.exit(0);
});

// Handle process termination
process.on('exit', () => {
  ngrok.kill();
  nextDev.kill();
});