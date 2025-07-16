'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, User, Hash, AlertCircle, Search, Bell, Settings, HelpCircle, Plus, ChevronDown, Phone, Video, UserPlus, Smile, Paperclip, AtSign, Bold, Italic, Underline, Link, Code, List, MoreHorizontal, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import MattermostWebSocketManager from '@/lib/websocket-manager';
import RichTextEditor from './RichTextEditor';
import MessageRenderer from './MessageRenderer';
import FileUpload from './FileUpload';
import MessageActions from './MessageActions';
import MessageReactions from './MessageReactions';

interface Message {
  id: string;
  message: string;
  user_id: string;
  username: string;
  create_at: number;
  channel_id: string;
  reactions?: {
    emoji: string;
    count: number;
    users: string[];
    userReacted: boolean;
  }[];
}

interface Channel {
  id: string;
  name: string;
  display_name: string;
  type: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string;
  position: string;
  last_picture_update: number;
}

interface Team {
  id: string;
  create_at: number;
  update_at: number;
  delete_at: number;
  display_name: string;
  name: string;
  description: string;
  email: string;
  type: string;
  company_name: string;
  allowed_domains: string;
  invite_id: string;
  allow_open_invite: boolean;
}

interface SearchResult {
  order: string[];
  posts: { [key: string]: Message };
  matches: { [key: string]: string[] };
}

