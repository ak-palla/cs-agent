/**
 * POST /api/activities/store
 * Store activity data in Supabase (server-side)
 */

import { NextRequest, NextResponse } from 'next/server';
import { serverActivityProcessor } from '@/lib/server-activity-processor';
import { ActivityData } from '@/lib/activity-processor';

export async function POST(request: NextRequest) {
  try {
    const activityData: ActivityData = await request.json();
    
    console.log('📝 Storing activity via API:', {
      platform: activityData.platform,
      event_type: activityData.event_type,
      user_id: activityData.user_id,
      channel_id: activityData.channel_id
    });

    // Validate required fields
    if (!activityData.platform || !activityData.event_type) {
      return NextResponse.json(
        { error: 'Missing required fields: platform and event_type' },
        { status: 400 }
      );
    }

    // Store activity using server-side processor
    const storedActivity = await serverActivityProcessor.storeActivity(activityData);
    
    if (!storedActivity) {
      return NextResponse.json(
        { error: 'Failed to store activity' },
        { status: 500 }
      );
    }

    console.log('✅ Activity stored successfully via API:', {
      id: storedActivity.id,
      platform: storedActivity.platform,
      event_type: storedActivity.event_type
    });

    return NextResponse.json({
      success: true,
      data: storedActivity
    });

  } catch (error) {
    console.error('❌ Error storing activity via API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to store activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}