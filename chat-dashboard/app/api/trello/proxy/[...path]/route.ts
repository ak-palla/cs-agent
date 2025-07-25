/**
 * Trello API Proxy Route
 * Handles authenticated requests from the browser to Trello API
 * This solves the crypto/environment variable issue by keeping OAuth on the server
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const body = await request.text();
  return handleProxyRequest(request, params.path, 'POST', body);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const body = await request.text();
  return handleProxyRequest(request, params.path, 'PUT', body);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params.path, 'DELETE');
}

async function handleProxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: string
) {
  try {
    const trelloOAuth = createTrelloOAuth();
    
    if (!trelloOAuth.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated with Trello' }, 
        { status: 401 }
      );
    }

    const path = pathSegments.join('/');
    const searchParams = request.next.search;
    const url = `https://api.trello.com/1/${path}${searchParams}`;

    trelloLogger.info('Proxying Trello API request', {
      method,
      url: url.replace(/key=[^&]+/g, 'key=***'),
      path
    });

    const response = await trelloOAuth.makeAuthenticatedRequest(
      url,
      method,
      body ? JSON.parse(body) : undefined
    );

    return NextResponse.json(response);
  } catch (error) {
    trelloLogger.error('Trello proxy request failed', {
      error: error instanceof Error ? error.message : error,
      method,
      path: pathSegments.join('/')
    });

    return NextResponse.json(
      { 
        error: 'Trello API request failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}