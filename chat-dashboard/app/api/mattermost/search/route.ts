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

    if (!query) {
      return NextResponse.json(
        { error: 'Search query required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    
    // Search for posts
    const searchUrl = teamId 
      ? `${baseUrl}/api/v4/teams/${teamId}/posts/search`
      : `${baseUrl}/api/v4/posts/search`;
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        terms: query,
        is_or_search: false,
        page: 0,
        per_page: 20,
        time_zone_offset: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost search API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to search messages', details: errorText },
        { status: response.status }
      );
    }

    const searchResults = await response.json();
    return NextResponse.json(searchResults);

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}