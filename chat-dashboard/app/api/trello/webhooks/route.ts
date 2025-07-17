import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient from '@/lib/trello-client';
import crypto from 'crypto';

/**
 * GET /api/trello/webhooks
 * Get all webhooks for the authenticated token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey') || process.env.TRELLO_API_KEY;
    const token = searchParams.get('token') || process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return NextResponse.json(
        { error: 'Trello API key and token are required' },
        { status: 401 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);
    const webhooks = await trelloClient.getWebhooks();

    return NextResponse.json({
      success: true,
      data: webhooks,
      total: webhooks.length
    });

  } catch (error) {
    console.error('Error fetching Trello webhooks:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch webhooks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trello/webhooks
 * Create a new webhook for a board or card
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey') || process.env.TRELLO_API_KEY;
    const token = searchParams.get('token') || process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return NextResponse.json(
        { error: 'Trello API key and token are required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { idModel, description } = body;

    if (!idModel) {
      return NextResponse.json(
        { error: 'Model ID (board or card ID) is required' },
        { status: 400 }
      );
    }

    // Construct callback URL for this deployment
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const callbackURL = `${protocol}://${host}/api/trello/webhooks/callback`;

    const trelloClient = new TrelloApiClient(apiKey, token);
    
    const webhook = await trelloClient.createWebhook(
      idModel, 
      callbackURL, 
      description || 'CS Agent Dashboard Webhook'
    );

    return NextResponse.json({
      success: true,
      data: webhook
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating Trello webhook:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trello/webhooks
 * Delete a webhook by ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey') || process.env.TRELLO_API_KEY;
    const token = searchParams.get('token') || process.env.TRELLO_TOKEN;
    const webhookId = searchParams.get('webhookId');

    if (!apiKey || !token) {
      return NextResponse.json(
        { error: 'Trello API key and token are required' },
        { status: 401 }
      );
    }

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);
    await trelloClient.deleteWebhook(webhookId);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting Trello webhook:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 