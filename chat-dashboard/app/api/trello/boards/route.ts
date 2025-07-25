import { NextRequest, NextResponse } from 'next/server';
import { TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

/**
 * GET /api/trello/boards
 * Get all boards for the authenticated user using cookie-based OAuth
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: /api/trello/boards request received');
    console.log('🔍 API: Cookies:', request.cookies.getAll());
    
    // Get access token from cookie
    const accessTokenCookie = request.cookies.get('trello_access_token');
    if (!accessTokenCookie) {
      console.log('❌ API: No access token cookie found');
      return NextResponse.json({ 
        error: 'Trello OAuth authentication required',
        message: 'Please connect your Trello account first'
      }, { status: 401 });
    }

    let accessToken;
    try {
      accessToken = JSON.parse(accessTokenCookie.value);
      console.log('🎯 API: Access token parsed successfully');
      console.log('🎯 API: Token has oauth_token:', !!accessToken.oauth_token);
      console.log('🎯 API: Token has oauth_token_secret:', !!accessToken.oauth_token_secret);
    } catch (error) {
      console.error('❌ API: Invalid access token format in cookie:', error);
      trelloLogger.error('Invalid access token format in cookie');
      return NextResponse.json({ 
        error: 'Invalid token format',
        message: 'Authentication token is malformed'
      }, { status: 401 });
    }

    if (!accessToken.oauth_token || !accessToken.oauth_token_secret) {
      console.error('❌ API: Missing oauth_token or oauth_token_secret in token');
      return NextResponse.json({ 
        error: 'Invalid token',
        message: 'Missing required OAuth token components'
      }, { status: 401 });
    }

    const oauth = new TrelloOAuth({
      apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
      apiSecret: process.env.TRELLO_API_SECRET || '',
      redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
      scopes: ['read', 'write', 'account'],
      expiration: 'never'
    });

    console.log('🔍 API: Making Trello API request for boards...');
    
    // Use the access token directly from cookie instead of relying on getStoredAccessToken
    const boards = await oauth.makeAuthenticatedRequestWithToken(
      'https://api.trello.com/1/members/me/boards?filter=open&fields=name,desc,closed,idOrganization,pinned,url,shortLink',
      'GET',
      undefined,
      accessToken
    );

    console.log('✅ API: Successfully fetched', boards.length, 'boards');
    trelloLogger.info('Fetched Trello boards successfully', {
      boardCount: boards.length,
      userToken: accessToken.oauth_token.substring(0, 8) + '...'
    });

    return NextResponse.json({
      success: true,
      data: boards,
      total: boards.length
    });

  } catch (error) {
    console.error('🔥 API: Error fetching Trello boards:', error);
    trelloLogger.error('Error fetching Trello boards', {
      error: error instanceof Error ? error.message : error
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch boards',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trello/boards
 * Create a new board using cookie-based OAuth
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { name, desc, idOrganization, prefs } = body as any;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Board name is required' },
        { status: 400 }
      );
    }

    const oauth = new TrelloOAuth({
      apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
      apiSecret: process.env.TRELLO_API_SECRET || '',
      redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
      scopes: ['read', 'write', 'account'],
      expiration: 'never'
    });

    // Create board data
    const boardData: any = {
      name: name.trim(),
      ...(desc && { desc }),
      ...(idOrganization && { idOrganization }),
      ...(prefs?.permissionLevel && { prefs_permissionLevel: prefs.permissionLevel }),
      ...(prefs?.voting && { prefs_voting: prefs.voting }),
      ...(prefs?.comments && { prefs_comments: prefs.comments }),
      ...(prefs?.invitations && { prefs_invitations: prefs.invitations }),
      ...(prefs?.selfJoin !== undefined && { prefs_selfJoin: prefs.selfJoin }),
      ...(prefs?.cardCovers !== undefined && { prefs_cardCovers: prefs.cardCovers }),
      ...(prefs?.background && { prefs_background: prefs.background })
    };

    const newBoard = await oauth.makeAuthenticatedRequestWithToken(
      'https://api.trello.com/1/boards',
      'POST',
      boardData,
      accessToken
    );

    trelloLogger.info('Created new Trello board', {
      boardId: newBoard.id,
      boardName: newBoard.name
    });

    return NextResponse.json({
      success: true,
      data: newBoard
    }, { status: 201 });

  } catch (error) {
    trelloLogger.error('Error creating Trello board', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to create board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 