'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  MoveRight, 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Calendar,
  RefreshCw,
  Filter,
  Clock,
  AlertCircle
} from 'lucide-react';
import { TrelloAction, TrelloBoard, TrelloCard } from '@/lib/trello-client';

interface TrelloActivityFeedProps {
  apiKey: string;
  token: string;
  boardId?: string;
  cardId?: string;
  className?: string;
  maxHeight?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface ActivityFilter {
  types: string[];
  dateRange: 'all' | 'today' | 'week' | 'month';
  member?: string;
}

export default function TrelloActivityFeed({
  apiKey,
  token,
  boardId,
  cardId,
  className = '',
  maxHeight = '400px',
  autoRefresh = false,
  refreshInterval = 30000 // 30 seconds
}: TrelloActivityFeedProps) {
  const [actions, setActions] = useState<TrelloAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>({
    types: [],
    dateRange: 'all',
    member: undefined
  });

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchActions();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, boardId, cardId]);

  /**
   * Fetch actions from the API
   */
  const fetchActions = useCallback(async () => {
    if (!boardId && !cardId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('apiKey', apiKey);
      params.append('token', token);
      
      if (boardId) params.append('boardId', boardId);
      if (cardId) params.append('cardId', cardId);
      
      // Apply filters
      if (filter.types.length > 0) {
        params.append('filter', filter.types.join(','));
      }
      
      if (filter.dateRange !== 'all') {
        const now = new Date();
        let since: Date;
        
        switch (filter.dateRange) {
          case 'today':
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            since = new Date(0);
        }
        
        params.append('since', since.toISOString());
      }

      params.append('limit', '50');

      const response = await fetch(`/api/trello/actions?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch actions');
      }

      setActions(data.data || []);
      setLastRefresh(new Date());

    } catch (err) {
      console.error('Error fetching Trello actions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
    } finally {
      setLoading(false);
    }
  }, [apiKey, token, boardId, cardId, filter]);

  // Fetch actions on mount and when dependencies change
  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  /**
   * Get icon for action type
   */
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'commentCard':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'updateCard':
        return <Edit className="h-4 w-4 text-yellow-500" />;
      case 'createCard':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'deleteCard':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'moveCardToBoard':
      case 'moveCardFromBoard':
        return <MoveRight className="h-4 w-4 text-purple-500" />;
      case 'addMemberToCard':
      case 'removeMemberFromCard':
        return <User className="h-4 w-4 text-indigo-500" />;
      case 'updateCheckItemStateOnCard':
        return <Calendar className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  /**
   * Format action description
   */
  const formatActionDescription = (action: TrelloAction): string => {
    const memberName = action.memberCreator.fullName || action.memberCreator.username;
    
    switch (action.type) {
      case 'commentCard':
        return `${memberName} commented on ${action.data.card?.name || 'a card'}`;
      
      case 'updateCard':
        if (action.data.old && action.data.card) {
          const changes = [];
          if (action.data.old.name) changes.push('name');
          if (action.data.old.desc) changes.push('description');
          if (action.data.old.idList) changes.push('list');
          if (action.data.old.due) changes.push('due date');
          if (action.data.old.closed !== undefined) changes.push('status');
          
          const changeText = changes.length > 0 ? changes.join(', ') : 'card';
          return `${memberName} updated ${changeText} on ${action.data.card.name}`;
        }
        return `${memberName} updated ${action.data.card?.name || 'a card'}`;
      
      case 'createCard':
        return `${memberName} created ${action.data.card?.name || 'a new card'}`;
      
      case 'deleteCard':
        return `${memberName} deleted ${action.data.card?.name || 'a card'}`;
      
      case 'moveCardToBoard':
        return `${memberName} moved ${action.data.card?.name || 'a card'} to this board`;
      
      case 'moveCardFromBoard':
        return `${memberName} moved ${action.data.card?.name || 'a card'} from this board`;
      
      case 'addMemberToCard':
        return `${memberName} added a member to ${action.data.card?.name || 'a card'}`;
      
      case 'removeMemberFromCard':
        return `${memberName} removed a member from ${action.data.card?.name || 'a card'}`;
      
      case 'updateCheckItemStateOnCard':
        return `${memberName} ${action.data.checkItem?.state === 'complete' ? 'completed' : 'unchecked'} an item on ${action.data.card?.name || 'a card'}`;
      
      case 'addChecklistToCard':
        return `${memberName} added a checklist to ${action.data.card?.name || 'a card'}`;
      
      case 'createList':
        return `${memberName} created list "${action.data.list?.name || 'Untitled'}"`;
      
      case 'updateList':
        return `${memberName} updated list "${action.data.list?.name || 'Untitled'}"`;
      
      default:
        return `${memberName} performed ${action.type.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
    }
  };

  /**
   * Get relative time string
   */
  const getRelativeTime = (date: string): string => {
    const now = new Date();
    const actionDate = new Date(date);
    const diffMs = now.getTime() - actionDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return actionDate.toLocaleDateString();
  };

  /**
   * Available action types for filtering
   */
  const actionTypes = [
    { value: 'commentCard', label: 'Comments' },
    { value: 'updateCard', label: 'Card Updates' },
    { value: 'createCard', label: 'Card Creation' },
    { value: 'deleteCard', label: 'Card Deletion' },
    { value: 'moveCardToBoard,moveCardFromBoard', label: 'Card Moves' },
    { value: 'addMemberToCard,removeMemberFromCard', label: 'Member Changes' },
    { value: 'updateCheckItemStateOnCard', label: 'Checklist Updates' },
    { value: 'createList,updateList', label: 'List Changes' }
  ];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Activity</h3>
          
          <div className="flex items-center space-x-2">
            {lastRefresh && (
              <span className="text-xs text-gray-500">
                Updated {getRelativeTime(lastRefresh.toISOString())}
              </span>
            )}
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1 rounded hover:bg-gray-100 ${showFilters ? 'bg-gray-100' : ''}`}
            >
              <Filter className="h-4 w-4 text-gray-500" />
            </button>
            
            <button
              onClick={fetchActions}
              disabled={loading}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Types
              </label>
              <div className="space-y-1">
                {actionTypes.map(type => (
                  <label key={type.value} className="inline-flex items-center mr-4">
                    <input
                      type="checkbox"
                      checked={filter.types.includes(type.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilter(prev => ({
                            ...prev,
                            types: [...prev.types, type.value]
                          }));
                        } else {
                          setFilter(prev => ({
                            ...prev,
                            types: prev.types.filter(t => t !== type.value)
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Range
              </label>
              <select
                value={filter.dateRange}
                onChange={(e) => setFilter(prev => ({ 
                  ...prev, 
                  dateRange: e.target.value as ActivityFilter['dateRange'] 
                }))}
                className="rounded border-gray-300 text-sm"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`overflow-y-auto`} style={{ maxHeight }}>
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading && actions.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading activity...</p>
            </div>
          </div>
        )}

        {!loading && !error && actions.length === 0 && (
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No activity yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Activity will appear here as actions are performed.
            </p>
          </div>
        )}

        {/* Activity List */}
        <div className="divide-y divide-gray-200">
          {actions.map((action) => (
            <div key={action.id} className="p-4 hover:bg-gray-50">
              <div className="flex space-x-3">
                <div className="flex-shrink-0">
                  {getActionIcon(action.type)}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">
                    {formatActionDescription(action)}
                  </div>
                  
                  {/* Comment text for comment actions */}
                  {action.type === 'commentCard' && action.data.text && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700">
                      "{action.data.text}"
                    </div>
                  )}
                  
                  <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                    <span>{getRelativeTime(action.date)}</span>
                    
                    {action.memberCreator.avatarHash && (
                      <img
                        src={`https://trello-avatars.s3.amazonaws.com/${action.memberCreator.avatarHash}/30.png`}
                        alt={action.memberCreator.fullName}
                        className="h-5 w-5 rounded-full"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 