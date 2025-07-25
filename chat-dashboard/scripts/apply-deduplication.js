#!/usr/bin/env node

/**
 * Script to apply the deduplication migration and verify results
 * This script helps test the deduplication fixes
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCurrentState() {
  console.log('🔍 Checking current activity state...');
  
  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ Error fetching activities:', error.message);
    return;
  }

  console.log(`📊 Found ${activities.length} recent activities`);
  
  // Group by message_id to find duplicates
  const messageGroups = {};
  activities.forEach(activity => {
    if (activity.data?.message_id) {
      const messageId = activity.data.message_id;
      if (!messageGroups[messageId]) {
        messageGroups[messageId] = [];
      }
      messageGroups[messageId].push(activity);
    }
  });

  const duplicates = Object.entries(messageGroups).filter(([_, group]) => group.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`⚠️ Found ${duplicates.length} messages with duplicate activities:`);
    duplicates.slice(0, 5).forEach(([messageId, group]) => {
      console.log(`  📝 Message ${messageId.slice(-8)}: ${group.length} duplicates`);
      console.log(`     Created at: ${group.map(g => new Date(g.created_at).toLocaleTimeString()).join(', ')}`);
    });
  } else {
    console.log('✅ No duplicate activities found!');
  }

  return { total: activities.length, duplicates: duplicates.length };
}

async function applyMigration() {
  console.log('🚀 Applying deduplication migration...');
  
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/002_deduplicate_activities.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📜 Executing ${statements.length} migration statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.includes('SELECT') || statement.includes('INSERT') || statement.includes('CREATE') || statement.includes('ALTER')) {
        try {
          console.log(`   ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error && !error.message.includes('already exists')) {
            console.warn(`   ⚠️ Statement warning:`, error.message);
          }
        } catch (err) {
          console.error(`   ❌ Statement error:`, err.message);
        }
      }
    }
    
    console.log('✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    throw error;
  }
}

async function testDeduplication() {
  console.log('🧪 Testing deduplication logic...');
  
  // Test inserting a duplicate activity
  const testActivity = {
    platform: 'mattermost',
    event_type: 'message_posted',
    user_id: 'test_user_123',
    channel_id: 'test_channel_456',
    data: {
      message_id: 'test_message_' + Date.now(),
      message: 'Test deduplication message',
      source: 'deduplication_test'
    },
    timestamp: new Date().toISOString()
  };

  // Insert the same activity twice
  console.log('📝 Inserting test activity (first time)...');
  const { data: first, error: error1 } = await supabase
    .from('activities')
    .insert(testActivity)
    .select()
    .single();

  if (error1) {
    console.error('❌ First insertion failed:', error1.message);
    return;
  }

  console.log('📝 Inserting test activity (second time - should be blocked)...');
  const { data: second, error: error2 } = await supabase
    .from('activities')
    .insert(testActivity)
    .select()
    .single();

  if (error2) {
    console.log('✅ Second insertion properly blocked:', error2.message);
  } else if (!second) {
    console.log('✅ Second insertion returned null (handled by trigger)');
  } else {
    console.warn('⚠️ Second insertion succeeded - deduplication may not be working');
  }

  // Clean up test data
  await supabase
    .from('activities')
    .delete()
    .eq('data->message_id', testActivity.data.message_id);

  console.log('🧹 Test data cleaned up');
}

async function getStats() {
  console.log('📊 Getting activity statistics...');
  
  try {
    const { data, error } = await supabase.rpc('get_activity_stats');
    
    if (error) {
      console.error('❌ Error getting stats:', error.message);
      return;
    }

    const stats = data[0];
    console.log(`📈 Activity Statistics:`);
    console.log(`   Total activities: ${stats.total_activities}`);
    console.log(`   Unique messages: ${stats.unique_messages}`);
    console.log(`   Duplicate ratio: ${stats.duplicate_ratio}%`);
    
    if (stats.duplicate_ratio > 5) {
      console.warn('⚠️ High duplicate ratio detected - migration may need to be re-run');
    } else {
      console.log('✅ Duplicate ratio is within acceptable range');
    }
    
  } catch (error) {
    console.warn('⚠️ Stats function may not be available yet');
  }
}

async function main() {
  try {
    console.log('🔧 Activity Deduplication Tool');
    console.log('==============================\n');
    
    // Check current state
    const beforeStats = await checkCurrentState();
    
    if (beforeStats.duplicates > 0) {
      console.log('\n🔄 Applying deduplication migration...');
      await applyMigration();
      
      // Wait a moment for the changes to take effect
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('\n🔍 Checking state after migration...');
      const afterStats = await checkCurrentState();
      
      if (afterStats.duplicates < beforeStats.duplicates) {
        console.log(`✅ Reduced duplicates from ${beforeStats.duplicates} to ${afterStats.duplicates}`);
      }
    } else {
      console.log('✅ No duplicates found, migration not needed');
    }
    
    // Test the deduplication logic
    console.log('\n🧪 Testing deduplication...');
    await testDeduplication();
    
    // Get final stats
    console.log('\n📊 Final statistics...');
    await getStats();
    
    console.log('\n🎉 Deduplication process completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your development server');
    console.log('   2. Send a test message in Mattermost');
    console.log('   3. Check the Activity Monitor for single entries');
    
  } catch (error) {
    console.error('\n❌ Error in main process:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { checkCurrentState, applyMigration, testDeduplication };