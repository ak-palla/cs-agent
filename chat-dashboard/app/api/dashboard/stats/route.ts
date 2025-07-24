/**
 * Dashboard Stats API for Mattermost Slash Commands
 * Protected endpoint that requires OAuth token
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerActivityProcessor } from '@/lib/server-activity-processor';
import { mattermostLogger } from '@/lib/logger';
import { tokens } from '../../../oauth/token/route';

const serverProcessor = new ServerActivityProcessor();

export async function GET(request: NextRequest) {
  try {
    // Check for OAuth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'unauthorized',
        message: 'Bearer token required'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Validate token
    const tokenInfo = tokens.get(token);
    if (!tokenInfo) {
      mattermostLogger.warn('Invalid OAuth token used', { token: token.substring(0, 8) + '...' });
      return NextResponse.json({
        error: 'invalid_token',
        message: 'Invalid or expired token'
      }, { status: 401 });
    }

    // Check if token is expired (1 hour)
    if (Date.now() - tokenInfo.createdAt > 60 * 60 * 1000) {
      tokens.delete(token);
      return NextResponse.json({
        error: 'token_expired',
        message: 'Token has expired'
      }, { status: 401 });
    }

    mattermostLogger.info('Dashboard stats requested via OAuth', {
      clientId: tokenInfo.clientId
    });

    // Get dashboard statistics
    const [activityStats, executionStats] = await Promise.all([
      serverProcessor.getActivityStats('24h'),
      serverProcessor.getExecutionStats()
    ]);

    const stats = {
      timestamp: new Date().toISOString(),
      activities: {
        total_24h: activityStats?.total || 0,
        by_platform: activityStats?.by_platform || {},
        by_event_type: activityStats?.by_event_type || {}
      },
      workflows: {
        total: executionStats?.total || 0,
        pending: executionStats?.pending || 0,
        running: executionStats?.running || 0,
        completed: executionStats?.completed || 0,
        failed: executionStats?.failed || 0
      },
      summary: generateStatsSummary(activityStats, executionStats)
    };

    return NextResponse.json(stats);

  } catch (error) {
    mattermostLogger.error('Dashboard stats API error', {
      error: error instanceof Error ? error.message : error
    });

    return NextResponse.json({
      error: 'server_error',
      message: 'Failed to fetch dashboard statistics'
    }, { status: 500 });
  }
}

function generateStatsSummary(activityStats: any, executionStats: any): string {
  const totalActivities = activityStats?.total || 0;
  const totalExecutions = executionStats?.total || 0;
  const successRate = totalExecutions > 0 
    ? Math.round((executionStats?.completed || 0) / totalExecutions * 100)
    : 0;

  let summary = `📊 **Dashboard Summary (24h)**\n\n`;
  summary += `**Activities:** ${totalActivities} total\n`;
  
  if (activityStats?.by_platform) {
    const platforms = Object.entries(activityStats.by_platform)
      .map(([platform, count]) => `• ${platform}: ${count}`)
      .join('\n');
    if (platforms) {
      summary += `\n**By Platform:**\n${platforms}\n`;
    }
  }

  summary += `\n**Workflows:** ${totalExecutions} executions`;
  if (totalExecutions > 0) {
    summary += ` (${successRate}% success rate)`;
  }

  return summary;
}