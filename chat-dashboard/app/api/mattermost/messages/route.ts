import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const perPage = searchParams.get('perPage') || '50';
    
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
    
    const response = await fetch(`${baseUrl}/api/v4/channels/${channelId}/posts?per_page=${perPage}`, {
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
    return NextResponse.json(messages);

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