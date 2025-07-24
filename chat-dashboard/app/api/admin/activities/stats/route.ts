import { NextRequest, NextResponse } from 'next/server';
import { ServerActivityProcessor } from '@/lib/server-activity-processor';

const serverProcessor = new ServerActivityProcessor();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '24h' | '7d' | '30d' || '24h';

    const stats = await serverProcessor.getActivityStats(timeframe);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity statistics' },
      { status: 500 }
    );
  }
}