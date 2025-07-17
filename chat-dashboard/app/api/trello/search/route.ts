import { NextRequest, NextResponse } from 'next/server';
import TrelloApiClient from '@/lib/trello-client';

/**
 * GET /api/trello/search
 * Search across Trello boards, cards, actions, and members
 * 
 * Query parameters:
 * - query: Search query string (required)
 * - modelTypes: Comma-separated list of model types to search (boards,cards,actions,members)
 * - board_fields: Fields to return for board results
 * - cards_limit: Maximum number of cards to return
 * - boards_limit: Maximum number of boards to return
 * - partial: Whether to allow partial matches
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

    const query = searchParams.get('query');
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);

    // Parse optional parameters
    const modelTypes = searchParams.get('modelTypes')?.split(',') || ['boards', 'cards'];
    const board_fields = searchParams.get('board_fields')?.split(',') || ['id', 'name', 'desc', 'url'];
    const cards_limit = parseInt(searchParams.get('cards_limit') || '50', 10);
    const boards_limit = parseInt(searchParams.get('boards_limit') || '10', 10);
    const partial = searchParams.get('partial') === 'true';

    // Build search options
    const searchOptions = {
      modelTypes,
      board_fields,
      cards_limit,
      boards_limit
    };

    // Perform the search
    const searchResults = await trelloClient.search(query.trim(), searchOptions);

    // Enhance search results with additional metadata
    const enhancedResults = {
      query: query.trim(),
      options: searchOptions,
      results: {
        boards: searchResults.boards || [],
        cards: searchResults.cards || [],
        actions: searchResults.actions || [],
        members: searchResults.members || []
      },
      totals: {
        boards: searchResults.boards?.length || 0,
        cards: searchResults.cards?.length || 0,
        actions: searchResults.actions?.length || 0,
        members: searchResults.members?.length || 0,
        total: (searchResults.boards?.length || 0) + 
               (searchResults.cards?.length || 0) + 
               (searchResults.actions?.length || 0) + 
               (searchResults.members?.length || 0)
      }
    };

    // If partial matching is enabled, also search for similar terms
    if (partial && enhancedResults.totals.total === 0) {
      // Try variations of the search query
      const variations = generateSearchVariations(query.trim());
      
      for (const variation of variations) {
        try {
          const variationResults = await trelloClient.search(variation, searchOptions);
          
          if (variationResults.boards?.length || variationResults.cards?.length) {
            enhancedResults.results = {
              boards: variationResults.boards || [],
              cards: variationResults.cards || [],
              actions: variationResults.actions || [],
              members: variationResults.members || []
            };
            enhancedResults.query = variation;
            break;
          }
        } catch (err) {
          // Continue with next variation if this one fails
          console.log('Search variation failed:', variation, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: enhancedResults
    });

  } catch (error) {
    console.error('Error searching Trello:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate search query variations for partial matching
 */
function generateSearchVariations(query: string): string[] {
  const variations: string[] = [];
  const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
  
  // Single words
  words.forEach(word => {
    if (word.length > 2) {
      variations.push(word);
    }
  });
  
  // Partial words (if word is long enough)
  words.forEach(word => {
    if (word.length > 4) {
      variations.push(word.substring(0, word.length - 1));
      variations.push(word.substring(0, word.length - 2));
    }
  });
  
  // Word combinations (for multi-word queries)
  if (words.length > 1) {
    for (let i = 0; i < words.length - 1; i++) {
      variations.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  // Remove duplicates and original query
  return [...new Set(variations)].filter(v => v !== query.toLowerCase());
}

/**
 * POST /api/trello/search
 * Advanced search with complex filters and sorting
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
      query, 
      filters = {}, 
      sort = {}, 
      pagination = {} 
    } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const trelloClient = new TrelloApiClient(apiKey, token);

    // Build search options from filters
    const searchOptions: any = {
      modelTypes: filters.modelTypes || ['boards', 'cards'],
      board_fields: filters.board_fields || ['id', 'name', 'desc', 'url'],
      cards_limit: pagination.cardsLimit || 50,
      boards_limit: pagination.boardsLimit || 10
    };

    // Perform basic search
    let searchResults = await trelloClient.search(query.trim(), searchOptions);

    // Apply additional filters
    if (filters.boardIds && filters.boardIds.length > 0) {
      searchResults.cards = searchResults.cards?.filter(card => 
        filters.boardIds.includes(card.idBoard)
      ) || [];
      
      searchResults.boards = searchResults.boards?.filter(board => 
        filters.boardIds.includes(board.id)
      ) || [];
    }

    if (filters.memberIds && filters.memberIds.length > 0) {
      searchResults.cards = searchResults.cards?.filter(card => 
        card.idMembers.some(memberId => filters.memberIds.includes(memberId))
      ) || [];
    }

    if (filters.labelIds && filters.labelIds.length > 0) {
      searchResults.cards = searchResults.cards?.filter(card => 
        card.labels.some(label => filters.labelIds.includes(label.id))
      ) || [];
    }

    if (filters.dueDateRange) {
      const { start, end } = filters.dueDateRange;
      searchResults.cards = searchResults.cards?.filter(card => {
        if (!card.due) return false;
        const cardDue = new Date(card.due);
        const startDate = start ? new Date(start) : new Date(0);
        const endDate = end ? new Date(end) : new Date();
        return cardDue >= startDate && cardDue <= endDate;
      }) || [];
    }

    if (filters.archived !== undefined) {
      searchResults.cards = searchResults.cards?.filter(card => 
        card.closed === filters.archived
      ) || [];
    }

    // Apply sorting
    if (sort.field && sort.direction) {
      const direction = sort.direction === 'desc' ? -1 : 1;
      
      if (sort.field === 'name') {
        searchResults.cards = searchResults.cards?.sort((a, b) => 
          direction * a.name.localeCompare(b.name)
        ) || [];
        
        searchResults.boards = searchResults.boards?.sort((a, b) => 
          direction * a.name.localeCompare(b.name)
        ) || [];
      } else if (sort.field === 'dateLastActivity') {
        searchResults.cards = searchResults.cards?.sort((a, b) => 
          direction * (new Date(a.dateLastActivity).getTime() - new Date(b.dateLastActivity).getTime())
        ) || [];
      } else if (sort.field === 'due') {
        searchResults.cards = searchResults.cards?.sort((a, b) => {
          if (!a.due && !b.due) return 0;
          if (!a.due) return direction;
          if (!b.due) return -direction;
          return direction * (new Date(a.due).getTime() - new Date(b.due).getTime());
        }) || [];
      }
    }

    // Apply pagination
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const offset = (page - 1) * limit;

    const paginatedResults = {
      boards: searchResults.boards?.slice(offset, offset + limit) || [],
      cards: searchResults.cards?.slice(offset, offset + limit) || [],
      actions: searchResults.actions?.slice(offset, offset + limit) || [],
      members: searchResults.members?.slice(offset, offset + limit) || []
    };

    return NextResponse.json({
      success: true,
      data: {
        query: query.trim(),
        filters,
        sort,
        pagination: {
          page,
          limit,
          total: {
            boards: searchResults.boards?.length || 0,
            cards: searchResults.cards?.length || 0,
            actions: searchResults.actions?.length || 0,
            members: searchResults.members?.length || 0
          }
        },
        results: paginatedResults
      }
    });

  } catch (error) {
    console.error('Error performing advanced search:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform advanced search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 