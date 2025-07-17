import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient, { CreateBoardRequest } from '@/lib/trello-client';

/**
 * GET /api/trello/boards/[boardId]
 * Get a specific board with its lists and cards
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
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

    const { boardId } = await params;
    const trelloClient = new TrelloApiClient(apiKey, token);

    const board = await trelloClient.getBoard(boardId);

    return NextResponse.json({
      success: true,
      data: board
    });

  } catch (error) {
    console.error('Error fetching Trello board:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trello/boards/[boardId]
 * Update a specific board
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
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

    const { boardId } = await params;
    const body = await request.json();
    const { name, desc, closed, prefs } = body;

    const trelloClient = new TrelloApiClient(apiKey, token);

    // Build update data
    const updateData: Partial<CreateBoardRequest> = {};
    
    if (name !== undefined) updateData.name = name;
    if (desc !== undefined) updateData.desc = desc;
    if (closed !== undefined) updateData.closed = closed;
    
    if (prefs) {
      if (prefs.permissionLevel) updateData.prefs_permissionLevel = prefs.permissionLevel;
      if (prefs.voting) updateData.prefs_voting = prefs.voting;
      if (prefs.comments) updateData.prefs_comments = prefs.comments;
      if (prefs.invitations) updateData.prefs_invitations = prefs.invitations;
      if (prefs.selfJoin !== undefined) updateData.prefs_selfJoin = prefs.selfJoin;
      if (prefs.cardCovers !== undefined) updateData.prefs_cardCovers = prefs.cardCovers;
      if (prefs.background) updateData.prefs_background = prefs.background;
    }

    const updatedBoard = await trelloClient.updateBoard(boardId, updateData);

    return NextResponse.json({
      success: true,
      data: updatedBoard
    });

  } catch (error) {
    console.error('Error updating Trello board:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trello/boards/[boardId]
 * Delete a specific board
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
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

    const { boardId } = await params;
    const trelloClient = new TrelloApiClient(apiKey, token);

    await trelloClient.deleteBoard(boardId);

    return NextResponse.json({
      success: true,
      message: 'Board deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting Trello board:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 