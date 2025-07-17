import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/flock/me
 * Get current user info from Flock API
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const flockApiUrl = process.env.FLOCK_API_URL || 'https://api.flock.co/v1';

    // Make direct call to Flock API
    const response = await fetch(`${flockApiUrl}/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CS-Agent-Dashboard/1.0'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flock me API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch user info', details: errorText },
        { status: response.status }
      );
    }

    const userInfo = await response.json();
    return NextResponse.json({
      success: true,
      data: userInfo
    });

  } catch (error) {
    console.error('Error fetching Flock user info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user info' },
      { status: 500 }
    );
  }
} 