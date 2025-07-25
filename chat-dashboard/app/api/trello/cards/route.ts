import { NextRequest, NextResponse } from 'next/server';
import { TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

/**
 * POST /api/trello/cards
 * Create a new card
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      desc, 
      idList, 
      pos, 
      due, 
      idMembers, 
      idLabels, 
      urlSource 
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Card name is required' },
        { status: 400 }
      );
    }

    if (!idList) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      );
    }

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

    const cardData = {
      name: name.trim(),
      idList,
      ...(desc && { desc }),
      ...(pos !== undefined && { pos }),
      ...(due && { due }),
      ...(idMembers && { idMembers }),
      ...(idLabels && { idLabels }),
      ...(urlSource && { urlSource })
    };

    const newCard = await oauth.makeAuthenticatedRequestWithToken(
      'https://api.trello.com/1/cards',
      'POST',
      cardData,
      accessToken
    );

    return NextResponse.json({
      success: true,
      data: newCard
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating Trello card:', error);
    trelloLogger.error('Error creating Trello card', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to create card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 