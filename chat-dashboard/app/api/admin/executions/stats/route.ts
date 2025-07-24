import { NextRequest, NextResponse } from 'next/server';
import { ServerActivityProcessor } from '@/lib/server-activity-processor';

const serverProcessor = new ServerActivityProcessor();

export async function GET() {
  try {
    const stats = await serverProcessor.getExecutionStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching execution stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution statistics' },
      { status: 500 }
    );
  }
}