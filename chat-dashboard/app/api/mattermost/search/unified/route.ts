import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const teamId = searchParams.get('teamId');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!query || query.trim().length < 1) {
      return NextResponse.json(
        { channels: [], users: [] }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Search both channels and users in parallel
    const [channelsResponse, usersResponse] = await Promise.all([
      // Search channels
      fetch(`${baseUrl}/api/v4/channels/search`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term: query,
          team_id: teamId
        }),
      }),
      // Search users
      fetch(`${baseUrl}/api/v4/users/search`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term: query,
          team_id: teamId,
          allow_inactive: false
        }),
      })
    ]);

    const channels = channelsResponse.ok ? await channelsResponse.json() : [];
    const users = usersResponse.ok ? await usersResponse.json() : [];

    // Filter and format results
    const filteredChannels = channels.filter((channel: any) => 
      channel.type === 'O' || channel.type === 'P' // Only public and private channels
    ).slice(0, 10); // Limit to 10 results

    const filteredUsers = users.slice(0, 10); // Limit to 10 results

    return NextResponse.json({
      channels: filteredChannels,
      users: filteredUsers,
      query
    });

  } catch (error) {
    console.error('Unified search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 