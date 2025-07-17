'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Hash, User, Send, ArrowRight } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  display_name: string;
  type: string;
  purpose?: string;
}

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface SearchResult {
  channels: Channel[];
  users: User[];
  query: string;
}

interface UnifiedSearchProps {
  token: string;
  currentTeam: { id: string } | null;
  currentUser: User | null;
  onChannelSelect: (channelId: string) => void;
  onUserSelect: (userId: string) => void;
  onSendMessage: (target: { type: 'channel' | 'user'; id: string; name: string }, message: string) => void;
  className?: string;
}

/**
 * Unified Search Component
 * 
 * Features:
 * - Search channels and users in the same input
 * - Quick navigation to channels/users
 * - Send messages directly from search results
 * - Keyboard navigation support
 */
export default function UnifiedSearch({
  token,
  currentTeam,
  currentUser,
  onChannelSelect,
  onUserSelect,
  onSendMessage,
  className = ''
}: UnifiedSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quickMessage, setQuickMessage] = useState('');
  const [showMessageInput, setShowMessageInput] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query);
      } else {
        setResults(null);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [query, token, currentTeam]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setShowMessageInput(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!token || !currentTeam) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/mattermost/search/unified?q=${encodeURIComponent(searchQuery)}&teamId=${currentTeam.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const searchResults = await response.json();
        setResults(searchResults);
        setShowResults(true);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || !results) return;

    const totalResults = results.channels.length + results.users.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalResults - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalResults - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex < results.channels.length) {
          const channel = results.channels[selectedIndex];
          handleChannelSelect(channel);
        } else {
          const userIndex = selectedIndex - results.channels.length;
          const user = results.users[userIndex];
          handleUserSelect(user);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setShowMessageInput(null);
        searchRef.current?.blur();
        break;
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    onChannelSelect(channel.id);
    setQuery('');
    setShowResults(false);
    setSelectedIndex(0);
  };

  const handleUserSelect = (user: User) => {
    onUserSelect(user.id);
    setQuery('');
    setShowResults(false);
    setSelectedIndex(0);
  };

  const handleQuickMessage = async (target: { type: 'channel' | 'user'; id: string; name: string }) => {
    if (!quickMessage.trim()) return;

    try {
      await onSendMessage(target, quickMessage);
      setQuickMessage('');
      setShowMessageInput(null);
      setQuery('');
      setShowResults(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const getResultName = (item: Channel | User, type: 'channel' | 'user') => {
    if (type === 'channel') {
      const channel = item as Channel;
      return channel.display_name || channel.name;
    } else {
      const user = item as User;
      return user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}`
        : user.username;
    }
  };

  const getAllResults = () => {
    if (!results) return [];
    
    const channelResults = results.channels.map((channel, index) => ({
      item: channel,
      type: 'channel' as const,
      index,
      globalIndex: index
    }));
    
    const userResults = results.users
      .filter(user => user.id !== currentUser?.id) // Filter out current user
      .map((user, index) => ({
        item: user,
        type: 'user' as const,
        index,
        globalIndex: results.channels.length + index
      }));

    return [...channelResults, ...userResults];
  };

  return (
    <div className={`relative ${className}`} ref={resultsRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results && setShowResults(true)}
          placeholder="Search channels and people..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {showResults && results && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {getAllResults().length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No channels or people found for "{results.query}"
            </div>
          ) : (
            <div className="py-2">
              {/* Channels Section */}
              {results.channels.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                    Channels ({results.channels.length})
                  </div>
                  {results.channels.map((channel, index) => (
                    <div
                      key={channel.id}
                      className={`px-3 py-2 cursor-pointer transition-colors ${
                        selectedIndex === index
                          ? 'bg-blue-50 text-blue-900'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleChannelSelect(channel)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{channel.display_name || channel.name}</div>
                            {channel.purpose && (
                              <div className="text-xs text-gray-500">{channel.purpose}</div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMessageInput(showMessageInput === channel.id ? null : channel.id);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Send quick message"
                          >
                            <Send className="h-3 w-3" />
                          </button>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                        </div>
                      </div>
                      
                      {/* Quick Message Input */}
                      {showMessageInput === channel.id && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border" onClick={(e) => e.stopPropagation()}>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={quickMessage}
                              onChange={(e) => setQuickMessage(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleQuickMessage({
                                    type: 'channel',
                                    id: channel.id,
                                    name: channel.display_name || channel.name
                                  });
                                }
                                e.stopPropagation();
                              }}
                              placeholder={`Message #${channel.name}...`}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                              onClick={() => handleQuickMessage({
                                type: 'channel',
                                id: channel.id,
                                name: channel.display_name || channel.name
                              })}
                              className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Users Section */}
              {results.users.filter(user => user.id !== currentUser?.id).length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                    People ({results.users.filter(user => user.id !== currentUser?.id).length})
                  </div>
                  {results.users
                    .filter(user => user.id !== currentUser?.id)
                    .map((user, index) => {
                      const globalIndex = results.channels.length + index;
                      return (
                        <div
                          key={user.id}
                          className={`px-3 py-2 cursor-pointer transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-blue-50 text-blue-900'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleUserSelect(user)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                                {getResultName(user, 'user')[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium">{getResultName(user, 'user')}</div>
                                <div className="text-xs text-gray-500">@{user.username}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMessageInput(showMessageInput === user.id ? null : user.id);
                                }}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Send quick message"
                              >
                                <Send className="h-3 w-3" />
                              </button>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                            </div>
                          </div>
                          
                          {/* Quick Message Input */}
                          {showMessageInput === user.id && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border" onClick={(e) => e.stopPropagation()}>
                              <div className="flex space-x-2">
                                <input
                                  type="text"
                                  value={quickMessage}
                                  onChange={(e) => setQuickMessage(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleQuickMessage({
                                        type: 'user',
                                        id: user.id,
                                        name: getResultName(user, 'user')
                                      });
                                    }
                                    e.stopPropagation();
                                  }}
                                  placeholder={`Message ${getResultName(user, 'user')}...`}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button
                                  onClick={() => handleQuickMessage({
                                    type: 'user',
                                    id: user.id,
                                    name: getResultName(user, 'user')
                                  })}
                                  className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                >
                                  Send
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 