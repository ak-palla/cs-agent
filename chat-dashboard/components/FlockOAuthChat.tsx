'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Hash, User, Plus, Search, Send, Paperclip, MoreVertical, Settings, Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { FlockUser, FlockChannel, FlockMessage, FlockTeam } from '@/lib/types/flock-types';
import { useFlockAuth } from '@/lib/flock-oauth-manager';
import FlockOAuthLogin from './FlockOAuthLogin';

export default function FlockOAuthChat() {
  // Use the new OAuth auth context
  const { 
    isAuthenticated, 
    user, 
    client, 
    isLoading: authLoading, 
    error: authError,
    login,
    logout
  } = useFlockAuth();

  // State management
  const [currentTeam, setCurrentTeam] = useState<FlockTeam | null>(null);
  const [teams, setTeams] = useState<FlockTeam[]>([]);
  const [channels, setChannels] = useState<FlockChannel[]>([]);
  const [directMessages, setDirectMessages] = useState<FlockChannel[]>([]);
  const [users, setUsers] = useState<FlockUser[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<FlockChannel | null>(null);
  const [messages, setMessages] = useState<FlockMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [pollingInterval, setPollingInterval] = useState(5000);
  const [lastMessageCheck, setLastMessageCheck] = useState<Date>(new Date());
  
  // Notification state
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [unseenChannels, setUnseenChannels] = useState<Set<string>>(new Set());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimestampRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Track user activity
  const trackActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Fetch teams using OAuth client
  const fetchTeams = useCallback(async () => {
    if (!client) return [];
    
    try {
      const teamsList = await client.getTeams();
      setTeams(teamsList);
      
      if (teamsList.length > 0 && !currentTeam) {
        setCurrentTeam(teamsList[0]);
      }
      return teamsList;
    } catch (error) {
      console.error('Error fetching teams:', error);
      setError('Failed to fetch teams');
      return [];
    }
  }, [client, currentTeam]);

  // Fetch channels using OAuth client
  const fetchChannels = useCallback(async () => {
    if (!client || !currentTeam) return [];
    
    try {
      const channelsList = await client.getChannels(currentTeam.id);
      setChannels(channelsList);
      
      if (channelsList.length > 0 && !selectedChannel) {
        setSelectedChannel(channelsList[0]);
      }
      return channelsList;
    } catch (error) {
      console.error('Error fetching channels:', error);
      return [];
    }
  }, [client, currentTeam, selectedChannel]);

  // Fetch users using OAuth client
  const fetchUsers = useCallback(async () => {
    if (!client || !currentTeam) return [];
    
    try {
      const usersList = await client.getUsers(currentTeam.id);
      setUsers(usersList);
      return usersList;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }, [client, currentTeam]);

  // Fetch messages using OAuth client
  const fetchMessages = useCallback(async (channelId?: string, isPollingUpdate = false) => {
    const targetChannel = channelId || selectedChannel?.id;
    if (!client || !targetChannel) return [];

    try {
      const newMessages = await client.getMessages(targetChannel, {
        limit: 50,
        after: isPollingUpdate && lastMessageTimestampRef.current ? lastMessageTimestampRef.current : undefined
      });

      if (isPollingUpdate && messages.length > 0) {
        const messageIds = new Set(messages.map(msg => msg.id));
        const newMessagesOnly = newMessages.filter(msg => !messageIds.has(msg.id));
        
        if (newMessagesOnly.length > 0) {
          setMessages(prev => [...prev, ...newMessagesOnly]);
          
          if (targetChannel !== selectedChannel?.id) {
            setUnseenChannels(prev => new Set(prev).add(targetChannel));
          } else {
            setNewMessageCount(prev => prev + newMessagesOnly.length);
            setTimeout(scrollToBottom, 100);
          }
          
          const latestMessage = newMessagesOnly[newMessagesOnly.length - 1];
          if (latestMessage) {
            lastMessageTimestampRef.current = latestMessage.createdAt;
          }
        }
      } else {
        setMessages(newMessages);
        setNewMessageCount(0);
        setTimeout(scrollToBottom, 100);
        
        if (newMessages.length > 0) {
          lastMessageTimestampRef.current = newMessages[newMessages.length - 1].createdAt;
        }
      }
      
      return newMessages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }, [client, selectedChannel, messages, scrollToBottom]);

  // Send message using OAuth client
  const sendMessage = useCallback(async () => {
    if (!messageText.trim() || !selectedChannel || !client || isSending) return;

    trackActivity();
    setIsSending(true);
    setError(null);

    try {
      const message = await client.sendMessage({
        to: selectedChannel.id,
        text: messageText.trim()
      });

      if (message) {
        setMessageText('');
        await fetchMessages(selectedChannel.id);
      } else {
        setError('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [messageText, selectedChannel, client, isSending, trackActivity, fetchMessages]);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    if (!isAuthenticated || !client) return;

    setIsLoading(true);
    setConnectionStatus('connecting');
    
    try {
      await Promise.all([
        fetchTeams(),
        fetchChannels(),
        fetchUsers()
      ]);
      
      if (selectedChannel) {
        await fetchMessages(selectedChannel.id);
      }
      
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Failed to load data');
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, client, fetchTeams, fetchChannels, fetchUsers, selectedChannel, fetchMessages]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!selectedChannel || !pollingEnabled || pollingIntervalRef.current || !client) return;
    
    setIsPolling(true);
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        await fetchMessages(selectedChannel.id, true);
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Polling error:', error);
        setConnectionStatus('error');
      }
    }, pollingInterval);
  }, [selectedChannel, pollingEnabled, pollingInterval, client, fetchMessages]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Effects
  useEffect(() => {
    if (isAuthenticated && client) {
      loadInitialData();
    }
  }, [isAuthenticated, client, loadInitialData]);

  useEffect(() => {
    if (selectedChannel && pollingEnabled && client) {
      fetchMessages(selectedChannel.id);
      startPolling();
      
      setUnseenChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedChannel.id);
        return newSet;
      });
    }

    return () => stopPolling();
  }, [selectedChannel, pollingEnabled, client, fetchMessages, startPolling, stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Create direct message
  const createDirectMessage = useCallback(async (targetUser: FlockUser) => {
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
  }, [user]);

  // Show OAuth login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect to Flock</h2>
          
          <p className="text-gray-600 mb-6">
            Securely connect your Flock workspace to start messaging and collaborating with your team.
          </p>
          
          <div className="space-y-4">
            <FlockOAuthLogin 
              onLoginSuccess={() => {
                console.log('Flock OAuth login successful');
              }}
              onLoginError={(error) => {
                console.error('Flock OAuth login error:', error);
              }}
              buttonText="Connect Flock Account"
              className="w-full"
            />
            
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{authError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
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
          <button
            onClick={logout}
            className="mt-2 text-xs text-gray-400 hover:text-white"
          >
            Logout
          </button>
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
                  onClick={() => {
                    setSelectedChannel(channel);
                    trackActivity();
                  }}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                    selectedChannel?.id === channel.id ? 'bg-blue-600' : ''
                  }`}
                >
                  <Hash className="h-4 w-4" />
                  <span className="truncate">{channel.name}</span>
                  {unseenChannels.has(channel.id) && (
                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                  )}
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
                  onClick={() => {
                    setSelectedChannel(dm);
                    trackActivity();
                  }}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                    selectedChannel?.id === dm.id ? 'bg-blue-600' : ''
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
                  <div className="h-6 w-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-xs font-semibold">
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
                {newMessageCount > 0 && (
                  <div className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                    {newMessageCount} new
                  </div>
                )}
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
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-xs font-semibold text-white">
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
                <h3 className="mt-4 text-lg font-medium text-gray-900">Select a channel</h3>
                <p className="mt-2 text-gray-500">Choose a channel from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        {selectedChannel && (
          <div className="border-t bg-white p-4">
            {error && (
              <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            
            <div className="flex space-x-3">
              <div className="flex-1">
                <textarea
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    trackActivity();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={`Message ${selectedChannel.name}`}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={1}
                  disabled={isSending}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || isSending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
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
    </div>
  );
}