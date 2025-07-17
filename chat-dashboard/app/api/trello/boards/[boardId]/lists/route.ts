import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient, { CreateListRequest } from '@/lib/trello-client';

/**
 * GET /api/trello/boards/[boardId]/lists
 * Get all lists for a specific board
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

    const lists = await trelloClient.getLists(boardId);

    return NextResponse.json({
      success: true,
      data: lists,
      total: lists.length
    });

  } catch (error) {
    console.error('Error fetching Trello lists:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch lists',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trello/boards/[boardId]/lists
 * Create a new list in a specific board
 */
export async function POST(
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
    const { name, pos } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);

    const listData: CreateListRequest = {
      name: name.trim(),
      idBoard: boardId,
      ...(pos !== undefined && { pos })
    };

    const newList = await trelloClient.createList(listData);

    return NextResponse.json({
      success: true,
      data: newList
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating Trello list:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create list',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 