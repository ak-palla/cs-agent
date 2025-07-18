import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/flock/webhooks/callback
 * Handle Flock webhook events and validation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🔔 Flock Webhook received:', {
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

    // Log the event for debugging
    console.log('🔔 Flock Event Data:', eventData);

    // Respond with 200 OK to acknowledge receipt
    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('💥 Error processing Flock webhook:', error);
    
    // Still return 200 OK to prevent Flock from retrying
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }
}

/**
 * GET /api/flock/webhooks/callback
 * Handle validation requests from Flock
 */
export async function GET(request: NextRequest) {
  console.log('✅ Flock webhook validation request received');
  
  // Return 200 OK for webhook URL validation
  return NextResponse.json({
    success: true,
    message: 'Flock webhook endpoint is operational',
    timestamp: new Date().toISOString()
  }, { status: 200 });
} 