/**
 * Simple Slash Command Handler (No OAuth Required)
 * Direct endpoint for Mattermost slash commands
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerActivityProcessor } from '@/lib/server-activity-processor';
import { mattermostLogger } from '@/lib/logger';

const serverProcessor = new ServerActivityProcessor();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const teamId = formData.get('team_id') as string;
    const teamDomain = formData.get('team_domain') as string;
    const channelId = formData.get('channel_id') as string;
    const channelName = formData.get('channel_name') as string;
    const userId = formData.get('user_id') as string;
    const userName = formData.get('user_name') as string;
    const command = formData.get('command') as string;
    const text = formData.get('text') as string;

    mattermostLogger.info('Slash command received', {
      command,
      text,
      userName,
      channelName,
      teamDomain
    });

    // Basic token validation (optional)
    const expectedToken = process.env.MATTERMOST_SLASH_TOKEN;
    if (expectedToken && token !== expectedToken) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: '❌ Invalid slash command token'
      });
    }

    // Parse command arguments
    const args = text?.trim().toLowerCase() || 'stats';

    let response;
    switch (args) {
      case 'stats':
      case '':
        response = await handleStatsCommand();
        break;
      case 'activities':
        response = await handleActivitiesCommand();
        break;
      case 'workflows':
        response = await handleWorkflowsCommand();
        break;
      case 'help':
        response = handleHelpCommand();
        break;
      default:
        response = {
          response_type: 'ephemeral',
          text: `❓ Unknown command: \`${args}\`\n\nUse \`/dashboard help\` for available commands.`
        };
    }

    return NextResponse.json(response);

  } catch (error) {
    mattermostLogger.error('Slash command error', {
      error: error instanceof Error ? error.message : error
    });

    return NextResponse.json({
      response_type: 'ephemeral',
      text: '❌ Error processing dashboard command. Please try again.'
    });
  }
}

async function handleStatsCommand() {
  try {
    const [activityStats, executionStats] = await Promise.all([
      serverProcessor.getActivityStats('24h'),
      serverProcessor.getExecutionStats()
    ]);

    const totalActivities = activityStats?.total || 0;
    const totalExecutions = executionStats?.total || 0;
    const successRate = totalExecutions > 0 
      ? Math.round((executionStats?.completed || 0) / totalExecutions * 100)
      : 0;

    let text = `## 📊 Dashboard Statistics (24h)\n\n`;
    text += `**Total Activities:** ${totalActivities}\n\n`;

    if (activityStats?.by_platform && Object.keys(activityStats.by_platform).length > 0) {
      text += `**By Platform:**\n`;
      Object.entries(activityStats.by_platform).forEach(([platform, count]) => {
        text += `• **${platform}:** ${count}\n`;
      });
      text += `\n`;
    }

    if (activityStats?.by_event_type && Object.keys(activityStats.by_event_type).length > 0) {
      text += `**By Event Type:**\n`;
      Object.entries(activityStats.by_event_type).slice(0, 5).forEach(([eventType, count]) => {
        text += `• **${eventType}:** ${count}\n`;
      });
      text += `\n`;
    }

    text += `**Workflow Executions:** ${totalExecutions}`;
    if (totalExecutions > 0) {
      text += ` (${successRate}% success rate)\n`;
      text += `• Completed: ${executionStats?.completed || 0}\n`;
      text += `• Failed: ${executionStats?.failed || 0}\n`;
      text += `• Running: ${executionStats?.running || 0}\n`;
      text += `• Pending: ${executionStats?.pending || 0}`;
    }

    return {
      response_type: 'in_channel',
      text
    };
  } catch (error) {
    return {
      response_type: 'ephemeral',
      text: '❌ Failed to fetch dashboard statistics.'
    };
  }
}

async function handleActivitiesCommand() {
  try {
    const activities = await serverProcessor.getRecentActivities(undefined, 10);
    
    if (!activities || activities.length === 0) {
      return {
        response_type: 'ephemeral',
        text: '📭 No recent activities found.'
      };
    }

    let text = `## 📋 Recent Activities (Last 10)\n\n`;
    activities.forEach((activity, index) => {
      const timestamp = new Date(activity.timestamp).toLocaleString();
      text += `${index + 1}. **${activity.event_type}** on *${activity.platform}*\n`;
      text += `   └ ${timestamp}\n`;
    });

    return {
      response_type: 'ephemeral',
      text
    };
  } catch (error) {
    return {
      response_type: 'ephemeral',
      text: '❌ Failed to fetch recent activities.'
    };
  }
}

async function handleWorkflowsCommand() {
  try {
    const stats = await serverProcessor.getExecutionStats();
    
    let text = `## ⚙️ Workflow Status\n\n`;
    text += `**Total Executions:** ${stats?.total || 0}\n`;
    text += `**Status Breakdown:**\n`;
    text += `• ✅ Completed: ${stats?.completed || 0}\n`;
    text += `• ❌ Failed: ${stats?.failed || 0}\n`;
    text += `• 🔄 Running: ${stats?.running || 0}\n`;
    text += `• ⏳ Pending: ${stats?.pending || 0}\n`;

    if (stats?.total && stats.total > 0) {
      const successRate = Math.round((stats.completed / stats.total) * 100);
      text += `\n**Success Rate:** ${successRate}%`;
    }

    return {
      response_type: 'in_channel',
      text
    };
  } catch (error) {
    return {
      response_type: 'ephemeral',
      text: '❌ Failed to fetch workflow status.'
    };
  }
}

function handleHelpCommand() {
  const text = `## 🤖 Dashboard Commands\n\n` +
    `**/dashboard stats** - Show dashboard statistics\n` +
    `**/dashboard activities** - Show recent activities\n` +
    `**/dashboard workflows** - Show workflow status\n` +
    `**/dashboard help** - Show this help message\n\n` +
    `*Commands marked with 📊 will be visible to the channel.*`;

  return {
    response_type: 'ephemeral',
    text
  };
}