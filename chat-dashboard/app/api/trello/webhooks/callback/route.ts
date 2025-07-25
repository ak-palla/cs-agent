import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { serverActivityProcessor } from '@/lib/server-activity-processor';

/**
 * POST /api/trello/webhooks/callback
 * Handle incoming webhook events from Trello
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Optional: Verify request comes from Trello IP range (104.192.142.240/28)
    // This is an additional security layer mentioned in Atlassian documentation
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    if (process.env.TRELLO_ENFORCE_IP_VALIDATION === 'true' && clientIP) {
      // Implementation note: You would need to add IP range validation here
      // For now, we'll just log the IP for monitoring
      console.log('🌐 Webhook request from IP:', clientIP);
    }
    
    // Verify webhook signature if secret is configured
    const trelloWebhookSecret = process.env.TRELLO_WEBHOOK_SECRET;
    if (trelloWebhookSecret) {
      const signature = request.headers.get('x-trello-webhook');
      if (!signature) {
        console.warn('Webhook received without signature');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      // Verify the signature
      const expectedSignature = crypto
        .createHmac('sha1', trelloWebhookSecret)
        .update(body)
        .digest('base64');
      
      if (signature !== expectedSignature) {
        console.warn('Webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhookData = JSON.parse(body);
    
    // Validate webhook payload structure according to Atlassian documentation
    if (!webhookData.action || !webhookData.model) {
      console.warn('Invalid webhook payload - missing action or model');
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }
    
    // Log the webhook event for debugging
    console.log('🎣 Trello webhook received:', {
      webhookId: webhookData.webhook?.id,
      action: webhookData.action?.type,
      modelType: webhookData.model?.type,
      modelId: webhookData.model?.id,
      memberCreator: webhookData.action?.memberCreator?.fullName,
      timestamp: webhookData.action?.date
    });

    // Process different webhook action types
    await processWebhookAction(webhookData);

    // Return 200 status with empty response as recommended by Atlassian
    return new NextResponse(null, { status: 200 });

  } catch (error) {
    console.error('Error processing Trello webhook:', error);
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
 * GET /api/trello/webhooks/callback
 * Handle webhook verification from Trello
 */
export async function GET(request: NextRequest) {
  // Trello sends a GET request to verify the webhook URL
  return NextResponse.json({ success: true });
}

/**
 * HEAD /api/trello/webhooks/callback
 * Handle webhook verification from Trello
 */
export async function HEAD(request: NextRequest) {
  // Trello may also send a HEAD request for verification
  return new NextResponse(null, { status: 200 });
}

/**
 * Process webhook action and trigger real-time updates
 */
async function processWebhookAction(webhookData: any) {
  const { action, model } = webhookData;
  
  if (!action || !model) {
    console.warn('Webhook missing action or model data');
    return;
  }

  // Extract key information
  const actionType = action.type;
  const modelType = model.type; // 'board', 'card', 'list', etc.
  const modelId = model.id;
  const memberCreator = action.memberCreator;
  const date = action.date;

  // Create a standardized event object
  const event = {
    id: action.id,
    type: actionType,
    modelType,
    modelId,
    memberCreator: {
      id: memberCreator?.id,
      fullName: memberCreator?.fullName,
      username: memberCreator?.username
    },
    date,
    data: action.data,
    model
  };

  // Store the event in Supabase using ServerActivityProcessor
  await serverActivityProcessor.storeActivity({
    platform: 'trello',
    event_type: actionType,
    user_id: memberCreator?.id,
    channel_id: modelType === 'board' ? modelId : action.data?.board?.id,
    data: {
      action_id: action.id,
      model_type: modelType,
      model_id: modelId,
      member_creator: memberCreator,
      action_data: action.data,
      model_data: model,
      date: date
    }
  });

  console.log('Processed Trello webhook event:', {
    type: actionType,
    model: `${modelType}:${modelId}`,
    member: memberCreator?.fullName || 'Unknown'
  });

  // Example: Handle specific action types
  switch (actionType) {
    case 'createCard':
      console.log(`New card created: ${action.data.card?.name}`);
      // Broadcast to WebSocket clients listening for this board
      await broadcastToClients(model.id, event);
      break;
      
    case 'updateCard':
      console.log(`Card updated: ${action.data.card?.name}`);
      await broadcastToClients(model.id, event);
      break;
      
    case 'commentCard':
      console.log(`Comment added to card: ${action.data.card?.name}`);
      await broadcastToClients(model.id, event);
      break;
      
    case 'moveCardToBoard':
    case 'moveCardFromBoard':
      console.log(`Card moved: ${action.data.card?.name}`);
      await broadcastToClients(model.id, event);
      break;
      
    case 'addMemberToBoard':
    case 'removeMemberFromBoard':
      console.log(`Board membership changed`);
      await broadcastToClients(model.id, event);
      break;
      
    default:
      console.log(`Unhandled action type: ${actionType}`);
      await broadcastToClients(model.id, event);
  }
}

/**
 * Broadcast event to WebSocket clients
 * This is a placeholder - you would implement actual WebSocket broadcasting
 */
async function broadcastToClients(boardId: string, event: any) {
  try {
    // In a real implementation, you would:
    // 1. Maintain a list of active WebSocket connections per board
    // 2. Send the event to all connected clients for this board
    // 3. Handle connection cleanup and error cases
    
    console.log(`Broadcasting event to clients for board ${boardId}:`, event.type);
    
    // Example: If using Socket.IO or similar
    // io.to(`board:${boardId}`).emit('trello-event', event);
    
    // Example: If using custom WebSocket manager
    // websocketManager.broadcastToBoard(boardId, {
    //   type: 'trello-webhook',
    //   payload: event
    // });
    
  } catch (error) {
    console.error('Error broadcasting to WebSocket clients:', error);
  }
}

/**
 * Store webhook event in database
 * This is a placeholder for database integration
 */
async function storeWebhookEvent(event: any) {
  try {
    // In a real implementation, you would store the event in your database
    // for audit logs, offline clients, or analytics
    
    console.log('Storing webhook event:', event.id);
    
    // Example with Prisma or similar ORM:
    // await prisma.trelloWebhookEvent.create({
    //   data: {
    //     eventId: event.id,
    //     type: event.type,
    //     modelType: event.modelType,
    //     modelId: event.modelId,
    //     memberCreatorId: event.memberCreator.id,
    //     date: new Date(event.date),
    //     data: event.data
    //   }
    // });
    
  } catch (error) {
    console.error('Error storing webhook event:', error);
  }
} 