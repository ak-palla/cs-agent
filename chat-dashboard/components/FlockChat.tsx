'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Hash, User, Plus, Search, Send, Paperclip, MoreVertical, Settings, Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';
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
  
  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [pollingInterval, setPollingInterval] = useState(5000); // 5 seconds default
  const [lastMessageCheck, setLastMessageCheck] = useState<Date>(new Date());
  
  // Notification state
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [unseenChannels, setUnseenChannels] = useState<Set<string>>(new Set());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimestampRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Mock data fallback
  const [useMockData, setUseMockData] = useState(false);

  // Auth headers helper
  const getAuthHeaders = useCallback(() => {
    if (!accessToken) return {};
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }, [accessToken]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Track user activity
  const trackActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    if (!accessToken) return [];
    
    try {
      const response = await fetch('/api/flock/teams', { 
        headers: getAuthHeaders() 
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const teamsList = data.data || [];
        setTeams(teamsList);
        
        // Set first team as current if none selected
        if (teamsList.length > 0 && !currentTeam) {
          setCurrentTeam(teamsList[0]);
        }
        return teamsList;
      } else {
        console.warn('Failed to fetch teams:', data.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  }, [accessToken, currentTeam, getAuthHeaders]);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    if (!accessToken || !currentTeam) return [];
    
    try {
      const response = await fetch(`/api/flock/channels?teamId=${currentTeam.id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const channelsList = data.data || [];
        setChannels(channelsList);
        
        // Set first channel as selected if none selected
        if (channelsList.length > 0 && !selectedChannel) {
          setSelectedChannel(channelsList[0]);
        }
        return channelsList;
      } else {
        console.warn('Failed to fetch channels:', data.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      return [];
    }
  }, [accessToken, currentTeam, selectedChannel, getAuthHeaders]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!accessToken || !currentTeam) return [];
    
    try {
      const response = await fetch(`/api/flock/users?teamId=${currentTeam.id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const usersList = data.data || [];
        setUsers(usersList);
        return usersList;
      } else {
        console.warn('Failed to fetch users:', data.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }, [accessToken, currentTeam, getAuthHeaders]);

  // Fetch messages for selected channel
  const fetchMessages = useCallback(async (channelId?: string, isPollingUpdate = false) => {
    const targetChannel = channelId || selectedChannel?.id;
    if (!accessToken || !targetChannel) return [];

    try {
      // For polling updates, only fetch messages after the last known timestamp
      let url = `/api/flock/messages?channelId=${targetChannel}&limit=50`;
      if (isPollingUpdate && lastMessageTimestampRef.current) {
        url += `&after=${encodeURIComponent(lastMessageTimestampRef.current)}`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const newMessages = data.data || [];
        
        if (isPollingUpdate && messages.length > 0) {
          // For polling updates, only add truly new messages
          const messageIds = new Set(messages.map(msg => msg.id));
          const newMessagesOnly = newMessages.filter((msg: FlockMessage) => 
            !messageIds.has(msg.id)
          );
          
          if (newMessagesOnly.length > 0) {
            setMessages(prev => {
              // Sort by timestamp to maintain order
              const combined = [...prev, ...newMessagesOnly];
              return combined.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
            });
            
            // Update notification count if not viewing the channel
            if (targetChannel !== selectedChannel?.id) {
              setUnseenChannels(prev => new Set(prev).add(targetChannel));
            } else {
              setNewMessageCount(prev => prev + newMessagesOnly.length);
              setTimeout(scrollToBottom, 100);
            }
            
            // Update last message timestamp
            const latestMessage = newMessagesOnly[newMessagesOnly.length - 1];
            if (latestMessage) {
              lastMessageTimestampRef.current = latestMessage.createdAt;
            }
          }
        } else {
          // Initial load or manual refresh
          const sortedMessages = newMessages.sort((a: FlockMessage, b: FlockMessage) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setMessages(sortedMessages);
          setNewMessageCount(0);
          setTimeout(scrollToBottom, 100);
          
          // Set initial timestamp for polling
          if (sortedMessages.length > 0) {
            lastMessageTimestampRef.current = sortedMessages[sortedMessages.length - 1].createdAt;
          }
        }
        
        return newMessages;
      } else {
        console.warn('Failed to fetch messages:', data.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }, [accessToken, selectedChannel, messages, getAuthHeaders, scrollToBottom]);

  // Start polling for current channel messages
  const startPolling = useCallback(() => {
    if (!selectedChannel || !pollingEnabled || pollingIntervalRef.current) return;
    
    console.log('🔄 Starting polling for channel:', selectedChannel.name);
    setIsPolling(true);
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Poll current channel for new messages
        await fetchMessages(selectedChannel.id, true);
        
        // Poll other channels for notifications (less frequently)
        const timeSinceLastCheck = Date.now() - lastMessageCheck.getTime();
        if (timeSinceLastCheck > 30000) { // Check other channels every 30 seconds
          const otherChannels = channels.filter(ch => ch.id !== selectedChannel.id);
          for (const channel of otherChannels.slice(0, 5)) { // Limit to 5 channels
            await fetchMessages(channel.id, true);
          }
          setLastMessageCheck(new Date());
        }
        
        // Adjust polling interval based on activity
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        let newInterval = 5000; // Default 5 seconds
        
        if (timeSinceActivity > 300000) { // 5 minutes
          newInterval = 30000; // 30 seconds
        } else if (timeSinceActivity > 120000) { // 2 minutes
          newInterval = 15000; // 15 seconds
        } else if (timeSinceActivity > 60000) { // 1 minute
          newInterval = 10000; // 10 seconds
        }
        
        if (newInterval !== pollingInterval) {
          setPollingInterval(newInterval);
          // Restart polling with new interval
          stopPolling();
          setTimeout(startPolling, 100);
        }
        
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Polling error:', error);
        setConnectionStatus('error');
      }
    }, pollingInterval);
  }, [selectedChannel, pollingEnabled, pollingInterval, channels, fetchMessages, lastMessageCheck]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    console.log('🛑 Stopped polling');
  }, []);

  // Toggle polling
  const togglePolling = useCallback(() => {
    if (pollingEnabled) {
      stopPolling();
      setPollingEnabled(false);
      setConnectionStatus('disconnected');
    } else {
      setPollingEnabled(true);
      setConnectionStatus('connecting');
      startPolling();
    }
  }, [pollingEnabled, stopPolling, startPolling]);

  // Mock data
  const getMockData = useCallback(() => {
    const mockUser: FlockUser = {
      id: 'mock_user_1',
      firstName: 'Demo',
      lastName: 'User',
      email: 'demo@example.com',
      username: 'demo_user'
    };

    const mockTeam: FlockTeam = {
      id: 'mock_team_1',
      name: 'Demo Team',
      displayName: 'Demo Team Workspace',
      description: 'A demo team for testing Flock integration'
    };

    const mockChannels: FlockChannel[] = [
      {
        id: 'mock_channel_1',
        name: 'general',
        type: 'CHANNEL',
        description: 'General discussion channel'
      },
      {
        id: 'mock_channel_2',
        name: 'development',
        type: 'CHANNEL',
        description: 'Development team discussions'
      },
      {
        id: 'mock_channel_3',
        name: 'random',
        type: 'CHANNEL',
        description: 'Random conversations'
      }
    ];

    const mockUsers: FlockUser[] = [
      {
        id: 'mock_user_2',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        username: 'alice_j'
      },
      {
        id: 'mock_user_3',
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@example.com',
        username: 'bob_s'
      },
      {
        id: 'mock_user_4',
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol@example.com',
        username: 'carol_d'
      }
    ];

    const mockMessages: FlockMessage[] = [
      {
        id: 'mock_msg_1',
        text: 'Welcome to the Flock integration demo! This is a polling-based integration.',
        html: '<p>Welcome to the Flock integration demo! This is a <strong>polling-based</strong> integration.</p>',
        createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        user: mockUsers[0]
      },
      {
        id: 'mock_msg_2',
        text: 'The integration automatically polls for new messages every few seconds, so no webhooks are needed.',
        html: null,
        createdAt: new Date(Date.now() - 240000).toISOString(), // 4 minutes ago
        user: mockUsers[1]
      },
      {
        id: 'mock_msg_3',
        text: 'You can send messages, switch channels, and start direct conversations.',
        html: null,
        createdAt: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
        user: mockUsers[2]
      },
      {
        id: 'mock_msg_4',
        text: 'Try typing a message below to test the interface!',
        html: null,
        createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        user: mockUser
      }
    ];

    return { mockUser, mockTeam, mockChannels, mockUsers, mockMessages };
  }, []);

  // Load mock data when needed
  const loadMockData = useCallback(() => {
    const { mockUser, mockTeam, mockChannels, mockUsers, mockMessages } = getMockData();
    
    setUser(mockUser);
    setCurrentTeam(mockTeam);
    setChannels(mockChannels);
    setUsers(mockUsers);
    setSelectedChannel(mockChannels[0]);
    setMessages(mockMessages);
    setUseMockData(true);
    setConnectionStatus('connected');
    setIsLoading(false);
    setError(null);
    
    // Start mock polling
    if (pollingEnabled) {
      setTimeout(() => {
        setIsPolling(true);
        // Simulate receiving a new message every 30 seconds
        const mockPollingInterval = setInterval(() => {
          const newMessage: FlockMessage = {
            id: `mock_msg_${Date.now()}`,
            text: `Mock message received at ${new Date().toLocaleTimeString()}`,
            html: null,
            createdAt: new Date().toISOString(),
            user: mockUsers[Math.floor(Math.random() * mockUsers.length)]
          };
          
          setMessages(prev => [...prev, newMessage]);
          setNewMessageCount(prev => prev + 1);
          setTimeout(scrollToBottom, 100);
        }, 30000);
        
        // Store interval ref for cleanup
        pollingIntervalRef.current = mockPollingInterval;
      }, 1000);
    }
  }, [getMockData, pollingEnabled, scrollToBottom]);

  // Enhanced fetch functions with fallback
  const fetchTeamsWithFallback = useCallback(async () => {
    if (useMockData) {
      const { mockTeam } = getMockData();
      return [mockTeam];
    }
    
    const result = await fetchTeams();
    if (result.length === 0 && !useMockData) {
      // If no teams found, suggest mock data
      setError('No teams found. Would you like to try the demo mode?');
    }
    return result;
  }, [useMockData, getMockData, fetchTeams]);

  const fetchChannelsWithFallback = useCallback(async () => {
    if (useMockData) {
      const { mockChannels } = getMockData();
      return mockChannels;
    }
    
    const result = await fetchChannels();
    if (result.length === 0 && !useMockData) {
      setError('No channels found. The Flock API may not be responding correctly.');
    }
    return result;
  }, [useMockData, getMockData, fetchChannels]);

  const fetchUsersWithFallback = useCallback(async () => {
    if (useMockData) {
      const { mockUsers } = getMockData();
      return mockUsers;
    }
    
    return await fetchUsers();
  }, [useMockData, getMockData, fetchUsers]);

  const fetchMessagesWithFallback = useCallback(async (channelId?: string, isPollingUpdate = false) => {
    if (useMockData) {
      // Return messages for the selected channel
      const { mockMessages } = getMockData();
      return mockMessages;
    }
    
    return await fetchMessages(channelId, isPollingUpdate);
  }, [useMockData, getMockData, fetchMessages]);

  // Enhanced send message with mock support
  const sendMessageWithFallback = useCallback(async () => {
    if (!messageText.trim() || !selectedChannel || isSending) return;

    trackActivity();
    setIsSending(true);
    setError(null);

    try {
      if (useMockData) {
        // Simulate sending a message in mock mode
        const newMessage: FlockMessage = {
          id: `sent_msg_${Date.now()}`,
          text: messageText.trim(),
          html: null,
          createdAt: new Date().toISOString(),
          user: user!
        };
        
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');
        setTimeout(scrollToBottom, 100);
        
        // Simulate a reply after 3 seconds
        setTimeout(() => {
          const { mockUsers } = getMockData();
          const replyMessage: FlockMessage = {
            id: `reply_msg_${Date.now()}`,
            text: `Thanks for your message: "${messageText.trim()}"`,
            html: null,
            createdAt: new Date().toISOString(),
            user: mockUsers[Math.floor(Math.random() * mockUsers.length)]
          };
          
          setMessages(prev => [...prev, replyMessage]);
          setTimeout(scrollToBottom, 100);
        }, 3000);
        
        return;
      }

      // Real API call
      const response = await fetch('/api/flock/messages', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          to: selectedChannel.id,
          text: messageText.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessageText('');
        // Fetch messages immediately to show sent message
        await fetchMessages(selectedChannel.id);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [messageText, selectedChannel, isSending, useMockData, user, trackActivity, getAuthHeaders, fetchMessages, scrollToBottom, getMockData]);

  // Handle authentication
  const handleAuth = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    setConnectionStatus('connecting');

    try {
      const response = await fetch('/api/flock/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store credentials
      localStorage.setItem('flock_access_token', data.accessToken);
      localStorage.setItem('flock_user', JSON.stringify(data.user));
      
      setAccessToken(data.accessToken);
      setUser(data.user);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Auth error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const handleLogout = useCallback(() => {
    stopPolling();
    localStorage.removeItem('flock_access_token');
    localStorage.removeItem('flock_user');
    setAccessToken(null);
    setUser(null);
    setCurrentTeam(null);
    setTeams([]);
    setChannels([]);
    setUsers([]);
    setSelectedChannel(null);
    setMessages([]);
    setConnectionStatus('disconnected');
    setError(null);
  }, [stopPolling]);

  // Handle Enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageWithFallback();
    }
  }, [sendMessageWithFallback]);

  // Handle typing activity
  const handleTyping = useCallback(() => {
    trackActivity();
  }, [trackActivity]);

  // Create direct message
  const createDirectMessage = useCallback(async (targetUser: FlockUser) => {
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
  }, [user]);

  // Initial data loading
  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('flock_access_token');
    const storedUser = localStorage.getItem('flock_user');
    
    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser));
      setConnectionStatus('connected');
      
      // Check if this is a demo token and auto-enable mock data
      if (storedToken === 'demo_token') {
        setUseMockData(true);
        // Load mock data immediately
        setTimeout(() => {
          loadMockData();
        }, 100);
      }
    } else {
      setConnectionStatus('disconnected');
      setIsLoading(false);
    }
  }, [loadMockData]);

  // Initial data loading effect
  useEffect(() => {
    if (!accessToken || !user) return;

    const loadInitialData = async () => {
      setIsLoading(true);
      setConnectionStatus('connecting');
      
      try {
        // Load teams, channels, and users in parallel
        const [teamsList, channelsList, usersList] = await Promise.all([
          fetchTeamsWithFallback(),
          fetchChannelsWithFallback(),
          fetchUsersWithFallback()
        ]);
        
        // If we have channels, load messages for the first one
        if (channelsList.length > 0) {
          await fetchMessagesWithFallback(channelsList[0].id);
        }
        
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load data');
        setConnectionStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [accessToken, user, fetchTeamsWithFallback, fetchChannelsWithFallback, fetchUsersWithFallback, fetchMessagesWithFallback]);

  // Start/stop polling when channel changes
  useEffect(() => {
    stopPolling(); // Stop current polling
    
    if (selectedChannel && pollingEnabled) {
      // Load messages for new channel
      fetchMessagesWithFallback(selectedChannel.id);
      // Start polling for new channel
      startPolling();
      // Clear unseen status for this channel
      setUnseenChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedChannel.id);
        return newSet;
      });
    }

    return () => stopPolling(); // Cleanup on unmount
  }, [selectedChannel, pollingEnabled, fetchMessagesWithFallback, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Show loading if not authenticated yet
  if (!accessToken || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 mx-auto h-8 w-8 rounded-full border-b-2 border-purple-600"></div>
          <p className="text-gray-600">Please authenticate with Flock to continue...</p>
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
                  onClick={() => {
                    setSelectedChannel(channel);
                    trackActivity();
                  }}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-700 ${
                    selectedChannel?.id === channel.id ? 'bg-purple-600' : ''
                  }`}
                >
                  <Hash className="h-4 w-4" />
                  <span className="truncate">{channel.name}</span>
                  {unseenChannels.has(channel.id) && (
                    <div className="h-2 w-2 rounded-full bg-purple-400" />
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
                {/* Polling Status Indicator */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={togglePolling}
                    className={`flex items-center space-x-1 rounded px-2 py-1 text-xs ${
                      pollingEnabled 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={pollingEnabled ? `Auto-refresh enabled (${pollingInterval/1000}s)` : 'Auto-refresh disabled'}
                  >
                    <div className={`h-2 w-2 rounded-full ${
                      pollingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`} />
                    <span>{pollingEnabled ? 'Live' : 'Manual'}</span>
                  </button>
                  
                  {newMessageCount > 0 && (
                    <div className="rounded-full bg-purple-600 px-2 py-1 text-xs text-white">
                      {newMessageCount} new
                    </div>
                  )}
                </div>
                
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
                    handleTyping();
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder={`Message ${selectedChannel.name}`}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  rows={1}
                  disabled={isSending}
                />
              </div>
              <button
                onClick={sendMessageWithFallback}
                disabled={!messageText.trim() || isSending}
                className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isSending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Connection Status */}
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                <span>
                  {connectionStatus === 'connected' && pollingEnabled ? `Connected • Auto-refresh ${pollingInterval/1000}s` :
                   connectionStatus === 'connected' ? 'Connected • Manual refresh' :
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   connectionStatus === 'error' ? 'Connection error' : 'Disconnected'}
                </span>
              </div>
              
              {isPolling && (
                <div className="flex items-center space-x-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Checking for new messages...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Picker Modal */}
      {showUserPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-96 rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium">Start a conversation</h3>
              <button
                onClick={() => setShowUserPicker(false)}
                className="rounded p-1 hover:bg-gray-100"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {users
                .filter(chatUser => 
                  chatUser.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  chatUser.lastName.toLowerCase().includes(searchQuery.toLowerCase())
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
                      <div className="font-medium">{chatUser.firstName} {chatUser.lastName}</div>
                      <div className="text-sm text-gray-500">{chatUser.email}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 