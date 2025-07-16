import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    const response = await fetch(`${baseUrl}/api/v4/channels`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch channels', details: errorText },
        { status: response.status }
      );
    }

    const channels = await response.json();
    return NextResponse.json(channels);

  } catch (error) {
    console.error('Channels API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}