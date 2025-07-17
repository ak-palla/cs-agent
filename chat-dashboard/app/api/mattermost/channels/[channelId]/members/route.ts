import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{
    channelId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    const { channelId } = await params;
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Get channel members
    const response = await fetch(`${baseUrl}/api/v4/channels/${channelId}/members`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost channel members API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch channel members', details: errorText },
        { status: response.status }
      );
    }

    const members = await response.json();
    return NextResponse.json(members);

  } catch (error) {
    console.error('Channel members API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    const { channelId } = await params;
    const { user_id } = await request.json();
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Add member to channel
    const response = await fetch(`${baseUrl}/api/v4/channels/${channelId}/members`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost add member API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to add member to channel', details: errorText },
        { status: response.status }
      );
    }

    const member = await response.json();
    return NextResponse.json(member);

  } catch (error) {
    console.error('Add channel member API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization');
    const { channelId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Remove member from channel
    const response = await fetch(`${baseUrl}/api/v4/channels/${channelId}/members/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost remove member API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to remove member from channel', details: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Remove channel member API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 