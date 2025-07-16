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
    
    // Get users
    const usersUrl = teamId 
      ? `${baseUrl}/api/v4/teams/${teamId}/members`
      : `${baseUrl}/api/v4/users`;
    
    const response = await fetch(usersUrl, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost users API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch users', details: errorText },
        { status: response.status }
      );
    }

    const users = await response.json();
    return NextResponse.json(users);

  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}