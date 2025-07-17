import { NextRequest, NextResponse } from 'next/server';
import FlockApiClient from '@/lib/flock-client';

/**
 * GET /api/flock/users
 * Get users/members in team or channel
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const channelId = searchParams.get('channelId');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
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

    const users = await flockClient.getUsers(
      teamId || undefined,
      channelId || undefined
    );

    return NextResponse.json({
      success: true,
      data: users,
      total: users.length
    });

  } catch (error) {
    console.error('Error fetching Flock users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 