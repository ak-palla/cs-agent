'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Settings, Search, Filter, MoreHorizontal, Calendar, User, Tag, AlertCircle, Star, UserPlus, X, Info } from 'lucide-react';
import { TrelloBoard as TrelloBoardType, TrelloList as TrelloListType, TrelloCard as TrelloCardType, TrelloAction, TrelloMember } from '@/lib/trello-client';
import TrelloListComponent from './TrelloList';
import TrelloCardComponent from './TrelloCard';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface TrelloBoardProps {
  apiKey: string;
  token: string;
  boardId?: string;
  onBoardChange?: (board: TrelloBoardType) => void;
}

interface CreateCardForm {
  listId: string;
  name: string;
  desc: string;
  due?: string;
}

interface CreateListForm {
  name: string;
}

export default function TrelloBoard({ apiKey, token, boardId, onBoardChange }: TrelloBoardProps) {
  // State management
  const [board, setBoard] = useState<TrelloBoardType | null>(null);
  const [boards, setBoards] = useState<TrelloBoardType[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>(boardId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [showCreateCard, setShowCreateCard] = useState<string | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    members: [] as string[],
    labels: [] as string[],
    dueDates: 'all' as 'all' | 'overdue' | 'due_soon' | 'no_due'
  });

  // Board search state
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState(-1);

  // Form state
  const [createCardForm, setCreateCardForm] = useState<CreateCardForm>({
    listId: '',
    name: '',
    desc: '',
    due: ''
  });
  const [createListForm, setCreateListForm] = useState<CreateListForm>({
    name: ''
  });

  // Drag and drop state
  const [activeCard, setActiveCard] = useState<TrelloCardType | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Fetch all boards for the authenticated user
   */
  const fetchBoards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/trello/boards?apiKey=${apiKey}&token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch boards');
      }

      setBoards(data.data || []);
      
      // If no boardId is selected and we have boards, select the first one
      if (!selectedBoardId && data.data && data.data.length > 0) {
        setSelectedBoardId(data.data[0].id);
      }

    } catch (err) {
      console.error('Error fetching boards:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch boards');
    } finally {
      setLoading(false);
    }
  }, [apiKey, token, selectedBoardId]);

  /**
   * Fetch a specific board with its lists and cards
   */
  const fetchBoard = useCallback(async (boardIdToFetch: string) => {
    if (!boardIdToFetch) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/trello/boards/${boardIdToFetch}?apiKey=${apiKey}&token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch board');
      }

      console.log('Board data received:', data.data);
      console.log('Lists with cards:', data.data.lists?.map(list => ({
        name: list.name,
        cardCount: list.cards?.length || 0,
        cards: list.cards?.map(card => card.name) || []
      })));
      
      setBoard(data.data);
      onBoardChange?.(data.data);

    } catch (err) {
      console.error('Error fetching board:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch board');
    } finally {
      setLoading(false);
    }
  }, [apiKey, token, onBoardChange]);

  /**
   * Create a new list
   */
  const createList = async () => {
    if (!selectedBoardId || !createListForm.name.trim()) return;

    try {
      const response = await fetch(`/api/trello/boards/${selectedBoardId}/lists?apiKey=${apiKey}&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createListForm.name.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create list');
      }

      // Refresh the board to show new list
      await fetchBoard(selectedBoardId);
      setCreateListForm({ name: '' });
      setShowCreateList(false);

    } catch (err) {
      console.error('Error creating list:', err);
      setError(err instanceof Error ? err.message : 'Failed to create list');
    }
  };

  /**
   * Create a new card
   */
  const createCard = async () => {
    if (!createCardForm.listId || !createCardForm.name.trim()) return;

    try {
      const cardData = {
        name: createCardForm.name.trim(),
        idList: createCardForm.listId,
        ...(createCardForm.desc && { desc: createCardForm.desc }),
        ...(createCardForm.due && { due: new Date(createCardForm.due).toISOString() })
      };

      const response = await fetch(`/api/trello/cards?apiKey=${apiKey}&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create card');
      }

      // Refresh the board to show new card
      await fetchBoard(selectedBoardId);
      setCreateCardForm({ listId: '', name: '', desc: '', due: '' });
      setShowCreateCard(null);

    } catch (err) {
      console.error('Error creating card:', err);
      setError(err instanceof Error ? err.message : 'Failed to create card');
    }
  };

  /**
   * Move card to different list (drag and drop)
   */
  const moveCard = async (cardId: string, newListId: string) => {
    try {
      const response = await fetch(`/api/trello/cards/${cardId}?apiKey=${apiKey}&token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idList: newListId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to move card');
      }

      // Refresh the board to show updated positions
      await fetchBoard(selectedBoardId);

    } catch (err) {
      console.error('Error moving card:', err);
      setError(err instanceof Error ? err.message : 'Failed to move card');
    }
  };

  /**
   * Enhanced search function with multiple criteria
   */
  const searchCards = (cards: TrelloCardType[], query: string): TrelloCardType[] => {
    if (!query.trim()) return cards;
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return cards.filter(card => {
      // Search in card name (highest priority)
      const cardName = card.name.toLowerCase();
      const nameMatches = searchTerms.every(term => cardName.includes(term));
      
      // Search in card description
      const cardDesc = card.desc.toLowerCase();
      const descMatches = searchTerms.every(term => cardDesc.includes(term));
      
      // Search in card labels
      const labelMatches = searchTerms.some(term => 
        card.labels.some(label => 
          label.name.toLowerCase().includes(term) || 
          label.color.toLowerCase().includes(term)
        )
      );
      
      // Search in member names (if we have member data)
      const memberMatches = searchTerms.some(term => 
        card.idMembers.some(memberId => {
          const member = board?.members?.find(m => m.id === memberId);
          return member && (
            member.fullName.toLowerCase().includes(term) || 
            member.username.toLowerCase().includes(term)
          );
        })
      );
      
      // Search for special keywords
      const specialKeywordMatches = searchTerms.some(term => {
        switch (term) {
          case 'overdue':
            return card.due && new Date(card.due) < new Date() && !card.dueComplete;
          case 'due':
            return card.due && !card.dueComplete;
          case 'complete':
          case 'completed':
            return card.dueComplete;
          case 'no-due':
          case 'nodue':
            return !card.due;
          case 'has-members':
          case 'assigned':
            return card.idMembers.length > 0;
          case 'no-members':
          case 'unassigned':
            return card.idMembers.length === 0;
          case 'has-labels':
            return card.labels.length > 0;
          case 'no-labels':
            return card.labels.length === 0;
          case 'has-comments':
            return card.badges.comments > 0;
          case 'has-attachments':
            return card.badges.attachments > 0;
          default:
            return false;
        }
      });
      
      return nameMatches || descMatches || labelMatches || memberMatches || specialKeywordMatches;
    });
  };

  /**
   * Filter cards based on search query and filter options
   */
  const filterCards = (cards: TrelloCardType[]): TrelloCardType[] => {
    let filteredCards = cards;
    
    // Apply search filter
    if (searchQuery) {
      filteredCards = searchCards(filteredCards, searchQuery);
    }
    
    // Apply other filters
    return filteredCards.filter(card => {
      // Member filter
      if (filterOptions.members.length > 0) {
        const hasMatchingMember = card.idMembers.some(memberId => 
          filterOptions.members.includes(memberId)
        );
        if (!hasMatchingMember) return false;
      }

      // Label filter
      if (filterOptions.labels.length > 0) {
        const hasMatchingLabel = card.labels.some(label => 
          filterOptions.labels.includes(label.id)
        );
        if (!hasMatchingLabel) return false;
      }

      // Due date filter
      if (filterOptions.dueDates !== 'all') {
        const now = new Date();
        const cardDue = card.due ? new Date(card.due) : null;

        switch (filterOptions.dueDates) {
          case 'overdue':
            if (!cardDue || cardDue > now || card.dueComplete) return false;
            break;
          case 'due_soon':
            if (!cardDue || cardDue <= now || card.dueComplete) return false;
            const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            if (cardDue > threeDaysFromNow) return false;
            break;
          case 'no_due':
            if (cardDue) return false;
            break;
        }
      }

      return true;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = findCardById(active.id as string);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveCard(null);
      return;
    }

    // Check if dropping on a different list
    const activeCard = findCardById(active.id as string);
    const overId = over.id as string;
    
    if (activeCard) {
      // Check if dropping on a list or another card
      const overList = findListById(overId);
      const overCard = findCardById(overId);
      
      if (overList && activeCard.idList !== overList.id) {
        // Moving to a different list
        moveCard(activeCard.id, overList.id);
      } else if (overCard && activeCard.idList !== overCard.idList) {
        // Moving to a different list (via card)
        moveCard(activeCard.id, overCard.idList);
      }
    }
    
    setActiveCard(null);
  };

  const findCardById = (cardId: string): TrelloCardType | null => {
    if (!board?.lists) return null;
    
    for (const list of board.lists) {
      if (list.cards) {
        const card = list.cards.find(c => c.id === cardId);
        if (card) return card;
      }
    }
    return null;
  };

  const findListById = (listId: string): TrelloListType | null => {
    if (!board?.lists) return null;
    return board.lists.find(l => l.id === listId) || null;
  };

  /**
   * Calculate search results statistics
   */
  const getSearchStats = () => {
    if (!board?.lists || !searchQuery.trim()) return null;
    
    const allCards = board.lists.flatMap(list => list.cards || []);
    const filteredCards = filterCards(allCards);
    
    return {
      totalCards: allCards.length,
      matchingCards: filteredCards.length,
      searchTerms: searchQuery.toLowerCase().split(' ').filter(term => term.length > 0)
    };
  };

  /**
   * Generate search suggestions based on current query
   */
  const getSearchSuggestions = () => {
    if (!board?.lists || !searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions = [];
    
    // Special keyword suggestions
    const keywords = [
      { text: 'overdue', description: 'Cards that are overdue' },
      { text: 'due', description: 'Cards with due dates' },
      { text: 'completed', description: 'Completed cards' },
      { text: 'no-due', description: 'Cards without due dates' },
      { text: 'assigned', description: 'Cards with assigned members' },
      { text: 'unassigned', description: 'Cards without assigned members' },
      { text: 'has-labels', description: 'Cards with labels' },
      { text: 'has-comments', description: 'Cards with comments' },
      { text: 'has-attachments', description: 'Cards with attachments' }
    ];
    
    // Add matching keywords
    keywords.forEach(keyword => {
      if (keyword.text.includes(query) && !query.includes(keyword.text)) {
        suggestions.push({ type: 'keyword', ...keyword });
      }
    });
    
    // Add label suggestions
    const allLabels = board.lists.flatMap(list => 
      list.cards?.flatMap(card => card.labels) || []
    );
    const uniqueLabels = Array.from(new Set(allLabels.map(l => l.name)))
      .filter(name => name && name.toLowerCase().includes(query));
    
    uniqueLabels.slice(0, 3).forEach(labelName => {
      suggestions.push({ 
        type: 'label', 
        text: labelName, 
        description: `Label: ${labelName}` 
      });
    });
    
    // Add member suggestions
    const allMembers = board.members || [];
    const matchingMembers = allMembers.filter(member => 
      member.fullName.toLowerCase().includes(query) || 
      member.username.toLowerCase().includes(query)
    );
    
    matchingMembers.slice(0, 3).forEach(member => {
      suggestions.push({ 
        type: 'member', 
        text: member.fullName, 
        description: `Member: ${member.fullName}` 
      });
    });
    
    return suggestions.slice(0, 8);
  };

  /**
   * Filter boards based on search query
   */
  const filterBoards = (boardsList: TrelloBoardType[], query: string): TrelloBoardType[] => {
    if (!query.trim()) {
      // Sort by last activity when no search query
      return boardsList.sort((a, b) => 
        new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime()
      );
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    const filteredBoards = boardsList.filter(board => {
      // Search in board name
      const nameMatches = searchTerms.every(term => 
        board.name.toLowerCase().includes(term)
      );
      
      // Search in board description
      const descMatches = searchTerms.every(term => 
        board.desc.toLowerCase().includes(term)
      );
      
      // Search in member names
      const memberMatches = searchTerms.some(term => 
        board.members.some(member => 
          member.fullName.toLowerCase().includes(term) || 
          member.username.toLowerCase().includes(term)
        )
      );
      
      // Search in organization name if available
      const orgMatches = board.idOrganization && searchTerms.some(term => 
        board.idOrganization?.toLowerCase().includes(term)
      );
      
      return nameMatches || descMatches || memberMatches || orgMatches;
    });
    
    // Sort filtered results by relevance (name matches first, then by last activity)
    return filteredBoards.sort((a, b) => {
      const aNameMatch = searchTerms.every(term => a.name.toLowerCase().includes(term));
      const bNameMatch = searchTerms.every(term => b.name.toLowerCase().includes(term));
      
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      
      // If both or neither match by name, sort by last activity
      return new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime();
    });
  };

  /**
   * Get filtered boards for display
   */
  const getFilteredBoards = () => {
    return filterBoards(boards, boardSearchQuery);
  };

  /**
   * Handle keyboard navigation for board dropdown
   */
  const handleBoardSearchKeyDown = (e: React.KeyboardEvent) => {
    const filteredBoards = getFilteredBoards();
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedBoardIndex(prev => 
          prev < filteredBoards.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedBoardIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedBoardIndex >= 0 && selectedBoardIndex < filteredBoards.length) {
          const selectedBoard = filteredBoards[selectedBoardIndex];
          handleBoardSelection(selectedBoard.id, selectedBoard.name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowBoardDropdown(false);
        setSelectedBoardIndex(-1);
        setBoardSearchQuery(''); // Clear search query on escape
        break;
    }
  };

  /**
   * Handle board selection
   */
  const handleBoardSelection = (boardId: string, boardName: string) => {
    setSelectedBoardId(boardId);
    setShowBoardDropdown(false);
    setBoardSearchQuery(''); // Clear search query after selection
    setSelectedBoardIndex(-1);
  };


  // Effects
  useEffect(() => {
    if (apiKey && token) {
      fetchBoards();
    }
  }, [apiKey, token, fetchBoards]);

  useEffect(() => {
    if (selectedBoardId) {
      fetchBoard(selectedBoardId);
    }
  }, [selectedBoardId, fetchBoard]);

  // Close search help when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSearchHelp && !(event.target as Element).closest('.search-help-container')) {
        setShowSearchHelp(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchHelp]);

  // Close board dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBoardDropdown && !(event.target as Element).closest('.board-search-container')) {
        setShowBoardDropdown(false);
        setSelectedBoardIndex(-1);
        setBoardSearchQuery(''); // Clear search query when clicking outside
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBoardDropdown]);

  // Only set board search query when board is selected from dropdown
  // Don't auto-populate with current board name

  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-red-800">Error</h3>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() => {
              setError(null);
              if (selectedBoardId) fetchBoard(selectedBoardId);
              else fetchBoards();
            }}
            className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading && !board) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-sm text-gray-600">Loading Trello board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-black bg-opacity-20 backdrop-blur-sm text-white border-b border-white border-opacity-10">
        <div className="flex items-center space-x-6">
          {/* Board Search with Dropdown */}
          <div className="relative board-search-container">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white text-opacity-60" />
            <input
              type="text"
              placeholder="Search boards..."
              value={boardSearchQuery}
              onChange={(e) => {
                setBoardSearchQuery(e.target.value);
                setShowBoardDropdown(true);
                setSelectedBoardIndex(-1);
              }}
              onFocus={() => setShowBoardDropdown(true)}
              onKeyDown={handleBoardSearchKeyDown}
              onBlur={() => {
                // Clear search query when losing focus if no board was selected
                setTimeout(() => {
                  if (!showBoardDropdown) {
                    setBoardSearchQuery('');
                  }
                }, 200);
              }}
              className="bg-white bg-opacity-20 backdrop-blur-sm text-white placeholder-white placeholder-opacity-60 border border-white border-opacity-30 rounded-lg pl-10 pr-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 focus:bg-opacity-30 transition-all"
            />

            {/* Board Dropdown */}
            {showBoardDropdown && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 text-gray-800 text-sm w-80 z-30 max-h-80 overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  {(() => {
                    const filteredBoards = getFilteredBoards();
                    
                    if (filteredBoards.length === 0) {
                      return (
                        <div className="px-4 py-6 text-center text-gray-500">
                          <Search className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No boards found</p>
                        </div>
                      );
                    }
                    
                    return filteredBoards.map((boardItem, index) => (
                      <button
                        key={boardItem.id}
                        onClick={() => handleBoardSelection(boardItem.id, boardItem.name)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                          index === selectedBoardIndex ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <div className="font-medium text-gray-900 truncate">{boardItem.name}</div>
                              {boardItem.id === selectedBoardId && (
                                <div className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                                  Current
                                </div>
                              )}
                            </div>
                            {boardItem.desc && (
                              <div className="text-xs text-gray-500 truncate mt-0.5">{boardItem.desc}</div>
                            )}
                            <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                              <span>{boardItem.members.length} members</span>
                              <span>{new Date(boardItem.dateLastActivity).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            {boardItem.members.slice(0, 3).map(member => (
                              <div
                                key={member.id}
                                className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-medium text-white"
                                title={member.fullName}
                              >
                                {member.initials}
                              </div>
                            ))}
                            {boardItem.members.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                +{boardItem.members.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
          
          {board && (
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200">{board.name}</h1>
              <button className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all">
                <Star className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-6">
          {/* Board Members */}
          {board && board.members && board.members.length > 0 && (
            <div className="flex items-center space-x-3">
              <div className="flex -space-x-3">
                {board.members.slice(0, 4).map(member => (
                  <div
                    key={member.id}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm font-semibold text-white border-3 border-white border-opacity-30 shadow-lg backdrop-blur-sm"
                    title={member.fullName}
                  >
                    {member.initials}
                  </div>
                ))}
                {board.members.length > 4 && (
                  <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 backdrop-blur-sm flex items-center justify-center text-sm font-medium border-3 border-white border-opacity-30 shadow-lg">
                    +{board.members.length - 4}
                  </div>
                )}
              </div>
              <button className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all">
                <UserPlus className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Enhanced Search */}
          <div className="relative search-help-container">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white text-opacity-60" />
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                className="bg-white bg-opacity-20 backdrop-blur-sm text-white placeholder-white placeholder-opacity-60 border border-white border-opacity-30 rounded-lg pl-10 pr-16 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 focus:bg-opacity-30 transition-all"
              />
              
              {/* Search Actions */}
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-all"
                    title="Clear search"
                  >
                    <X className="h-3 w-3 text-white text-opacity-60 hover:text-opacity-100" />
                  </button>
                )}
                <button
                  onClick={() => setShowSearchHelp(!showSearchHelp)}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-all"
                  title="Search help"
                >
                  <Info className="h-3 w-3 text-white text-opacity-60 hover:text-opacity-100" />
                </button>
              </div>
            </div>

            {/* Search Results Count */}
            {(() => {
              const searchStats = getSearchStats();
              return searchStats && (
                <div className="absolute top-full left-0 mt-2 bg-white bg-opacity-95 backdrop-blur-sm text-gray-800 text-xs px-3 py-1.5 rounded-lg shadow-lg border border-white border-opacity-50">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium">{searchStats.matchingCards}</span>
                    <span className="text-gray-500">of {searchStats.totalCards} cards</span>
                  </div>
                </div>
              );
            })()}

            {/* Search Suggestions */}
            {showSearchSuggestions && searchQuery && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 text-gray-800 text-sm w-96 z-20 max-h-80 overflow-hidden min-w-80 max-w-screen-sm">
                <div className="p-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase tracking-wide">Search Suggestions</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {(() => {
                    const suggestions = getSearchSuggestions();
                    return suggestions.length > 0 ? (
                      <div>
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSearchQuery(suggestion.text);
                              setShowSearchSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-all duration-200"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{suggestion.text}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{suggestion.description}</div>
                              </div>
                              <div className="ml-3">
                                {suggestion.type === 'keyword' && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                    Keyword
                                  </span>
                                )}
                                {suggestion.type === 'label' && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                                    Label
                                  </span>
                                )}
                                {suggestion.type === 'member' && (
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
                                    Member
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-500">
                        <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No suggestions found</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Search Help Dropdown */}
            {showSearchHelp && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-5 text-gray-800 text-sm w-96 z-10 min-w-80 max-w-screen-sm">
                <div className="flex items-center space-x-2 mb-4">
                  <Info className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-gray-900">Search Tips</h3>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start space-x-2">
                      <Tag className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Text Search:</strong>
                        <p className="text-gray-600 text-xs mt-0.5">Search card names and descriptions</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <User className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Members & Labels:</strong>
                        <p className="text-gray-600 text-xs mt-0.5">Search by member names or label names</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="font-semibold text-gray-900 mb-2">Special Keywords:</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="flex items-center space-x-1">
                        <code className="bg-gray-100 px-1 py-0.5 rounded">overdue</code>
                        <span className="text-gray-600">Overdue cards</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <code className="bg-gray-100 px-1 py-0.5 rounded">due</code>
                        <span className="text-gray-600">Has due dates</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <code className="bg-gray-100 px-1 py-0.5 rounded">completed</code>
                        <span className="text-gray-600">Completed cards</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <code className="bg-gray-100 px-1 py-0.5 rounded">assigned</code>
                        <span className="text-gray-600">Has members</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <code className="bg-gray-100 px-1 py-0.5 rounded">no-due</code>
                        <span className="text-gray-600">No due date</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <code className="bg-gray-100 px-1 py-0.5 rounded">has-labels</code>
                        <span className="text-gray-600">Has labels</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all" title="Filter">
              <Filter className="h-5 w-5" />
            </button>
            <button className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all" title="Settings">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Board Content */}
      {board && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full p-4 space-x-4 min-w-max">
              {/* Lists */}
              {board.lists?.map(list => {
                const filteredCards = list.cards ? filterCards(list.cards) : [];
                const listWithFilteredCards = { ...list, cards: filteredCards };
                
                return (
                  <TrelloListComponent
                    key={list.id}
                    list={listWithFilteredCards}
                    onCreateCard={async (listId, name, description) => {
                      setCreateCardForm({ listId, name, desc: description || '', due: '' });
                      await createCard();
                    }}
                    onCardClick={(card) => {
                      // Handle card click - could open modal or navigate
                      console.log('Card clicked:', card);
                    }}
                    searchQuery={searchQuery}
                  />
                );
              })}

              {/* Add List */}
              {showCreateList ? (
                <div className="flex-shrink-0 w-80 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-3">
                  <input
                    type="text"
                    placeholder="Enter list title..."
                    value={createListForm.name}
                    onChange={(e) => setCreateListForm({ name: e.target.value })}
                    className="w-full p-2 border border-white border-opacity-30 rounded mb-3 bg-white bg-opacity-20 backdrop-blur-sm text-white placeholder-white placeholder-opacity-60 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-30"
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={createList}
                      disabled={!createListForm.name.trim()}
                      className="flex-1 bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      Add List
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateList(false);
                        setCreateListForm({ name: '' });
                      }}
                      className="px-3 py-2 border border-white border-opacity-30 rounded text-sm text-white hover:bg-white hover:bg-opacity-20 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateList(true)}
                  className="flex-shrink-0 w-80 h-fit p-4 text-white hover:text-gray-200 hover:bg-white hover:bg-opacity-20 rounded-lg border-2 border-dashed border-white border-opacity-30 hover:border-opacity-50 transition-all backdrop-blur-sm"
                >
                  <Plus className="h-5 w-5 mx-auto mb-2" />
                  <span>Add another list</span>
                </button>
              )}
            </div>
            
            {/* Drag Overlay */}
            <DragOverlay>
              {activeCard ? (
                <TrelloCardComponent
                  card={activeCard}
                  onDragStart={() => {}}
                  className="transform rotate-3 scale-105 shadow-2xl"
                  searchQuery={searchQuery}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
} 