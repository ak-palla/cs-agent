/**
 * OAuth Token Endpoint
 * Exchanges authorization codes for access tokens for Mattermost outgoing connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { mattermostLogger } from '@/lib/logger';
import { authCodes } from '../authorize/route';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const grantType = formData.get('grant_type');
    const code = formData.get('code') as string;
    const clientId = formData.get('client_id') as string;
    const clientSecret = formData.get('client_secret') as string;
    const redirectUri = formData.get('redirect_uri') as string;

    mattermostLogger.info('OAuth token request received', {
      grantType,
      clientId,
      code: code?.substring(0, 8) + '...',
      redirectUri
    });

    // Validate grant type
    if (grantType !== 'authorization_code') {
      return NextResponse.json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization code grant is supported'
      }, { status: 400 });
    }

    // Validate required parameters
    if (!code || !clientId || !redirectUri) {
      return NextResponse.json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      }, { status: 400 });
    }

    // Validate authorization code
    const storedAuth = authCodes.get(code);
    if (!storedAuth) {
      mattermostLogger.error('Invalid or expired authorization code', { code });
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      }, { status: 400 });
    }

    // Validate client and redirect URI
    if (storedAuth.clientId !== clientId || storedAuth.redirectUri !== redirectUri) {
      mattermostLogger.error('Client ID or redirect URI mismatch', {
        providedClientId: clientId,
        storedClientId: storedAuth.clientId,
        providedRedirectUri: redirectUri,
        storedRedirectUri: storedAuth.redirectUri
      });
      
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Invalid client or redirect URI'
      }, { status: 400 });
    }

    // Check if code is expired (10 minutes)
    if (Date.now() - storedAuth.createdAt > 10 * 60 * 1000) {
      authCodes.delete(code);
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Authorization code expired'
      }, { status: 400 });
    }

    // Generate access token
    const accessToken = generateAccessToken();
    const refreshToken = generateRefreshToken();

    // Store tokens (in production, use database)
    storeTokens(accessToken, refreshToken, clientId);

    // Clean up used authorization code
    authCodes.delete(code);

    mattermostLogger.info('OAuth token issued successfully', {
      clientId,
      tokenLength: accessToken.length
    });

    // Return token response
    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour
      refresh_token: refreshToken,
      scope: 'read write'
    });

  } catch (error) {
    mattermostLogger.error('OAuth token error', {
      error: error instanceof Error ? error.message : error
    });

    return NextResponse.json({
      error: 'server_error',
      error_description: 'Internal server error'
    }, { status: 500 });
  }
}

function generateAccessToken(): string {
  return 'dashboard_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36);
}

function generateRefreshToken(): string {
  return 'refresh_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36);
}

// Simple token store (use Redis/database in production)
const tokens = new Map<string, {
  refreshToken: string;
  clientId: string;
  createdAt: number;
}>();

// Clear all tokens (for development/testing)
export function clearAllTokens() {
  tokens.clear();
  console.log('All OAuth tokens cleared');
}

function storeTokens(accessToken: string, refreshToken: string, clientId: string) {
  tokens.set(accessToken, {
    refreshToken,
    clientId,
    createdAt: Date.now()
  });

  // Clean up expired tokens (1 hour)
  setTimeout(() => {
    tokens.delete(accessToken);
  }, 60 * 60 * 1000);
}

export { tokens };