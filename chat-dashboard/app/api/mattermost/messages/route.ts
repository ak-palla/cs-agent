import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const perPage = searchParams.get('perPage') || '50';
    const before = searchParams.get('before'); // For loading older messages
    const after = searchParams.get('after');   // For loading newer messages
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Build query parameters for pagination
    const queryParams = new URLSearchParams({
      per_page: perPage
    });
    
    if (before) {
      queryParams.append('before', before);
    }
    
    if (after) {
      queryParams.append('after', after);
    }
    
    const response = await fetch(`${baseUrl}/api/v4/channels/${channelId}/posts?${queryParams.toString()}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch messages', details: errorText },
        { status: response.status }
      );
    }

    const messages = await response.json();
    
    // Add pagination metadata for the client
    const response_headers = {
      'X-Has-More': response.headers.get('X-Has-More') || 'false',
      'X-Total-Count': response.headers.get('X-Total-Count') || '0'
    };
    
    return NextResponse.json({
      ...messages,
      pagination: {
        hasMore: response_headers['X-Has-More'] === 'true',
        totalCount: parseInt(response_headers['X-Total-Count'], 10),
        perPage: parseInt(perPage, 10),
        before,
        after
      }
    });

  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { channelId, message } = await request.json();
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!channelId || !message) {
      return NextResponse.json(
        { error: 'Channel ID and message required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    const response = await fetch(`${baseUrl}/api/v4/posts`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel_id: channelId,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to send message', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Send message API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}