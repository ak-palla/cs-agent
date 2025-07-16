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
    
    // Get direct message channels
    const response = await fetch(`${baseUrl}/api/v4/channels?type=D`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost DM API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch direct messages', details: errorText },
        { status: response.status }
      );
    }

    const dmChannels = await response.json();
    return NextResponse.json(dmChannels);

  } catch (error) {
    console.error('Direct messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { userIds } = await request.json();
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Create direct message channel
    const response = await fetch(`${baseUrl}/api/v4/channels/direct`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userIds),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost create DM API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create direct message', details: errorText },
        { status: response.status }
      );
    }

    const dmChannel = await response.json();
    return NextResponse.json(dmChannel);

  } catch (error) {
    console.error('Create direct message API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}