import { NextRequest, NextResponse } from 'next/server';
import FlockApiClient from '@/lib/flock-client';

/**
 * POST /api/flock/files/upload
 * Upload a file to Flock
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const channelId = formData.get('channelId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
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

    const attachment = await flockClient.uploadFile(file, channelId);

    if (!attachment) {
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: attachment
    });

  } catch (error) {
    console.error('Error uploading file to Flock:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 