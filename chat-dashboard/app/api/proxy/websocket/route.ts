import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    return new Response('Token required', { status: 400 });
  }

  const mattermostWsUrl = process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || 'wss://teams.webuildtrades.co';
  const wsUrl = `${mattermostWsUrl}/api/v4/websocket?token=${token}`;

  // For WebSocket connections, we need to handle this differently
  // This endpoint will be used by the client to get the correct WebSocket URL
  return Response.json({ 
    wsUrl: wsUrl.replace('wss://', 'ws://'), // Convert to insecure WebSocket for localhost
    message: 'Use this URL for WebSocket connection'
  });
}