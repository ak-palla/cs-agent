import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient from '@/lib/trello-client';

/**
 * GET /api/trello/actions
 * Get Trello actions/activity for boards or cards
 * 
 * Query parameters:
 * - boardId: Get actions for a specific board
 * - cardId: Get actions for a specific card  
 * - filter: Filter by action types (e.g., "commentCard,updateCard")
 * - since: ISO date or ID for filtering actions since
 * - before: ISO date or ID for filtering actions before
 * - limit: Number of actions to return (max 1000)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey') || process.env.TRELLO_API_KEY;
    const token = searchParams.get('token') || process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return NextResponse.json(
        { error: 'Trello API key and token are required' },
        { status: 401 }
      );
    }

    const boardId = searchParams.get('boardId');
    const cardId = searchParams.get('cardId');
    const filter = searchParams.get('filter');
    const since = searchParams.get('since');
    const before = searchParams.get('before');
    const limit = searchParams.get('limit');

    if (!boardId && !cardId) {
      return NextResponse.json(
        { error: 'Either boardId or cardId is required' },
        { status: 400 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);

    // Build options object
    const options: {
      filter?: string;
      since?: string;
      before?: string;
      limit?: number;
    } = {};

    if (filter) options.filter = filter;
    if (since) options.since = since;
    if (before) options.before = before;
    if (limit) options.limit = parseInt(limit, 10);

    let actions;
    let source;

    if (boardId) {
      actions = await trelloClient.getBoardActions(boardId, options);
      source = { type: 'board', id: boardId };
    } else if (cardId) {
      actions = await trelloClient.getCardActions(cardId, options);
      source = { type: 'card', id: cardId };
    }

    return NextResponse.json({
      success: true,
      data: actions,
      total: actions?.length || 0,
      source,
      filters: {
        filter,
        since,
        before,
        limit: options.limit
      }
    });

  } catch (error) {
    console.error('Error fetching Trello actions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch actions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 