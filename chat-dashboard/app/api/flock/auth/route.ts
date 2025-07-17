import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/flock/auth
 * Validate Flock bot token and return user info
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const flockApiUrl = process.env.FLOCK_API_URL || 'https://api.flock.co/v1';

    // Test the token by fetching user info from Flock API
    const response = await fetch(`${flockApiUrl}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CS-Agent-Dashboard/1.0'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flock auth API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Invalid token or failed to verify', details: errorText },
        { status: response.status }
      );
    }

    const user = await response.json();

    return NextResponse.json({
      success: true,
      user,
      accessToken: token
    });

  } catch (error) {
    console.error('Error validating Flock token:', error);
    return NextResponse.json(
      { error: 'Failed to validate token' },
      { status: 500 }
    );
  }
} 