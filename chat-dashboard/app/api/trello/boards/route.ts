import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient, { CreateBoardRequest } from '@/lib/trello-client';

/**
 * GET /api/trello/boards
 * Get all boards for the authenticated user
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

    const trelloClient = new TrelloApiClient(apiKey, token);
    
    // Test connection first
    const isConnected = await trelloClient.testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Failed to connect to Trello API. Please check your credentials.' },
        { status: 401 }
      );
    }

    const boards = await trelloClient.getBoards();
    
    return NextResponse.json({
      success: true,
      data: boards,
      total: boards.length
    });

  } catch (error) {
    console.error('Error fetching Trello boards:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch boards',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trello/boards
 * Create a new board
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, desc, idOrganization, prefs } = body as CreateBoardRequest & { prefs?: any };

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Board name is required' },
        { status: 400 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);

    // Create board data
    const boardData: CreateBoardRequest = {
      name: name.trim(),
      ...(desc && { desc }),
      ...(idOrganization && { idOrganization }),
      ...(prefs?.permissionLevel && { prefs_permissionLevel: prefs.permissionLevel }),
      ...(prefs?.voting && { prefs_voting: prefs.voting }),
      ...(prefs?.comments && { prefs_comments: prefs.comments }),
      ...(prefs?.invitations && { prefs_invitations: prefs.invitations }),
      ...(prefs?.selfJoin !== undefined && { prefs_selfJoin: prefs.selfJoin }),
      ...(prefs?.cardCovers !== undefined && { prefs_cardCovers: prefs.cardCovers }),
      ...(prefs?.background && { prefs_background: prefs.background })
    };

    const newBoard = await trelloClient.createBoard(boardData);

    return NextResponse.json({
      success: true,
      data: newBoard
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating Trello board:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create board',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 