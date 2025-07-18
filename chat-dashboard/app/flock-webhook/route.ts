import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /flock-webhook
 * Alternative Flock webhook endpoint to bypass ngrok issues
 */
export async function GET(request: NextRequest) {
  console.log('🔍 Alternative Flock Webhook GET validation request received');
  
  // Check for challenge parameters
  const url = new URL(request.url);
  const params = url.searchParams;
  
  console.log('📝 Query parameters:', Object.fromEntries(params));
  
  const challenge = params.get('hub.challenge') || params.get('challenge');
  const mode = params.get('hub.mode') || params.get('mode');
  const verifyToken = params.get('hub.verify_token') || params.get('verify_token');
  
  console.log('🔐 Validation attempt:', { challenge, mode, verifyToken });
  
  // If this is a challenge request, respond with the challenge
  if (challenge) {
    console.log('✅ Responding to challenge:', challenge);
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      }
    });
  }
  
  // Return a simple validation response
  return new NextResponse('FLOCK_WEBHOOK_OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-Flock-Webhook': 'validated',
    }
  });
}

/**
 * POST /flock-webhook
 * Handle Flock webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🔔 Alternative Flock Webhook received:', {
      method: request.method,
      url: request.url,
      headers: headers,
      body: body ? body.substring(0, 500) : 'empty'
    });

    let eventData;
    try {
      eventData = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.log('📄 Webhook body is not JSON:', body);
      eventData = { rawBody: body };
    }

    // Handle challenge in POST request body
    if (eventData.challenge) {
      console.log('✅ Responding to POST challenge:', eventData.challenge);
      return new NextResponse(eventData.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (eventData.type) {
      console.log(`📡 Flock Event Type: ${eventData.type}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Flock webhook received successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Flock webhook error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 