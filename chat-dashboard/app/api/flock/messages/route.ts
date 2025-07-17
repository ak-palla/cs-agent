import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/flock/messages
 * Get messages from a channel
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const limit = searchParams.get('limit') || '50';
    const before = searchParams.get('before');
    const after = searchParams.get('after');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID required' },
        { status: 400 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const flockApiUrl = process.env.FLOCK_API_URL || 'https://api.flock.co/v1';

    // Build query parameters for Flock API
    const params = new URLSearchParams({
      channel: channelId,
      limit: limit
    });
    
    if (before) params.append('before', before);
    if (after) params.append('after', after);

    // Call Flock API directly
    const response = await fetch(`${flockApiUrl}/chat.getHistory?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CS-Agent-Dashboard/1.0'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flock messages API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch messages', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const messages = data.result || data || [];

    return NextResponse.json({
      success: true,
      data: messages,
      total: messages.length
    });

  } catch (error) {
    console.error('Error fetching Flock messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flock/messages
 * Send a message to a channel or user
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { to, text, html, attachments, threadId } = await request.json();

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    if (!to || !text) {
      return NextResponse.json(
        { error: 'Recipient (to) and message text are required' },
        { status: 400 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const flockApiUrl = process.env.FLOCK_API_URL || 'https://api.flock.co/v1';

    // Prepare message data for Flock API
    const messageData = {
      to,
      text,
      html,
      attachments,
      threadId
    };

    // Call Flock API to send message
    const response = await fetch(`${flockApiUrl}/chat.sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CS-Agent-Dashboard/1.0'
      },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flock send message API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to send message', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const message = data.result || data;

    return NextResponse.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Error sending Flock message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
} 