import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const mattermostBaseUrl = process.env.MATTERMOST_BASE_URL || 'https://teams.webuildtrades.co';
    
    const response = await fetch(`${mattermostBaseUrl}/api/v4/users/${params.userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Mattermost API error: ${response.status}` },
        { status: response.status }
      );
    }

    const userData = await response.json();
    return NextResponse.json(userData);
    
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}