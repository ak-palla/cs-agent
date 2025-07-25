/**
 * Trello OAuth Logout Route
 * Clears stored Trello tokens and logs out the user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET(request: NextRequest) {
  try {
    trelloLogger.info('Trello OAuth logout initiated');

    const trelloOAuth = createTrelloOAuth();

    // Clear stored tokens
    trelloOAuth.clearStoredToken();

    trelloLogger.info('Trello OAuth logout completed successfully');

    // Get redirect URL from query params or default to home
    const { searchParams } = new URL(request.url);
    const redirectTo = searchParams.get('redirect') || '/';

    // Redirect with logout success message
    const logoutUrl = new URL(redirectTo, request.url);
    logoutUrl.searchParams.set('trello_logout', 'success');
    logoutUrl.searchParams.set('message', 'Successfully disconnected from Trello');
    
    return NextResponse.redirect(logoutUrl.toString());

  } catch (error) {
    trelloLogger.error('Trello OAuth logout error', {
      error: error instanceof Error ? error.message : error
    });

    // Even if there's an error, we should still try to redirect
    const errorUrl = new URL('/', request.url);
    errorUrl.searchParams.set('error', 'trello_logout_failed');
    errorUrl.searchParams.set('message', 'Logout may not have completed properly');
    
    return NextResponse.redirect(errorUrl.toString());
  }
}

export async function POST(request: NextRequest) {
  try {
    mattermostLogger.info('Trello OAuth logout via POST');

    const trelloOAuth = createTrelloOAuth();

    // Clear stored tokens
    trelloOAuth.clearStoredToken();

    trelloLogger.info('Trello OAuth logout completed successfully');

    // Return JSON response for API calls
    return NextResponse.json({
      success: true,
      message: 'Successfully disconnected from Trello'
    });

  } catch (error) {
    trelloLogger.error('Trello OAuth logout error', {
      error: error instanceof Error ? error.message : error
    });

    return NextResponse.json({
      success: false,
      error: 'Logout failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}