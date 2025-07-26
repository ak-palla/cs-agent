import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/flock/app-install
 * Flock app installation validation endpoint
 * This is the URL you configure in your Flock app settings
 */
export async function GET(request: NextRequest) {
  console.log('🔍 Flock app.install validation request received');
  
  // Flock sends a challenge parameter during app installation
  const url = new URL(request.url);
  const challenge = url.searchParams.get('challenge');
  
  if (challenge) {
    console.log('✅ Flock app.install challenge:', challenge);
    // Return the challenge as plain text - this is required by Flock
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
  
  // For regular GET requests
  return new NextResponse('Flock app install endpoint ready', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}

/**
 * POST /api/flock/app-install
 * Handle Flock app.install event
 * This receives the actual app.install webhook from Flock
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Flock app.install event received:', body);
    
    // Flock sends app.install event with user and app details
    const { name, userId, token, user_token } = body;
    
    if (name === 'app.install') {
      console.log('✅ Flock app installed successfully:', {
        userId,
        token: token ? '***RECEIVED***' : 'MISSING',
        user_token: user_token ? '***RECEIVED***' : 'MISSING'
      });
      
      // Store the token for future API calls
      // You would typically save this to your database here
      
      return NextResponse.json({
        success: true,
        message: 'App installed successfully'
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Event processed'
    });
    
  } catch (error) {
    console.error('❌ Flock app.install error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process app.install'
    }, { status: 500 });
  }
}

/**
 * OPTIONS /api/flock/app-install
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}