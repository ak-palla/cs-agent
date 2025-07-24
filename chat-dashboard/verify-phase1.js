/**
 * Phase 1 Verification Script
 * Quick check to ensure all Phase 1 components are working
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Phase 1 Verification Starting...\n');

// Check 1: Verify all required files exist
const requiredFiles = [
  'lib/logger.ts',
  'lib/enhanced-mattermost-client.ts',
  'contexts/WebSocketContext.tsx',
  'lib/server-activity-processor.ts',
  'app/api/admin/activities/store/route.ts',
  'PHASE1_TESTING_GUIDE.md'
];

console.log('📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check 2: Verify package.json has required dependencies
console.log('\n📦 Checking dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = ['@mattermost/client', 'ws', '@types/ws'];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep}`);
  } else {
    console.log(`❌ ${dep} - MISSING`);
    allFilesExist = false;
  }
});

// Check 3: Verify WebSocketContext doesn't have old references
console.log('\n🔧 Checking WebSocketContext...');
const wsContextContent = fs.readFileSync('contexts/WebSocketContext.tsx', 'utf8');

if (wsContextContent.includes('wsManager') && !wsContextContent.includes('mattermostClient')) {
  console.log('❌ WebSocketContext still has old wsManager references');
  allFilesExist = false;
} else if (wsContextContent.includes('mattermostClient')) {
  console.log('✅ WebSocketContext updated to use mattermostClient');
} else {
  console.log('⚠️  WebSocketContext structure unclear');
}

// Check 4: Verify logger is properly imported
console.log('\n📝 Checking logging setup...');
const loggerContent = fs.readFileSync('lib/logger.ts', 'utf8');

if (loggerContent.includes('export class Logger') && loggerContent.includes('mattermostLogger')) {
  console.log('✅ Logger class and pre-configured loggers available');
} else {
  console.log('❌ Logger setup incomplete');
  allFilesExist = false;
}

// Check 5: Verify enhanced client exists
console.log('\n🚀 Checking Enhanced Mattermost Client...');
const clientContent = fs.readFileSync('lib/enhanced-mattermost-client.ts', 'utf8');

if (clientContent.includes('EnhancedMattermostClient') && clientContent.includes('@mattermost/client')) {
  console.log('✅ Enhanced Mattermost Client properly set up');
} else {
  console.log('❌ Enhanced Mattermost Client setup incomplete');
  allFilesExist = false;
}

// Final result
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 Phase 1 Verification PASSED!');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Open https://localhost:3000 in browser');
  console.log('3. Follow the PHASE1_TESTING_GUIDE.md');
  console.log('4. Check browser console and server logs');
} else {
  console.log('❌ Phase 1 Verification FAILED!');
  console.log('Please fix the missing components before testing.');
}
console.log('='.repeat(50));