import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/flock/webhook
 * Handle Flock webhook validation (for app installation)
 */
export async function GET(request: NextRequest) {
  console.log('🔍 Flock Webhook GET validation request received');
  
  // Check for challenge parameters (common webhook validation pattern)
  const url = new URL(request.url);
  const params = url.searchParams;
  
  // Log all query parameters for debugging
  console.log('📝 Query parameters:', Object.fromEntries(params));
  
  // Handle challenge-response validation (like Facebook/Meta webhooks)
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
        'ngrok-skip-browser-warning': 'true',
      }
    });
  }
  
  // If no challenge, return a simple validation response
  return new NextResponse('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'ngrok-skip-browser-warning': 'true',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
    }
  });
}

/**
 * POST /api/flock/webhook
 * Handle Flock webhook events (matches the URL in your app config)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🔔 Flock Webhook received at /api/flock/webhook:', {
      method: request.method,
      url: request.url,
      headers: headers,
      body: body ? body.substring(0, 500) : 'empty'
    });

    // Handle different types of webhook events
    let eventData;
    try {
      eventData = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.log('📄 Webhook body is not JSON, treating as text:', body);
      eventData = { rawBody: body };
    }

    // Handle challenge in POST request body (some systems do this)
    if (eventData.challenge) {
      console.log('✅ Responding to POST challenge:', eventData.challenge);
      return new NextResponse(eventData.challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'ngrok-skip-browser-warning': 'true',
        }
      });
    }

    // Log the event type if available
    if (eventData.type) {
      console.log(`📡 Flock Event Type: ${eventData.type}`);
    }

    // Return success response with ngrok bypass headers
    return NextResponse.json({
      success: true,
      message: 'Flock webhook received successfully',
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
      }
    });

  } catch (error) {
    console.error('❌ Flock webhook error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

/**
 * OPTIONS /api/flock/webhook
 * Handle preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
      'ngrok-skip-browser-warning': 'true',
    }
  });
} 