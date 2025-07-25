import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient, { createTrelloClient, createTrelloClientWithOAuth } from '@/lib/trello-client';
import { TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';
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

    if (useOAuth) {
      // Use OAuth authentication - same pattern as working board routes
      const accessTokenCookie = request.cookies.get('trello_access_token');
      if (!accessTokenCookie) {
        console.log('❌ No trello_access_token cookie found');
        return NextResponse.json(
          { error: 'Trello OAuth authentication required. Please connect your Trello account first.' },
          { status: 401 }
        );
      }

      let accessToken;
      try {
        accessToken = JSON.parse(accessTokenCookie.value);
        console.log('✅ Access token found in cookie');
      } catch (error) {
        trelloLogger.error('Invalid access token format in cookie');
        return NextResponse.json(
          { error: 'Invalid token format' },
          { status: 401 }
        );
      }

      const oauth = new TrelloOAuth({
        apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
        apiSecret: process.env.TRELLO_API_SECRET || '',
        redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
        scopes: ['read', 'write', 'account'],
        expiration: 'never'
      });

      // Get webhooks using the same pattern as working board API
      const webhooks = await oauth.makeAuthenticatedRequestWithToken(
        `https://api.trello.com/1/tokens/${accessToken.oauth_token}/webhooks`,
        'GET',
        undefined,
        accessToken
      );

      console.log('✅ Webhooks fetched successfully:', webhooks.length);

      return NextResponse.json({
        success: true,
        data: webhooks,
        total: webhooks.length
      });

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

      const trelloClient = createTrelloClient(finalApiKey, finalToken);
      const webhooks = await trelloClient.getWebhooks();

      return NextResponse.json({
        success: true,
        data: webhooks,
        total: webhooks.length
      });
    }

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

    if (useOAuth) {
      try {
        // Use OAuth authentication - same pattern as working board routes
        const accessTokenCookie = request.cookies.get('trello_access_token');
        if (!accessTokenCookie) {
          console.log('❌ No trello_access_token cookie found for webhook creation');
          return NextResponse.json(
            { error: 'Trello OAuth authentication required. Please connect your Trello account first.' },
            { status: 401 }
          );
        }

        let accessToken;
        try {
          accessToken = JSON.parse(accessTokenCookie.value);
          console.log('✅ Access token found in cookie for webhook creation');
        } catch (parseError) {
          trelloLogger.error('Invalid access token format in cookie', { parseError });
          return NextResponse.json(
            { error: 'Invalid token format' },
            { status: 401 }
          );
        }

        console.log('🔧 Environment check:', {
          hasApiKey: !!process.env.NEXT_PUBLIC_TRELLO_API_KEY,
          hasApiSecret: !!process.env.TRELLO_API_SECRET,
          hasRedirectUri: !!process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI,
          tokenType: typeof accessToken.oauth_token
        });

        const oauth = new TrelloOAuth({
          apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
          apiSecret: process.env.TRELLO_API_SECRET || '',
          redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
          scopes: ['read', 'write', 'account'],
          expiration: 'never'
        });

        // Construct callback URL for this deployment
        const host = request.headers.get('host');
        const protocol = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'https' : 'http');
        const callbackURL = `${protocol}://${host}/api/trello/webhooks/callback`;
        
        // Check if we're running locally - Trello webhooks won't work with localhost
        if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
          console.warn('⚠️ Webhook creation skipped - localhost URLs not reachable by Trello');
          return NextResponse.json({
            success: false,
            error: 'Webhook creation not supported on localhost',
            message: 'Trello webhooks require a publicly accessible URL. For local development, either:\n1. Deploy to a public server (Vercel, Netlify, etc.)\n2. Use ngrok to expose localhost publicly\n3. Activities will work without webhooks but won\'t update in real-time',
            callbackURL
          }, { status: 400 });
        }
        
        console.log('🔗 Creating webhook:', {
          url: `https://api.trello.com/1/tokens/${accessToken.oauth_token}/webhooks`,
          idModel,
          callbackURL,
          description: description || 'CS Agent Dashboard Webhook'
        });
        
        // Create webhook using direct API call with form data (like Trello API expects)
        const webhookUrl = `https://api.trello.com/1/tokens/${accessToken.oauth_token}/webhooks`;
        const formData = new URLSearchParams({
          idModel,
          callbackURL,
          description: description || 'CS Agent Dashboard Webhook'
        });

        // Generate OAuth signature for the request
        const authHeader = oauth.generateOAuthHeader('POST', webhookUrl, {
          oauth_token: accessToken.oauth_token
        }, accessToken.oauth_token_secret);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString()
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Trello API webhook creation error:', response.status, errorText);
          throw new Error(`Webhook creation failed: ${response.status} - ${errorText}`);
        }

        const webhook = await response.json();
        console.log('✅ Webhook created successfully:', webhook.id);

        return NextResponse.json({
          success: true,
          data: webhook
        }, { status: 201 });

      } catch (oauthError) {
        console.error('❌ OAuth webhook creation error:', oauthError);
        throw oauthError; // Re-throw to be caught by outer catch block
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

      const trelloClient = createTrelloClient(finalApiKey, finalToken);
      
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
    }

  } catch (error) {
    console.error('❌ Error creating Trello webhook:', error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : error;
    
    console.error('🔍 Webhook creation error details:', {
      message: errorMessage,
      details: errorDetails
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to create webhook',
        details: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? errorDetails : undefined
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

    if (useOAuth) {
      // Use OAuth authentication - same pattern as working board routes
      const accessTokenCookie = request.cookies.get('trello_access_token');
      if (!accessTokenCookie) {
        console.log('❌ No trello_access_token cookie found for webhook deletion');
        return NextResponse.json(
          { error: 'Trello OAuth authentication required. Please connect your Trello account first.' },
          { status: 401 }
        );
      }

      let accessToken;
      try {
        accessToken = JSON.parse(accessTokenCookie.value);
        console.log('✅ Access token found in cookie for webhook deletion');
      } catch (error) {
        trelloLogger.error('Invalid access token format in cookie');
        return NextResponse.json(
          { error: 'Invalid token format' },
          { status: 401 }
        );
      }

      const oauth = new TrelloOAuth({
        apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
        apiSecret: process.env.TRELLO_API_SECRET || '',
        redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
        scopes: ['read', 'write', 'account'],
        expiration: 'never'
      });

      // Delete webhook using the same pattern as working board API
      await oauth.makeAuthenticatedRequestWithToken(
        `https://api.trello.com/1/webhooks/${webhookId}`,
        'DELETE',
        undefined,
        accessToken
      );

      console.log('✅ Webhook deleted successfully:', webhookId);

      return NextResponse.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
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

      const trelloClient = createTrelloClient(finalApiKey, finalToken);
      await trelloClient.deleteWebhook(webhookId);

      return NextResponse.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
    }

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