export default function MattermostChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [usersMap, setUsersMap] = useState<{ [key: string]: User }>({});
  const [typingUsers, setTypingUsers] = useState<{ [channelId: string]: Set<string> }>({});
  const [pollingMode, setPollingMode] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<{ [channelId: string]: number }>({});
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  const {
    connectionStatus,
    isReconnecting,
    reconnectAttempts,
    maxReconnectAttempts,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    sendTyping,
    subscribeToChannel,
    unsubscribeFromChannel,
    addEventListener,
  } = useWebSocket();

  const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
  const wsUrl = process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || baseUrl;
  const apiUrl = `${baseUrl}/api/v4`;
  const websocketEnabled = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true';
  const pollingInterval = parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL || '3000');
  const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_WEBSOCKET === 'true';

  useEffect(() => {
    // Clear any existing tokens and start fresh
    localStorage.removeItem('mattermost_token');
    setLoading(false);
    setError('Please enter your Personal Access Token');
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    if (!token) return;

    const unsubscribers: (() => void)[] = [];

    // Handle new messages
    const unsubscribeNewMessage = addEventListener('posted', (data) => {
      const newMessage: Message = {
        id: data.post.id,
        message: data.post.message,
        user_id: data.post.user_id,
        username: usersMap[data.post.user_id]?.username || 'Unknown',
        create_at: data.post.create_at,
        channel_id: data.post.channel_id,
      };

      if (data.post.channel_id === currentChannel) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(msg => msg.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage].sort((a, b) => a.create_at - b.create_at);
        });
      } else {
        // Update unread count for other channels
        setUnreadCounts(prev => ({
          ...prev,
          [data.post.channel_id]: (prev[data.post.channel_id] || 0) + 1,
        }));
      }
    });

    // Handle message updates/edits
    const unsubscribeMessageUpdate = addEventListener('post_edited', (data) => {
      if (data.post.channel_id === currentChannel) {
        setMessages(prev => prev.map(msg => 
          msg.id === data.post.id 
            ? { ...msg, message: data.post.message }
            : msg
        ));
      }
    });

    // Handle message deletions
    const unsubscribeMessageDelete = addEventListener('post_deleted', (data) => {
      if (data.post.channel_id === currentChannel) {
        setMessages(prev => prev.filter(msg => msg.id !== data.post.id));
      }
    });

    // Handle typing indicators
    const unsubscribeTyping = addEventListener('typing', (data) => {
      if (data.channel_id !== currentChannel || data.user_id === currentUser?.id) return;

      setTypingUsers(prev => {
        const newTyping = new Map(Object.entries(prev).map(([k, v]) => [k, new Set(v)]));
        if (!newTyping.has(data.channel_id)) {
          newTyping.set(data.channel_id, new Set());
        }
        newTyping.get(data.channel_id)!.add(data.user_id);
        
        // Clear typing after 3 seconds
        setTimeout(() => {
          setTypingUsers(curr => {
            const updated = new Map(Object.entries(curr).map(([k, v]) => [k, new Set(v)]));
            updated.get(data.channel_id)?.delete(data.user_id);
            return Object.fromEntries(Array.from(updated.entries()).map(([k, v]) => [k, v]));
          });
        }, 3000);

        return Object.fromEntries(Array.from(newTyping.entries()).map(([k, v]) => [k, v]));
      });
    });

    // Handle user status changes
    const unsubscribeStatusChange = addEventListener('status_change', (data) => {
      setUsers(prev => prev.map(user => 
        user.id === data.user_id 
          ? { ...user, status: data.status }
          : user
      ));
    });

    // Handle channel updates
    const unsubscribeChannelUpdate = addEventListener('channel_updated', (data) => {
      setChannels(prev => prev.map(channel => 
        channel.id === data.channel.id 
          ? { ...channel, ...data.channel }
          : channel
      ));
    });

    unsubscribers.push(
      unsubscribeNewMessage,
      unsubscribeMessageUpdate,
      unsubscribeMessageDelete,
      unsubscribeTyping,
      unsubscribeStatusChange,
      unsubscribeChannelUpdate
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [token, currentChannel, currentUser?.id, usersMap, addEventListener]);

  // Polling mode for when WebSocket is not available
  useEffect(() => {
    if (!pollingMode || !token || !currentChannel) return;

    const pollMessages = async () => {
      try {
        const response = await fetch(`/api/mattermost/channels/${currentChannel}/posts`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const latestMessages: Message[] = Object.values(data.posts).map((post: any) => ({
            id: post.id,
            message: post.message,
            user_id: post.user_id,
            username: usersMap[post.user_id]?.username || 'Unknown',
            create_at: post.create_at,
            channel_id: post.channel_id,
          })).sort((a, b) => a.create_at - b.create_at);
          
          setMessages(latestMessages);
        }
      } catch (error) {
        console.warn('Polling failed:', error);
      }
    };

    // Poll at configured interval
    const pollInterval = setInterval(pollMessages, pollingInterval);
    
    return () => clearInterval(pollInterval);
  }, [pollingMode, token, currentChannel, usersMap]);

  // Subscribe to current channel events
  useEffect(() => {
    if (currentChannel && connectionStatus === 'connected') {
      subscribeToChannel(currentChannel);
      // Clear unread count for current channel
      setUnreadCounts(prev => ({ ...prev, [currentChannel]: 0 }));
    }
  }, [currentChannel, connectionStatus, subscribeToChannel]);

  useEffect(() => {
    if (currentChannel && token) {
      fetchMessages(currentChannel, token);
    }
  }, [currentChannel, token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChannels = async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/channels', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }

      const channelsData = await response.json();
      setChannels(channelsData);
      if (channelsData.length > 0) {
        setCurrentChannel(channelsData[0].id);
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to connect to Mattermost. Please check your token and server URL.');
      setLoading(false);
    }
  };

  const fetchMessages = async (channelId: string, authToken: string) => {
    try {
      const response = await fetch(`/api/mattermost/messages?channelId=${channelId}&perPage=50`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      const messagesArray = Object.values(data.posts || {}) as Message[];
      const sortedMessages = messagesArray.sort((a, b) => a.create_at - b.create_at);
      setMessages(sortedMessages);
    } catch (err) {
      setError('Failed to fetch messages');
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (!currentChannel || !token) return;

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('channel_id', currentChannel);

      const response = await fetch('/api/mattermost/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const uploadedFileData = await response.json();
        setUploadedFiles(prev => [...prev, ...uploadedFileData.file_infos]);
        setShowFileUpload(false);
      } else {
        console.error('Failed to upload files');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!token) return;

    try {
      const response = await fetch('/api/mattermost/reactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: messageId,
          emoji_name: emoji.replace(/:/g, ''), // Remove colons if present
        }),
      });

      if (response.ok) {
        // Update reactions locally
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            const reactions = msg.reactions || [];
            const existingReaction = reactions.find(r => r.emoji === emoji);
            
            if (existingReaction) {
              return {
                ...msg,
                reactions: reactions.map(r => 
                  r.emoji === emoji 
                    ? { ...r, count: r.count + 1, userReacted: true }
                    : r
                )
              };
            } else {
              return {
                ...msg,
                reactions: [...reactions, { emoji, count: 1, users: [currentUser?.username || 'You'], userReacted: true }]
              };
            }
          }
          return msg;
        }));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/mattermost/reactions?post_id=${messageId}&emoji_name=${emoji.replace(/:/g, '')}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Update reactions locally
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
            const reactions = msg.reactions || [];
            return {
              ...msg,
              reactions: reactions.map(r => 
                r.emoji === emoji 
                  ? { ...r, count: Math.max(0, r.count - 1), userReacted: false }
                  : r
              ).filter(r => r.count > 0)
            };
          }
          return msg;
        }));
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && uploadedFiles.length === 0) || !currentChannel || !token) return;

    try {
      const messageData: any = {
        channelId: currentChannel,
        message: newMessage,
      };

      // Add file attachments if any
      if (uploadedFiles.length > 0) {
        messageData.file_ids = uploadedFiles.map(file => file.id);
      }

      const response = await fetch('/api/mattermost/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setNewMessage('');
      setUploadedFiles([]);
      // Refresh messages
      fetchMessages(currentChannel, token);
    } catch (err) {
      setError('Failed to send message');
    }
  };

  const fetchDirectMessages = async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/direct-messages', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch direct messages');
      }

      const dmChannels = await response.json();
      setDirectMessages(dmChannels);
    } catch (err) {
      console.error('Failed to fetch direct messages:', err);
    }
  };

  const fetchUsers = async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const usersData = await response.json();
      setUsers(usersData);
      
      // Create users map for quick lookup
      const userMap: { [key: string]: User } = {};
      usersData.forEach((user: User) => {
        userMap[user.id] = user;
      });
      setUsersMap(userMap);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch current user');
      }

      const userData = await response.json();
      setCurrentUser(userData);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchTeams = async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/teams', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }

      const teamsData = await response.json();
      setTeams(teamsData);
      if (teamsData.length > 0) {
        setCurrentTeam(teamsData[0]);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim() || !token) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/mattermost/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to search');
      }

      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredChannels = channels.filter(channel =>
    channel.display_name?.toLowerCase().includes(channelSearchQuery.toLowerCase()) ||
    channel.name?.toLowerCase().includes(channelSearchQuery.toLowerCase())
  );

  const handleTyping = () => {
    if (!currentChannel || connectionStatus !== 'connected') return;

    // Clear existing timer
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }

    // Send typing indicator
    sendTyping(currentChannel);

    // Set timer to stop sending typing indicators
    typingTimer.current = setTimeout(() => {
      // Typing indicator will automatically expire on server side
    }, 3000);
  };

  // Get typing users for current channel
  const currentChannelTypingUsers = currentChannel 
    ? Array.from(typingUsers[currentChannel] || [])
        .map(userId => usersMap[userId]?.username || 'Someone')
        .filter(Boolean)
    : [];

  // Check for CORS issues
  const checkCorsIssues = () => {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('192.168.');
    
    if (isLocalhost) {
      return {
        isCorsIssue: true,
        message: 'WebSocket may be blocked by CORS. Add "http://localhost:3000" and "ws://localhost:3000" to your Mattermost server CORS settings.'
      };
    }
    
    return { isCorsIssue: false, message: '' };
  };


  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Connecting to Mattermost...</p>
        </div>
      </div>
    );
  }


  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const userToken = formData.get('token') as string;
    
    if (userToken) {
      localStorage.setItem('mattermost_token', userToken);
      setToken(userToken);
      setError('');
      setLoading(true);
      
      try {
        // Fetch initial data
        await Promise.all([
          fetchCurrentUser(userToken),
          fetchTeams(userToken),
          fetchChannels(userToken),
          fetchDirectMessages(userToken),
          fetchUsers(userToken)
        ]);

        // Test WebSocket connectivity first (only if enabled)
        if (websocketEnabled) {
          if (debugEnabled) console.log('Testing WebSocket connectivity...');
          const webSocketAvailable = await MattermostWebSocketManager.testWebSocketConnection(wsUrl, userToken);
          
          if (webSocketAvailable) {
            try {
              await connectWebSocket(wsUrl, userToken);
              if (debugEnabled) console.log('WebSocket connected successfully');
            } catch (wsError) {
              console.warn('WebSocket connection failed, enabling polling mode:', wsError);
              setPollingMode(true);
              // Continue without WebSocket - the app will work in polling mode
            }
          } else {
            if (debugEnabled) console.log('WebSocket not available, using polling mode');
            setPollingMode(true);
          }
        } else {
          if (debugEnabled) console.log('WebSocket disabled in configuration, using polling mode');
          setPollingMode(true);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Authentication failed:', err);
        
        // Check for specific WebSocket CORS error
        const corsInfo = checkCorsIssues();
        if (corsInfo.isCorsIssue || (err instanceof Error && err.message.includes('CORS'))) {
          setError(`WebSocket connection failed. ${corsInfo.message || 'The Mattermost server needs CORS configuration for localhost development.'} You can continue using the app in polling mode.`);
        } else {
          setError('Failed to authenticate. Please check your token and ensure the Mattermost server is accessible.');
        }
        setLoading(false);
      }
    }
  };

  if (error && !token) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          <div className="rounded-lg border bg-white p-6 shadow-lg">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Mattermost Authentication</h3>
              <p className="mt-2 text-sm text-gray-600">
                Enter your Mattermost Personal Access Token
              </p>
            </div>

            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  name="token"
                  id="token"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your token..."
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Connect to Mattermost
              </button>
            </form>

            <div className="mt-4 rounded-md bg-green-50 p-3">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    How to get your Personal Access Token:
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to {baseUrl}</li>
                      <li>Click Profile → Security → Personal Access Tokens</li>
                      <li>Create a new token with "Read/Write" permissions</li>
                      <li>Copy and paste the token above</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => window.open(baseUrl, '_blank', 'noopener,noreferrer')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Open Mattermost to get token
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-100">
      {/* Top Header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-[#1e1e2e] text-white border-b border-gray-600 z-50 flex items-center">
        {/* Left: Team Selector */}
        <div className="flex items-center px-4 border-r border-gray-600 h-full">
          <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 px-3 py-2 rounded">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-sm font-bold">
              {currentTeam?.display_name?.charAt(0) || 'T'}
            </div>
            <span className="font-medium">{currentTeam?.display_name || 'Loading...'}</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded focus:bg-gray-600 focus:outline-none placeholder-gray-400"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 px-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {connectionStatus === 'connected' && !pollingMode && (
              <div className="flex items-center space-x-1 text-green-400">
                <Wifi className="h-4 w-4" />
                <span className="text-xs">Connected</span>
              </div>
            )}
            {pollingMode && (
              <div className="flex items-center space-x-1 text-blue-400">
                <div className="animate-pulse h-4 w-4 bg-blue-400 rounded-full"></div>
                <span className="text-xs">Polling Mode</span>
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div className="flex items-center space-x-1 text-yellow-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                <span className="text-xs">Connecting</span>
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div className="flex items-center space-x-1 text-red-400">
                <WifiOff className="h-4 w-4" />
                <span className="text-xs">
                  {isReconnecting ? `Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})` : 'Disconnected'}
                </span>
              </div>
            )}
          </div>
          
          <button className="p-2 hover:bg-gray-700 rounded">
            <HelpCircle className="h-5 w-5" />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded relative">
            <Bell className="h-5 w-5" />
            {Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
            )}
          </button>
          <button className="p-2 hover:bg-gray-700 rounded">
            <Settings className="h-5 w-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold cursor-pointer">
            {currentUser?.first_name?.charAt(0) || currentUser?.username?.charAt(0) || 'U'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex w-full pt-16">
        {/* Left Sidebar */}
        <div className="w-64 bg-[#2d3748] text-white flex flex-col">
          {/* Team Info */}
          <div className="p-4 border-b border-gray-600 flex-shrink-0">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs font-bold">
                {currentTeam?.display_name?.charAt(0) || 'T'}
              </div>
              <span className="font-semibold text-sm">{currentTeam?.display_name || 'Loading...'}</span>
              <ChevronDown className="h-4 w-4 ml-auto" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Find channel"
                value={channelSearchQuery}
                onChange={(e) => setChannelSearchQuery(e.target.value)}
                className="w-full bg-gray-600 text-white pl-10 pr-4 py-1.5 rounded text-sm focus:bg-gray-500 focus:outline-none placeholder-gray-400"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <button className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-600 text-sm">
                <Hash className="h-4 w-4" />
                <span>Threads</span>
              </button>
            </div>

            {/* Channels Section */}
            <div className="px-2 py-1">
              <div className="flex items-center justify-between px-3 py-1 text-xs font-medium text-gray-300 uppercase tracking-wider">
                <span>Channels</span>
                <Plus className="h-4 w-4 cursor-pointer hover:text-white" />
              </div>
              <div className="space-y-0.5">
                {filteredChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setCurrentChannel(channel.id)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gray-600 flex items-center justify-between text-sm transition-colors ${
                      currentChannel === channel.id ? 'bg-blue-600 hover:bg-blue-700' : ''
                    }`}
                  >
                    <div className="flex items-center min-w-0">
                      <Hash className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{channel.display_name || channel.name}</span>
                    </div>
                    {unreadCounts[channel.id] > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-2 flex-shrink-0">
                        {unreadCounts[channel.id] > 99 ? '99+' : unreadCounts[channel.id]}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Messages Section */}
            <div className="px-2 py-1 mt-4">
              <div className="flex items-center justify-between px-3 py-1 text-xs font-medium text-gray-300 uppercase tracking-wider">
                <span>Direct Messages</span>
                <Plus className="h-4 w-4 cursor-pointer hover:text-white" />
              </div>
              <div className="space-y-0.5">
                {directMessages.map((dm) => (
                  <button
                    key={dm.id}
                    onClick={() => setCurrentChannel(dm.id)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gray-600 flex items-center text-sm transition-colors ${
                      currentChannel === dm.id ? 'bg-blue-600 hover:bg-blue-700' : ''
                    }`}
                  >
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    <span className="truncate">{dm.display_name || dm.name}</span>
                  </button>
                ))}
                {users.slice(0, 5).map((user) => (
                  <button
                    key={user.id}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-600 flex items-center text-sm"
                  >
                    <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                    <span className="truncate">{user.username}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Channel Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Hash className="h-5 w-5 text-gray-500 mr-2" />
                <h1 className="text-lg font-semibold text-gray-900">
                  {channels.find(c => c.id === currentChannel)?.display_name || 'Select a channel'}
                </h1>
                <span className="ml-3 text-sm text-gray-500">Last online 15 hr. ago</span>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-100 rounded">
                  <Phone className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded">
                  <Video className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded">
                  <UserPlus className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded">
                  <MoreHorizontal className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto bg-white">
            {messages.length === 0 && currentChannel && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                <Hash className="h-16 w-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">Beginning of {channels.find(c => c.id === currentChannel)?.display_name}</p>
                <p className="text-sm">This is the very beginning of the {channels.find(c => c.id === currentChannel)?.display_name} channel.</p>
              </div>
            )}
            <div className="px-6 py-4 space-y-2">
              {messages.map((message, index) => {
                const showAvatar = index === 0 || messages[index - 1]?.username !== message.username;
                const isConsecutive = index > 0 && messages[index - 1]?.username === message.username;
                
                const messageUser = usersMap[message.user_id] || { username: message.username, first_name: '', last_name: '' };
                const displayName = messageUser.first_name && messageUser.last_name 
                  ? `${messageUser.first_name} ${messageUser.last_name}`
                  : messageUser.username || 'Unknown User';
                
                return (
                  <div key={message.id} className={`flex group hover:bg-gray-50 -mx-6 px-6 py-1 relative ${isConsecutive ? 'py-0.5' : 'py-2'}`}>
                    <div className="w-10 mr-3 flex-shrink-0">
                      {showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {displayName[0].toUpperCase()}
                        </div>
                      )}
                      {!showAvatar && (
                        <div className="w-8 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-xs text-gray-400">
                            {new Date(message.create_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {showAvatar && (
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">{displayName}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.create_at).toLocaleString([], { 
                              month: 'numeric', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                      )}
                      <MessageRenderer
                        content={message.message}
                        className="text-gray-800 text-sm leading-relaxed"
                      />
                      
                      {/* Message Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <MessageReactions
                          reactions={message.reactions}
                          onReact={(emoji) => handleReaction(message.id, emoji)}
                          onRemoveReaction={(emoji) => handleRemoveReaction(message.id, emoji)}
                          onAddReaction={() => {}} // Handle via message actions
                        />
                      )}
                    </div>
                    
                    {/* Message Actions - Show on hover */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MessageActions
                        messageId={message.id}
                        canEdit={message.user_id === currentUser?.id}
                        canDelete={message.user_id === currentUser?.id}
                        onReact={(messageId, emoji) => handleReaction(messageId, emoji)}
                        onReply={(messageId) => {
                          // TODO: Implement threading
                          console.log('Reply to message:', messageId);
                        }}
                        onEdit={(messageId) => {
                          // TODO: Implement message editing
                          console.log('Edit message:', messageId);
                        }}
                        onDelete={(messageId) => {
                          // TODO: Implement message deletion
                          console.log('Delete message:', messageId);
                        }}
                        onCopy={(messageId) => {
                          const msg = messages.find(m => m.id === messageId);
                          if (msg) {
                            navigator.clipboard.writeText(msg.message);
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              
              {/* Typing Indicators */}
              {currentChannelTypingUsers.length > 0 && (
                <div className="flex items-center space-x-3 px-6 py-2 text-sm text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>
                    {currentChannelTypingUsers.length === 1 
                      ? `${currentChannelTypingUsers[0]} is typing...`
                      : currentChannelTypingUsers.length === 2
                      ? `${currentChannelTypingUsers[0]} and ${currentChannelTypingUsers[1]} are typing...`
                      : `${currentChannelTypingUsers[0]} and ${currentChannelTypingUsers.length - 1} others are typing...`
                    }
                  </span>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
            {currentChannel ? (
              <div className="space-y-3">
                <RichTextEditor
                  value={newMessage}
                  onChange={setNewMessage}
                  onSubmit={sendMessage}
                  onTyping={handleTyping}
                  placeholder={`Write to ${channels.find(c => c.id === currentChannel)?.display_name || 'channel'}...`}
                  disabled={loading}
                  users={users}
                />
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setShowFileUpload(!showFileUpload)}
                      className={`p-2 hover:bg-gray-100 rounded transition-colors ${showFileUpload ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                      <Smile className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={(!newMessage.trim() && uploadedFiles.length === 0) || loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </button>
                </div>
                
                {/* File Upload Interface */}
                {showFileUpload && (
                  <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <FileUpload
                      onFileUpload={handleFileUpload}
                      disabled={loading}
                      maxFiles={5}
                      maxFileSize={50 * 1024 * 1024} // 50MB
                    />
                  </div>
                )}
                
                {/* Uploaded Files Preview */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700 mb-2">
                      {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} ready to send:
                    </p>
                    <div className="space-y-1">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center text-sm text-blue-600">
                          <Paperclip className="h-3 w-3 mr-1" />
                          {file.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>Select a channel to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}