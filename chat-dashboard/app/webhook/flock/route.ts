import { NextRequest, NextResponse } from 'next/server';

/**
 * Public Flock Webhook Handler - No Authentication Required
 * This endpoint is specifically for Flock webhook validation
 */

export async function GET(request: NextRequest) {
  console.log('🔍 Public Flock Webhook GET validation request received');
  
  const url = new URL(request.url);
  const params = url.searchParams;
  
  console.log('📝 Query parameters:', Object.fromEntries(params));
  
  const challenge = params.get('hub.challenge') || params.get('challenge');
  const mode = params.get('hub.mode') || params.get('mode');
  const verifyToken = params.get('hub.verify_token') || params.get('verify_token');
  
  console.log('🔐 Validation attempt:', { challenge, mode, verifyToken });
  
  if (challenge) {
    console.log('✅ Responding to challenge:', challenge);
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
  
  return new NextResponse('FLOCK_WEBHOOK_VALIDATION_OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🔔 Public Flock Webhook received:', {
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

    if (eventData.challenge) {
      console.log('✅ Responding to POST challenge:', eventData.challenge);
      return new NextResponse(eventData.challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    if (eventData.type) {
      console.log(`📡 Flock Event Type: ${eventData.type}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Flock webhook received successfully',
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
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
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}