import { NextRequest, NextResponse } from 'next/server';
import { ServerActivityProcessor } from '@/lib/server-activity-processor';

const serverProcessor = new ServerActivityProcessor();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const activities = await serverProcessor.getRecentActivities(
      platform === 'all' || !platform ? undefined : platform as any,
      limit,
      offset
    );

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}