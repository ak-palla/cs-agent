import { NextRequest, NextResponse } from 'next/server';
import { serverActivityProcessor } from '@/lib/server-activity-processor';

/**
 * POST /api/mattermost/webhooks/callback
 * Handle incoming webhook events from Mattermost
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🔔 Mattermost webhook received:', {
      method: request.method,
      url: request.url,
      headers: headers,
      body: body ? body.substring(0, 500) : 'empty'
    });

    // Parse the webhook data
    let webhookData;
    try {
      webhookData = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.error('❌ Invalid JSON in Mattermost webhook:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Verify webhook token if configured
    const mattermostWebhookToken = process.env.MATTERMOST_WEBHOOK_TOKEN;
    if (mattermostWebhookToken) {
      const token = headers['authorization']?.replace('Bearer ', '') || 
                   headers['token'] || 
                   webhookData.token;
      
      if (token !== mattermostWebhookToken) {
        console.warn('❌ Mattermost webhook token verification failed');
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // Process the webhook event
    await processMattermostEvent(webhookData, headers);

    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error processing Mattermost webhook:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mattermost/webhooks/callback
 * Handle webhook verification from Mattermost
 */
export async function GET(request: NextRequest) {
  console.log('✅ Mattermost webhook validation request received');
  return NextResponse.json({
    success: true,
    message: 'Mattermost webhook endpoint is operational',
    timestamp: new Date().toISOString()
  });
}

/**
 * Process Mattermost webhook event and store in Supabase
 */
async function processMattermostEvent(webhookData: any, headers: Record<string, string>) {
  try {
    // Extract event information from Mattermost webhook data
    const event_type = determineEventType(webhookData);
    const user_id = webhookData.user_id || webhookData.user?.id;
    const channel_id = webhookData.channel_id || webhookData.channel?.id;
    const team_id = webhookData.team_id || webhookData.team?.id;
    const post_id = webhookData.post_id || webhookData.post?.id;

    // Store the activity in Supabase
    await serverActivityProcessor.storeActivity({
      platform: 'mattermost',
      event_type: event_type,
      user_id: user_id,
      channel_id: channel_id,
      data: {
        original_event: webhookData,
        headers: headers,
        team_id: team_id,
        post_id: post_id,
        timestamp: webhookData.timestamp || new Date().toISOString(),
        // Extract common Mattermost data fields
        text: webhookData.text,
        message: webhookData.message,
        post: webhookData.post,
        channel: webhookData.channel,
        team: webhookData.team,
        user: webhookData.user,
        file_ids: webhookData.file_ids,
        props: webhookData.props
      }
    });

    console.log(`✅ Mattermost event processed: ${event_type}`);

  } catch (error) {
    console.error('❌ Error processing Mattermost event:', error);
  }
}

/**
 * Determine event type from Mattermost webhook data
 */
function determineEventType(webhookData: any): string {
  // Check for explicit event type
  if (webhookData.event_type) {
    return webhookData.event_type;
  }

  // Determine based on webhook structure
  if (webhookData.post) {
    if (webhookData.post.update_at > webhookData.post.create_at) {
      return 'post_updated';
    }
    return 'post_created';
  }

  if (webhookData.channel) {
    return 'channel_event';
  }

  if (webhookData.team) {
    return 'team_event';
  }

  if (webhookData.user) {
    return 'user_event';
  }

  if (webhookData.file_ids && webhookData.file_ids.length > 0) {
    return 'file_uploaded';
  }

  // Check for outgoing webhook pattern
  if (webhookData.text && webhookData.user_name) {
    return 'message_sent';
  }

  return 'unknown';
}