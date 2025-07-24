import { NextRequest, NextResponse } from 'next/server';
import { ServerActivityProcessor } from '@/lib/server-activity-processor';

const serverProcessor = new ServerActivityProcessor();

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Activity store API called');
    
    const activityData = await request.json();
    console.log('📝 Received activity data:', {
      platform: activityData.platform,
      event_type: activityData.event_type,
      user_id: activityData.user_id,
      channel_id: activityData.channel_id,
      hasData: !!activityData.data,
      timestamp: activityData.timestamp
    });

    // Check environment variables
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('📝 Environment check:', { hasSupabaseUrl, hasSupabaseKey, hasServiceKey });

    if (!hasSupabaseUrl || !hasServiceKey) {
      console.error('❌ Missing Supabase environment variables', { hasSupabaseUrl, hasServiceKey });
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    const result = await serverProcessor.storeActivity(activityData);

    if (result) {
      console.log('✅ Activity stored successfully:', result.id);
      return NextResponse.json({ success: true, activity: result });
    } else {
      console.error('❌ serverProcessor.storeActivity returned null');
      return NextResponse.json(
        { error: 'Failed to store activity - processor returned null' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error in activity store API:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        error: 'Failed to store activity', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}