import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const testUrl = process.env.NEXT_PUBLIC_FLOCK_WEBHOOK_URL || 'https://localhost:3000/api/flock/app-install';
  
  return NextResponse.json({
    message: 'Flock app installation test',
    webhookUrl: testUrl,
    instructions: [
      '1. Go to https://dev.flock.com',
      '2. Find your app configuration',
      '3. Set the Event Listener URL to: ' + testUrl,
      '4. Save and try installing the app again',
      '5. Check server logs for webhook events'
    ],
    testChallenge: testUrl + '?challenge=test123'
  });
}