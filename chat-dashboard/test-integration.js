/**
 * Simple integration test for the Enhanced Mattermost Client
 * Run this with: node test-integration.js
 */

const { Client4 } = require('@mattermost/client');

async function testMattermostConnection() {
  console.log('🧪 Testing Mattermost Integration...\n');

  // Test REST API connectivity
  const client = new Client4();
  client.setUrl('https://teams.webuildtrades.co');
  
  // You would need to replace this with a valid token for testing
  const testToken = process.env.MATTERMOST_TOKEN || 'your-token-here';
  
  if (testToken === 'your-token-here') {
    console.log('⚠️  To run this test, set MATTERMOST_TOKEN environment variable');
    console.log('   Example: MATTERMOST_TOKEN=your_token node test-integration.js');
    return;
  }
  
  client.setToken(testToken);

  try {
    console.log('📡 Testing REST API connection...');
    const user = await client.getMe();
    console.log('✅ REST API connection successful!');
    console.log(`   User: ${user.username} (${user.email})`);
    console.log(`   ID: ${user.id}`);
    
    console.log('\n📊 Testing teams retrieval...');
    const teams = await client.getTeamsForUser(user.id);
    console.log(`✅ Found ${teams.length} teams`);
    teams.forEach(team => {
      console.log(`   - ${team.display_name} (${team.name})`);
    });

    if (teams.length > 0) {
      console.log('\n📋 Testing channels retrieval...');
      const channels = await client.getChannelsForTeam(teams[0].id);
      console.log(`✅ Found ${channels.length} channels in ${teams[0].display_name}`);
      channels.slice(0, 5).forEach(channel => {
        console.log(`   - ${channel.display_name} (${channel.name})`);
      });
    }

    console.log('\n🎉 All tests passed! The enhanced Mattermost client is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.status_code) {
      console.error(`   Status: ${error.status_code}`);
    }
    if (error.message.includes('Invalid or expired session')) {
      console.error('   💡 Hint: Your token may be invalid or expired');
    }
  }
}

// Run the test
testMattermostConnection().catch(console.error);