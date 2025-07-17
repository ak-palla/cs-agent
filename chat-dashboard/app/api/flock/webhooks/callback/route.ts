import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/flock/webhooks/callback
 * Handle incoming webhook events from Flock
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify webhook signature if secret is configured
    const flockWebhookSecret = process.env.FLOCK_WEBHOOK_SECRET;
    if (flockWebhookSecret) {
      const signature = request.headers.get('x-flock-signature');
      if (!signature) {
        console.warn('Webhook received without signature');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      // Verify the signature
      const expectedSignature = crypto
        .createHmac('sha256', flockWebhookSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== `sha256=${expectedSignature}`) {
        console.warn('Webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhookData = JSON.parse(body);
    
    // Log the webhook event for debugging
    console.log('Flock webhook received:', {
      event: webhookData.event,
      userId: webhookData.userId,
      teamId: webhookData.teamId,
      channelId: webhookData.channelId,
      messageId: webhookData.messageId
    });

    // Process different webhook event types
    await processWebhookEvent(webhookData);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing Flock webhook:', error);
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
 * Process webhook events from Flock
 */
async function processWebhookEvent(webhookData: any) {
  const { event, userId, teamId, channelId, messageId, message } = webhookData;

  switch (event) {
    case 'message_created':
      console.log(`New message in channel ${channelId}:`, message?.text);
      // Handle new message event
      // You could broadcast this to connected clients via WebSocket
      break;

    case 'message_updated':
      console.log(`Message ${messageId} updated in channel ${channelId}`);
      // Handle message update event
      break;

    case 'message_deleted':
      console.log(`Message ${messageId} deleted from channel ${channelId}`);
      // Handle message deletion event
      break;

    case 'channel_created':
      console.log(`New channel created: ${channelId}`);
      // Handle new channel event
      break;

    case 'member_joined':
      console.log(`User ${userId} joined team/channel`);
      // Handle member join event
      break;

    case 'member_left':
      console.log(`User ${userId} left team/channel`);
      // Handle member leave event
      break;

    default:
      console.log(`Unhandled webhook event: ${event}`);
  }
}

/**
 * GET /api/flock/webhooks/callback
 * Webhook verification endpoint
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    // Return the challenge for webhook verification
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return NextResponse.json({ 
    message: 'Flock webhook endpoint active',
    timestamp: new Date().toISOString()
  });
} 