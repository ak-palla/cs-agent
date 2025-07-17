import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/flock/channels
 * Get channels for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const flockApiUrl = process.env.FLOCK_API_URL || 'https://api.flock.co/v1';

    // Build URL for channels API call
    const channelsUrl = teamId 
      ? `${flockApiUrl}/channels?teamId=${teamId}`
      : `${flockApiUrl}/channels`;

    // Call Flock API to get channels
    const response = await fetch(channelsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CS-Agent-Dashboard/1.0'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flock channels API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch channels', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const channels = data.result || data || [];

    return NextResponse.json({
      success: true,
      data: channels,
      total: channels.length
    });

  } catch (error) {
    console.error('Error fetching Flock channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flock/channels
 * Create a new channel
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { name, description, type, isPrivate, members } = await request.json();

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const appId = process.env.NEXT_PUBLIC_FLOCK_APP_ID;
    const appSecret = process.env.FLOCK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Flock credentials not configured' },
        { status: 500 }
      );
    }

    const flockClient = new FlockApiClient(appId, appSecret);
    flockClient.setAccessToken(accessToken);

    const channel = await flockClient.createChannel({
      name: name.trim(),
      description,
      type,
      isPrivate,
      members
    });

    if (!channel) {
      return NextResponse.json(
        { error: 'Failed to create channel' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: channel
    });

  } catch (error) {
    console.error('Error creating Flock channel:', error);
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    );
  }
} 