import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    try {
      // Get all channels for the team (both member and public channels)
      const channelsUrl = `${baseUrl}/api/v4/teams/${teamId}/channels?include_deleted=false&per_page=200`;
      const channelsResponse = await fetch(channelsUrl, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!channelsResponse.ok) {
        const errorText = await channelsResponse.text();
        console.error('Mattermost channels API error:', errorText);
        return NextResponse.json(
          { error: 'Failed to fetch channels', details: errorText },
          { status: channelsResponse.status }
        );
      }

      const channels = await channelsResponse.json();
      
      // Try to get more channels using the channels search endpoint
      try {
        const searchUrl = `${baseUrl}/api/v4/channels/search`;
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            term: '',
            team_id: teamId,
            public: true,
            private: false,
            include_deleted: false,
            per_page: 200
          }),
        });

        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();
          const existingChannelIds = channels.map(ch => ch.id);
          const newChannels = searchResults.filter(ch => !existingChannelIds.includes(ch.id));
          return NextResponse.json([...channels, ...newChannels]);
        }
      } catch (searchError) {
        console.log('Search endpoint not available, using member channels only');
      }

      return NextResponse.json(channels);

    } catch (fetchError) {
      console.error('Channel fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Channels API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { name, display_name, purpose, header, type, team_id } = await request.json();
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!name || !display_name || !team_id) {
      return NextResponse.json(
        { error: 'Channel name, display name, and team ID are required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Create channel
    const response = await fetch(`${baseUrl}/api/v4/channels`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.toLowerCase().replace(/[^a-z0-9-_]/g, ''), // Sanitize channel name
        display_name,
        purpose: purpose || '',
        header: header || '',
        type: type || 'O', // 'O' for public, 'P' for private
        team_id
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost create channel API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create channel', details: errorText },
        { status: response.status }
      );
    }

    const channel = await response.json();
    return NextResponse.json(channel);

  } catch (error) {
    console.error('Create channel API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { id, display_name, purpose, header } = await request.json();
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    if (!id || !display_name) {
      return NextResponse.json(
        { error: 'Channel ID and display name are required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Update channel
    const response = await fetch(`${baseUrl}/api/v4/channels/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        display_name,
        purpose: purpose || '',
        header: header || ''
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost update channel API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update channel', details: errorText },
        { status: response.status }
      );
    }

    const updatedChannel = await response.json();
    return NextResponse.json(updatedChannel);

  } catch (error) {
    console.error('Update channel API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    
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
    
    // Delete channel
    const response = await fetch(`${baseUrl}/api/v4/channels/${channelId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost delete channel API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to delete channel', details: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete channel API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}