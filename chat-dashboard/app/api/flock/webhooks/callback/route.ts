import { NextRequest, NextResponse } from 'next/server';
import { serverActivityProcessor } from '@/lib/server-activity-processor';

/**
 * POST /api/flock/webhooks/callback
 * Handle Flock webhook events and validation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🔔 Flock Webhook received:', {
      method: request.method,
      url: request.url,
      headers: headers,
      body: body ? body.substring(0, 500) : 'empty'
    });

    // Handle different types of webhook events
    let eventData;
    try {
      eventData = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.log('📄 Webhook body is not JSON, treating as text:', body);
      eventData = { rawBody: body };
    }

    // Log the event for debugging
    console.log('🔔 Flock Event Data:', eventData);

    // Process and store the event if it's a valid Flock event
    await processFlockEvent(eventData, headers);

    // Respond with 200 OK to acknowledge receipt
    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('💥 Error processing Flock webhook:', error);
    
    // Still return 200 OK to prevent Flock from retrying
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }
}

/**
 * GET /api/flock/webhooks/callback
 * Handle validation requests from Flock
 */
export async function GET(request: NextRequest) {
  console.log('✅ Flock webhook validation request received');
  
  // Return 200 OK for webhook URL validation
  return NextResponse.json({
    success: true,
    message: 'Flock webhook endpoint is operational',
    timestamp: new Date().toISOString()
  }, { status: 200 });
}

/**
 * Process Flock webhook event and store in Supabase
 */
async function processFlockEvent(eventData: any, headers: Record<string, string>) {
  try {
    // Skip processing if it's just a raw body or empty event
    if (!eventData || eventData.rawBody || Object.keys(eventData).length === 0) {
      console.log('⏭️ Skipping empty or raw body event');
      return;
    }

    // Extract event information from Flock webhook data
    // Flock webhook format may vary, so we'll handle common structures
    const event_type = eventData.type || eventData.event || eventData.action || 'unknown';
    const user_id = eventData.user?.id || eventData.userId || eventData.from?.id;
    const channel_id = eventData.channel?.id || eventData.channelId || eventData.to?.id;

    // Determine event type based on Flock webhook structure
    let standardizedEventType = event_type;
    
    // Map common Flock events to standardized names
    if (eventData.message) {
      standardizedEventType = 'message_created';
    } else if (eventData.file) {
      standardizedEventType = 'file_shared';
    } else if (eventData.member) {
      standardizedEventType = eventData.action === 'join' ? 'member_joined' : 'member_left';
    }

    // Store the activity in Supabase
    await serverActivityProcessor.storeActivity({
      platform: 'flock',
      event_type: standardizedEventType,
      user_id: user_id,
      channel_id: channel_id,
      data: {
        original_event: eventData,
        headers: headers,
        timestamp: eventData.timestamp || new Date().toISOString(),
        // Extract common Flock data fields
        message: eventData.message,
        file: eventData.file,
        member: eventData.member,
        channel: eventData.channel,
        user: eventData.user,
        team: eventData.team,
        metadata: eventData.metadata
      }
    });

    console.log(`✅ Flock event processed: ${standardizedEventType}`);

  } catch (error) {
    console.error('❌ Error processing Flock event:', error);
  }
} 