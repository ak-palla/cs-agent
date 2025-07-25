/**
 * GET /api/trello/boards/[boardId]/actions
 * Get actions for a specific board with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get access token from cookie
    const accessTokenCookie = request.cookies.get('trello_access_token');
    if (!accessTokenCookie) {
      return NextResponse.json({ 
        error: 'Trello OAuth authentication required',
        message: 'Please connect your Trello account first'
      }, { status: 401 });
    }

    let accessToken;
    try {
      accessToken = JSON.parse(accessTokenCookie.value);
    } catch (error) {
      trelloLogger.error('Invalid access token format in cookie');
      return NextResponse.json({ 
        error: 'Invalid token format',
        message: 'Authentication token is malformed'
      }, { status: 401 });
    }

    const oauth = new TrelloOAuth({
      apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
      apiSecret: process.env.TRELLO_API_SECRET || '',
      redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
      scopes: ['read', 'write', 'account'],
      expiration: 'never'
    });

    // Build query parameters for Trello API
    const queryParams = new URLSearchParams();
    
    // Add optional filters from request
    const since = searchParams.get('since');
    const before = searchParams.get('before');
    const limit = searchParams.get('limit');
    const filter = searchParams.get('filter');
    
    if (since) queryParams.append('since', since);
    if (before) queryParams.append('before', before);
    if (limit) queryParams.append('limit', limit);
    if (filter) queryParams.append('filter', filter);
    
    // Always include member creator details
    queryParams.append('memberCreator_fields', 'all');
    
    const queryString = queryParams.toString();
    const url = `https://api.trello.com/1/boards/${boardId}/actions${queryString ? `?${queryString}` : ''}`;

    console.log('🔍 Fetching board actions:', {
      boardId,
      url,
      filters: { since, before, limit, filter }
    });

    // Fetch board actions
    const actions = await oauth.makeAuthenticatedRequestWithToken(
      url,
      'GET',
      undefined,
      accessToken
    );

    console.log('✅ Board actions fetched:', {
      boardId,
      count: actions.length,
      since
    });

    return NextResponse.json({
      success: true,
      data: actions,
      total: actions.length,
      boardId
    });

  } catch (error) {
    console.error('❌ Error fetching board actions:', error);
    trelloLogger.error('Failed to fetch board actions', {
      error: error instanceof Error ? error.message : error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch board actions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}