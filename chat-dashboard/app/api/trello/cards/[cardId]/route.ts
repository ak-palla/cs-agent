import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient, { UpdateCardRequest } from '@/lib/trello-client';

/**
 * GET /api/trello/cards/[cardId]
 * Get a specific card with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
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

    const { cardId } = await params;
    const trelloClient = new TrelloApiClient(apiKey, token);

    const card = await trelloClient.getCard(cardId);

    return NextResponse.json({
      success: true,
      data: card
    });

  } catch (error) {
    console.error('Error fetching Trello card:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trello/cards/[cardId]
 * Update a specific card
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
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

    const { cardId } = await params;
    const body = await request.json();
    
    const trelloClient = new TrelloApiClient(apiKey, token);

    // Build update data from request body
    const updateData: UpdateCardRequest = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.desc !== undefined) updateData.desc = body.desc;
    if (body.closed !== undefined) updateData.closed = body.closed;
    if (body.idList !== undefined) updateData.idList = body.idList;
    if (body.pos !== undefined) updateData.pos = body.pos;
    if (body.due !== undefined) updateData.due = body.due;
    if (body.dueComplete !== undefined) updateData.dueComplete = body.dueComplete;
    if (body.idMembers !== undefined) updateData.idMembers = body.idMembers;
    if (body.idLabels !== undefined) updateData.idLabels = body.idLabels;

    const updatedCard = await trelloClient.updateCard(cardId, updateData);

    return NextResponse.json({
      success: true,
      data: updatedCard
    });

  } catch (error) {
    console.error('Error updating Trello card:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trello/cards/[cardId]
 * Delete a specific card
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
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

    const { cardId } = await params;
    const trelloClient = new TrelloApiClient(apiKey, token);

    await trelloClient.deleteCard(cardId);

    return NextResponse.json({
      success: true,
      message: 'Card deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting Trello card:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 