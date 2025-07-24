/**
 * OAuth Authorization Endpoint
 * Handles OAuth authorization requests from Mattermost outgoing connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { mattermostLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const state = searchParams.get('state');
    const responseType = searchParams.get('response_type');

    mattermostLogger.info('OAuth authorization request received', {
      clientId,
      redirectUri,
      state: state?.substring(0, 8) + '...',
      responseType
    });

    // Validate required parameters
    if (!clientId || !redirectUri || !responseType) {
      return NextResponse.json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      }, { status: 400 });
    }

    if (responseType !== 'code') {
      return NextResponse.json({
        error: 'unsupported_response_type',
        error_description: 'Only authorization code flow is supported'
      }, { status: 400 });
    }

    // For simplicity, auto-approve the authorization
    // In production, you might want to show a consent screen
    const authCode = generateAuthCode();
    
    // Store the authorization code temporarily (in production, use Redis/database)
    // For now, we'll create a simple in-memory store
    storeAuthCode(authCode, clientId, redirectUri);

    mattermostLogger.info('OAuth authorization approved', {
      clientId,
      authCode: authCode.substring(0, 8) + '...'
    });

    // Redirect back to Mattermost with authorization code
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', authCode);
    if (state) {
      callbackUrl.searchParams.set('state', state);
    }

    return NextResponse.redirect(callbackUrl.toString());

  } catch (error) {
    mattermostLogger.error('OAuth authorization error', {
      error: error instanceof Error ? error.message : error
    });

    return NextResponse.json({
      error: 'server_error',
      error_description: 'Internal server error'
    }, { status: 500 });
  }
}

function generateAuthCode(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
}

// Simple in-memory store (use Redis/database in production)
const authCodes = new Map<string, {
  clientId: string;
  redirectUri: string;
  createdAt: number;
}>();

function storeAuthCode(code: string, clientId: string, redirectUri: string) {
  authCodes.set(code, {
    clientId,
    redirectUri,
    createdAt: Date.now()
  });

  // Clean up expired codes (10 minutes)
  setTimeout(() => {
    authCodes.delete(code);
  }, 10 * 60 * 1000);
}

export { authCodes };