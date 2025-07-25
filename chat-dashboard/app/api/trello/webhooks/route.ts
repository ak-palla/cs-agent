import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient, { createTrelloClient, createTrelloClientWithOAuth } from '@/lib/trello-client';
import { createTrelloOAuth } from '@/lib/trello-oauth';
import crypto from 'crypto';

/**
 * GET /api/trello/webhooks
 * Get all webhooks for the authenticated token (supports OAuth and API key/token)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const token = searchParams.get('token');
    const useOAuth = searchParams.get('useOAuth') === 'true' || (!apiKey && !token);

    let trelloClient: TrelloApiClient;

    if (useOAuth) {
      // Use OAuth authentication
      try {
        trelloClient = createTrelloClientWithOAuth();
        
        // Check if OAuth is authenticated
        if (!trelloClient.isOAuthAuthenticated()) {
          return NextResponse.json(
            { error: 'Trello OAuth authentication required. Please connect your Trello account first.' },
            { status: 401 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Trello OAuth not configured. Please set up OAuth environment variables.' },
          { status: 500 }
        );
      }
    } else {
      // Use API key/token authentication
      const finalApiKey = apiKey || process.env.TRELLO_API_KEY;
      const finalToken = token || process.env.TRELLO_TOKEN;

      if (!finalApiKey || !finalToken) {
        return NextResponse.json(
          { error: 'Trello API key and token are required for non-OAuth requests' },
          { status: 401 }
        );
      }

      trelloClient = createTrelloClient(finalApiKey, finalToken);
    }

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
 * Create a new webhook for a board or card (supports OAuth and API key/token)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const token = searchParams.get('token');
    const useOAuth = searchParams.get('useOAuth') === 'true' || (!apiKey && !token);

    const body = await request.json();
    const { idModel, description } = body;

    if (!idModel) {
      return NextResponse.json(
        { error: 'Model ID (board or card ID) is required' },
        { status: 400 }
      );
    }

    let trelloClient: TrelloApiClient;

    if (useOAuth) {
      // Use OAuth authentication
      try {
        trelloClient = createTrelloClientWithOAuth();
        
        // Check if OAuth is authenticated
        if (!trelloClient.isOAuthAuthenticated()) {
          return NextResponse.json(
            { error: 'Trello OAuth authentication required. Please connect your Trello account first.' },
            { status: 401 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Trello OAuth not configured. Please set up OAuth environment variables.' },
          { status: 500 }
        );
      }
    } else {
      // Use API key/token authentication
      const finalApiKey = apiKey || process.env.TRELLO_API_KEY;
      const finalToken = token || process.env.TRELLO_TOKEN;

      if (!finalApiKey || !finalToken) {
        return NextResponse.json(
          { error: 'Trello API key and token are required for non-OAuth requests' },
          { status: 401 }
        );
      }

      trelloClient = createTrelloClient(finalApiKey, finalToken);
    }

    // Construct callback URL for this deployment
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const callbackURL = `${protocol}://${host}/api/trello/webhooks/callback`;
    
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
 * Delete a webhook by ID (supports OAuth and API key/token)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    const token = searchParams.get('token');
    const webhookId = searchParams.get('webhookId');
    const useOAuth = searchParams.get('useOAuth') === 'true' || (!apiKey && !token);

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    let trelloClient: TrelloApiClient;

    if (useOAuth) {
      // Use OAuth authentication
      try {
        trelloClient = createTrelloClientWithOAuth();
        
        // Check if OAuth is authenticated
        if (!trelloClient.isOAuthAuthenticated()) {
          return NextResponse.json(
            { error: 'Trello OAuth authentication required. Please connect your Trello account first.' },
            { status: 401 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Trello OAuth not configured. Please set up OAuth environment variables.' },
          { status: 500 }
        );
      }
    } else {
      // Use API key/token authentication
      const finalApiKey = apiKey || process.env.TRELLO_API_KEY;
      const finalToken = token || process.env.TRELLO_TOKEN;

      if (!finalApiKey || !finalToken) {
        return NextResponse.json(
          { error: 'Trello API key and token are required for non-OAuth requests' },
          { status: 401 }
        );
      }

      trelloClient = createTrelloClient(finalApiKey, finalToken);
    }

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