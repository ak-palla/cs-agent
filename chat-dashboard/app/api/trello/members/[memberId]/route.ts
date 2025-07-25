/**
 * GET /api/trello/members/[memberId]
 * Get member information from Trello
 */

import { NextRequest, NextResponse } from 'next/server';
import { TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    
    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
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

    const member = await oauth.makeAuthenticatedRequestWithToken(
      `https://api.trello.com/1/members/${memberId}?fields=id,fullName,username,initials`,
      'GET',
      undefined,
      accessToken
    );

    return NextResponse.json({
      success: true,
      data: member
    });

  } catch (error) {
    console.error('Error fetching Trello member:', error);
    trelloLogger.error('Error fetching Trello member', {
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch member',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}