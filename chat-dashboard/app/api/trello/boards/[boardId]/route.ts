import { NextRequest, NextResponse } from 'next/server';
import { TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

/**
 * GET /api/trello/boards/[boardId]
 * Get a specific board with its lists and cards
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    
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

    // Fetch board details
    const board = await oauth.makeAuthenticatedRequestWithToken(
      `https://api.trello.com/1/boards/${boardId}?fields=all&lists=open&list_fields=all&cards=open&card_fields=all`,
      'GET',
      undefined,
      accessToken
    );

    return NextResponse.json({
      success: true,
      data: board
    });

  } catch (error) {
    console.error('Error fetching Trello board:', error);
    trelloLogger.error('Error fetching Trello board', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trello/boards/[boardId]
 * Update a specific board
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const body = await request.json();
    const { name, desc, closed, prefs } = body;

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

    // Build update data
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (desc !== undefined) updateData.desc = desc;
    if (closed !== undefined) updateData.closed = closed;
    
    if (prefs) {
      if (prefs.permissionLevel) updateData.prefs_permissionLevel = prefs.permissionLevel;
      if (prefs.voting) updateData.prefs_voting = prefs.voting;
      if (prefs.comments) updateData.prefs_comments = prefs.comments;
      if (prefs.invitations) updateData.prefs_invitations = prefs.invitations;
      if (prefs.selfJoin !== undefined) updateData.prefs_selfJoin = prefs.selfJoin;
      if (prefs.cardCovers !== undefined) updateData.prefs_cardCovers = prefs.cardCovers;
      if (prefs.background) updateData.prefs_background = prefs.background;
    }

    const updatedBoard = await oauth.makeAuthenticatedRequestWithToken(
      `https://api.trello.com/1/boards/${boardId}`,
      'PUT',
      updateData,
      accessToken
    );

    return NextResponse.json({
      success: true,
      data: updatedBoard
    });

  } catch (error) {
    console.error('Error updating Trello board:', error);
    trelloLogger.error('Error updating Trello board', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to update board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trello/boards/[boardId]
 * Delete a specific board
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;

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

    await oauth.makeAuthenticatedRequestWithToken(
      `https://api.trello.com/1/boards/${boardId}`,
      'DELETE',
      undefined,
      accessToken
    );

    return NextResponse.json({
      success: true,
      message: 'Board deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting Trello board:', error);
    trelloLogger.error('Error deleting Trello board', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to delete board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 