import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient, { CreateCardRequest } from '@/lib/trello-client';

/**
 * POST /api/trello/cards
 * Create a new card
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
    const { 
      name, 
      desc, 
      idList, 
      pos, 
      due, 
      idMembers, 
      idLabels, 
      urlSource 
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Card name is required' },
        { status: 400 }
      );
    }

    if (!idList) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);

    const cardData: CreateCardRequest = {
      name: name.trim(),
      idList,
      ...(desc && { desc }),
      ...(pos !== undefined && { pos }),
      ...(due && { due }),
      ...(idMembers && { idMembers }),
      ...(idLabels && { idLabels }),
      ...(urlSource && { urlSource })
    };

    const newCard = await trelloClient.createCard(cardData);

    return NextResponse.json({
      success: true,
      data: newCard
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating Trello card:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 