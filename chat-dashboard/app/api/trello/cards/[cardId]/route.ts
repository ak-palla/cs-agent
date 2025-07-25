import { NextRequest, NextResponse } from 'next/server';
import { TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

/**
 * GET /api/trello/cards/[cardId]
 * Get a specific card with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    
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

    const card = await oauth.makeAuthenticatedRequestWithToken(
      `https://api.trello.com/1/cards/${cardId}?fields=all&actions=all&attachments=true&checklists=all&members=true&membersVoted=true&stickers=true`,
      'GET',
      undefined,
      accessToken
    );

    return NextResponse.json({
      success: true,
      data: card
    });

  } catch (error) {
    console.error('Error fetching Trello card:', error);
    trelloLogger.error('Error fetching Trello card', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trello/cards/[cardId]
 * Update a specific card
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await request.json();

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

    // Build update data from request body
    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.desc !== undefined) updateData.desc = body.desc;
    if (body.closed !== undefined) updateData.closed = body.closed;
    if (body.idList !== undefined) updateData.idList = body.idList;
    if (body.pos !== undefined) updateData.pos = body.pos;
    if (body.due !== undefined) updateData.due = body.due;
    if (body.dueComplete !== undefined) updateData.dueComplete = body.dueComplete;
    if (body.idMembers !== undefined) updateData.idMembers = body.idMembers;
    if (body.idLabels !== undefined) updateData.idLabels = body.idLabels;

    const updatedCard = await oauth.makeAuthenticatedRequestWithToken(
      `https://api.trello.com/1/cards/${cardId}`,
      'PUT',
      updateData,
      accessToken
    );

    return NextResponse.json({
      success: true,
      data: updatedCard
    });

  } catch (error) {
    console.error('Error updating Trello card:', error);
    trelloLogger.error('Error updating Trello card', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to update card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trello/cards/[cardId]
 * Delete a specific card
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;

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
      `https://api.trello.com/1/cards/${cardId}`,
      'DELETE',
      undefined,
      accessToken
    );

    return NextResponse.json({
      success: true,
      message: 'Card deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting Trello card:', error);
    trelloLogger.error('Error deleting Trello card', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to delete card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 