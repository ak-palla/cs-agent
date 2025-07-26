/**
 * Flock Connection Handler for Installed Apps
 * Handles app token authentication and connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFlockInstalledClient } from '@/lib/flock-installed-client';
import { flockLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || searchParams.get('app_token');

    if (!token) {
      // Redirect to token input page
      const tokenUrl = new URL('/flock/connect', request.url);
      return NextResponse.redirect(tokenUrl);
    }

    const client = createFlockInstalledClient();
    
    // Validate the token
    const isValid = await client.validateToken(token);
    
    if (isValid) {
      // Store token in session
      const response = NextResponse.redirect(new URL('/flock', request.url));
      response.cookies.set('flock_app_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
      
      flockLogger.info('Flock connection successful', { duration: Date.now() - startTime });
      return response;
    } else {
      return NextResponse.redirect(new URL('/flock?error=invalid_token', request.url));
    }

  } catch (error) {
    flockLogger.error('Flock connection error', { error });
    return NextResponse.redirect(new URL('/flock?error=connection_failed', request.url));
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({
        error: 'Missing token',
        message: 'Please provide your Flock app token'
      }, { status: 400 });
    }

    const client = createFlockInstalledClient();
    const isValid = await client.validateToken(token);

    if (isValid) {
      const response = NextResponse.json({ success: true });
      response.cookies.set('flock_app_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
      
      return response;
    } else {
      return NextResponse.json({
        error: 'Invalid token',
        message: 'The provided Flock app token is invalid'
      }, { status: 401 });
    }

  } catch (error) {
    flockLogger.error('Flock token validation error', { error });
    return NextResponse.json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}