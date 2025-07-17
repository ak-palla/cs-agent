import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/flock/teams
 * Get teams for authenticated user
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

    // Call Flock API to get teams
    const response = await fetch(`${flockApiUrl}/teams`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CS-Agent-Dashboard/1.0'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flock teams API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch teams', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const teams = data.result || data || [];

    return NextResponse.json({
      success: true,
      data: teams,
      total: teams.length
    });

  } catch (error) {
    console.error('Error fetching Flock teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
} 