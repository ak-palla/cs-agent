'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Hash, User, Plus, Search, Send, Paperclip, MoreVertical, Settings, Bell } from 'lucide-react';
import { FlockUser, FlockChannel, FlockMessage, FlockTeam } from '@/lib/types/flock-types';

export default function FlockChat() {
  // State management
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<FlockUser | null>(null);
  const [currentTeam, setCurrentTeam] = useState<FlockTeam | null>(null);
  const [teams, setTeams] = useState<FlockTeam[]>([]);
  const [channels, setChannels] = useState<FlockChannel[]>([]);
  const [directMessages, setDirectMessages] = useState<FlockChannel[]>([]);
  const [users, setUsers] = useState<FlockUser[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<FlockChannel | null>(null);
  const [messages, setMessages] = useState<FlockMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('flock_access_token');
    const storedUser = localStorage.getItem('flock_user');
    
    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Auth headers
  const getAuthHeaders = () => {
    if (!accessToken) return {};
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const response = await fetch('/api/flock/teams', { headers: getAuthHeaders() });
      const data = await response.json();
      
      if (data.success) {
        setTeams(data.data);
        if (data.data.length > 0 && !currentTeam) {
          setCurrentTeam(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  }, [accessToken, currentTeam]);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const url = currentTeam 
        ? `/api/flock/channels?teamId=${currentTeam.id}`
        : '/api/flock/channels';
      
      const response = await fetch(url, { headers: getAuthHeaders() });
      const data = await response.json();
      
      if (data.success) {
        const allChannels = data.data;
        const regularChannels = allChannels.filter((ch: FlockChannel) => ch.type === 'CHANNEL');
        const dmChannels = allChannels.filter((ch: FlockChannel) => ch.type === 'DIRECT' || ch.type === 'GROUP');
        
        setChannels(regularChannels);
        setDirectMessages(dmChannels);
        
        if (regularChannels.length > 0 && !selectedChannel) {
          setSelectedChannel(regularChannels[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  }, [accessToken, currentTeam]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const url = currentTeam 
        ? `/api/flock/users?teamId=${currentTeam.id}`
        : '/api/flock/users';
      
      const response = await fetch(url, { headers: getAuthHeaders() });
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data.filter((u: FlockUser) => u.id !== user?.id));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [accessToken, currentTeam, user?.id]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!selectedChannel) return;

    try {
      const response = await fetch(`/api/flock/messages?channelId=${selectedChannel.id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [accessToken, selectedChannel]);

  // Send message
  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChannel || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/flock/messages', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          to: selectedChannel.id,
          text: messageText.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessageText('');
        fetchMessages(); // Refresh messages
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Create direct message
  const createDirectMessage = async (targetUser: FlockUser) => {
    try {
      // For now, we'll simulate creating a DM channel
      const dmChannel: FlockChannel = {
        id: `dm_${user?.id}_${targetUser.id}`,
        name: `${targetUser.firstName} ${targetUser.lastName}`,
        type: 'DIRECT',
        description: `Direct message with ${targetUser.firstName} ${targetUser.lastName}`
      };
      
      setDirectMessages(prev => {
        const exists = prev.find(dm => dm.id === dmChannel.id);
        return exists ? prev : [...prev, dmChannel];
      });
      
      setSelectedChannel(dmChannel);
      setShowUserPicker(false);
    } catch (error) {
      console.error('Error creating direct message:', error);
    }
  };

  // Initial data loading
  useEffect(() => {
    if (!accessToken || !user) return;

    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchTeams(),
          fetchChannels(),
          fetchUsers()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [accessToken, user, fetchTeams, fetchChannels, fetchUsers]);

  // Load messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      fetchMessages();
    }
  }, [selectedChannel, fetchMessages]);

  // Show loading if not authenticated yet
  if (!accessToken || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 mx-auto h-8 w-8 rounded-full border-b-2 border-purple-600"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Loading Flock workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r bg-gray-800 text-white">
        {/* Team Header */}
        <div className="border-b border-gray-700 p-4">
          <h2 className="text-lg font-semibold">
            {currentTeam?.displayName || 'Flock Workspace'}
          </h2>
          <p className="text-sm text-gray-300">{user?.firstName} {user?.lastName}</p>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          {/* Channels Section */}
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Channels</h3>
            </div>
            
            <div className="space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                    selectedChannel?.id === channel.id ? 'bg-purple-600' : ''
                  }`}
                >
                  <Hash className="h-4 w-4" />
                  <span className="truncate">{channel.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Direct Messages</h3>
              <button
                onClick={() => setShowUserPicker(true)}
                className="rounded p-1 hover:bg-gray-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-1">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setSelectedChannel(dm)}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                    selectedChannel?.id === dm.id ? 'bg-purple-600' : ''
                  }`}
                >
                  <User className="h-4 w-4" />
                  <span className="truncate">{dm.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Users to Start Chat */}
          <div className="p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-300">Start New Chat</h3>
            <div className="space-y-1">
              {users.slice(0, 5).map((chatUser) => (
                <button
                  key={chatUser.id}
                  onClick={() => createDirectMessage(chatUser)}
                  className="flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-700"
                >
                  <div className="h-6 w-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-xs font-semibold">
                    {chatUser.firstName[0]}{chatUser.lastName[0]}
                  </div>
                  <span className="truncate">{chatUser.firstName} {chatUser.lastName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Chat Header */}
        {selectedChannel && (
          <div className="border-b bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {selectedChannel.type === 'DIRECT' ? (
                  <User className="h-5 w-5 text-gray-500" />
                ) : (
                  <Hash className="h-5 w-5 text-gray-500" />
                )}
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedChannel.name}</h2>
                  {selectedChannel.description && (
                    <p className="text-sm text-gray-500">{selectedChannel.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="rounded p-2 hover:bg-gray-100">
                  <Bell className="h-5 w-5 text-gray-500" />
                </button>
                <button className="rounded p-2 hover:bg-gray-100">
                  <Settings className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {selectedChannel ? (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex space-x-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-xs font-semibold text-white">
                    {message.user ? 
                      `${message.user.firstName[0]}${message.user.lastName[0]}` : 
                      'U'
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline space-x-2">
                      <span className="font-medium text-gray-900">
                        {message.user ? 
                          `${message.user.firstName} ${message.user.lastName}` : 
                          'Unknown User'
                        }
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-1 text-gray-700">
                      {message.html ? (
                        <div dangerouslySetInnerHTML={{ __html: message.html }} />
                      ) : (
                        <p>{message.text}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Hash className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">Select a channel</h3>
                <p className="text-gray-500">Choose a channel or start a direct message to begin chatting</p>
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        {selectedChannel && (
          <div className="border-t bg-white p-4">
            {error && (
              <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-800">
                {error}
              </div>
            )}
            
            <div className="flex items-end space-x-3">
              <button className="rounded p-2 hover:bg-gray-100">
                <Paperclip className="h-5 w-5 text-gray-500" />
              </button>
              
              <div className="flex-1">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${selectedChannel.name}`}
                  className="w-full resize-none rounded-lg border border-gray-300 p-3 text-black placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
              </div>
              
              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || isSending}
                className="rounded-lg bg-purple-600 p-3 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isSending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Picker Modal */}
      {showUserPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-96 rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Start New Chat</h3>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-gray-300 p-2 text-black"
              />
            </div>
            
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {users
                .filter(u => 
                  searchQuery === '' || 
                  `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((chatUser) => (
                  <button
                    key={chatUser.id}
                    onClick={() => createDirectMessage(chatUser)}
                    className="flex w-full items-center space-x-3 rounded p-2 hover:bg-gray-100"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-xs font-semibold text-white">
                      {chatUser.firstName[0]}{chatUser.lastName[0]}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{chatUser.firstName} {chatUser.lastName}</p>
                      <p className="text-sm text-gray-500">{chatUser.email}</p>
                    </div>
                  </button>
                ))}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowUserPicker(false)}
                className="rounded bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 