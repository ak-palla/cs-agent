'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, Hash, AlertCircle, Search, Bell, Settings, HelpCircle, Plus, ChevronDown, Phone, Video, UserPlus, Smile, Paperclip, MoreHorizontal, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import EnhancedMattermostClient from '@/lib/enhanced-mattermost-client';
import { mattermostLogger } from '@/lib/logger';

// Helper function for activity storage with retry logic and exponential backoff
async function storeActivitySafely(activityData: any): Promise<boolean> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/admin/activities/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityData)
      });
      
      if (response.ok) {
        console.log('✅ Activity stored successfully:', activityData.event_type);
        return true;
      }
      
      // Handle different error types
      if (response.status >= 500) {
        // Server error - retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.warn(`🔄 Server error (${response.status}), retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else if (response.status >= 400) {
        // Client error - don't retry, log and return false
        console.warn('❌ Client error storing activity:', response.status, response.statusText);
        return false;
      }
      
    } catch (error) {
      // Network error - retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`🔄 Network error, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error('❌ Failed to store activity after all retries:', error);
    }
  }
  
  // All retries exhausted
  console.warn('⚠️ Activity storage failed after', maxRetries, 'attempts - continuing without storage');
  return false;
}

// WebSocket connection test function
async function testWebSocketConnection(wsUrl: string, token: string): Promise<boolean> {
  try {
    // Test WebSocket connectivity by using the proxy API route instead of direct calls
    // This avoids CORS issues since we're calling our own Next.js API
    const response = await fetch('/api/mattermost/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      mattermostLogger.debug('WebSocket connectivity test successful via proxy');
      return true;
    } else {
      mattermostLogger.debug('WebSocket connectivity test failed', { status: response.status });
      return false;
    }
  } catch (error) {
    mattermostLogger.debug('WebSocket test failed', { error });
    return false;
  }
}
import RichTextEditor from './RichTextEditor';
import MessageRenderer from './MessageRenderer';
import FileUpload from './FileUpload';
import MessageActions from './MessageActions';
import MessageReactions from './MessageReactions';
import ChannelManager from './ChannelManager';
import UnifiedSearch from './UnifiedSearch';
import NotificationDropdown from './NotificationDropdown';
import NotificationSettings from './NotificationSettings';
import { useNotifications } from '@/contexts/NotificationContext';

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
  other_user_id?: string; // For direct message channels
  purpose?: string;
  header?: string;
  team_id?: string;
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

interface MattermostFileInfo {
  id: string;
  user_id: string;
  post_id: string;
  create_at: number;
  update_at: number;
  delete_at: number;
  name: string;
  extension: string;
  size: number;
  mime_type: string;
  width: number;
  height: number;
  has_preview_image: boolean;
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

// Move environment variables outside component to prevent re-calculation
const baseUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
// For development, try different WebSocket approaches
// WebSocket URL will be determined at runtime based on hostname
// const apiUrl = `${baseUrl}/api/v4`; // Reserved for future use
// Default to WebSocket enabled (true) unless explicitly disabled
const websocketEnabled = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET !== 'false';
const pollingIntervalMs = parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL || '5000');
// Enable debug by default when WebSocket fails
const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_WEBSOCKET === 'true' || process.env.NODE_ENV === 'development';

/**
 * Mattermost Chat Component with Real-time Updates
 * 
 * Connection Modes:
 * 1. WebSocket (Default): Real-time bidirectional communication - preferred mode
 * 2. Polling (Fallback): HTTP polling when WebSocket is unavailable or fails
 * 
 * The component automatically attempts WebSocket connection first, and falls back
 * to polling mode if WebSocket is not available or explicitly disabled.
 */
export default function MattermostChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directMessages, setDirectMessages] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [usersMap, setUsersMap] = useState<{ [key: string]: User }>({});
  const [typingUsers, setTypingUsers] = useState<{ [channelId: string]: Set<string> }>({});
  const [pollingMode, setPollingMode] = useState(false); // WebSocket is default, polling is fallback
  const [unreadCounts, setUnreadCounts] = useState<{ [channelId: string]: number }>({});
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<MattermostFileInfo[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showChannelManager, setShowChannelManager] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showUnifiedSearch, setShowUnifiedSearch] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
  // Pagination and scroll state
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState<string>('');
  
  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(240); // Default 240px (w-60)
  const [isResizing, setIsResizing] = useState(false);
  
  // Mobile responsiveness state
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Notification context
  const { addNotification, unreadCount } = useNotifications();
  const initializedRef = useRef<boolean>(false);
  const previousScrollHeight = useRef<number>(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const {
    connectionStatus,
    isReconnecting,
    reconnectAttempts,
    maxReconnectAttempts,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket, // eslint-disable-line @typescript-eslint/no-unused-vars
    sendTyping,
    subscribeToChannel,
    unsubscribeFromChannel, // eslint-disable-line @typescript-eslint/no-unused-vars
    addEventListener,
  } = useWebSocket();

  // Environment variables moved outside component

  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // Check for existing token on component mount
    const existingToken = localStorage.getItem('mattermost_token');
    if (existingToken) {
      setToken(existingToken);
      setLoading(true);
      
      // Auto-connect with existing token
      const initializeConnection = async () => {
        try {
          // First validate the token
          const isValidToken = await validateToken(existingToken);
          if (!isValidToken) {
            console.warn('Token validation failed, clearing stored token');
            return;
          }

          // Fetch current user and teams first
          const [_, teamsData] = await Promise.all([
            fetchCurrentUser(existingToken),
            fetchTeams(existingToken)
          ]);
        
        // Then fetch users and channels (use first team if available)
        const teamId = teamsData.length > 0 ? teamsData[0].id : null;
        await Promise.all([
          teamId ? fetchChannels(existingToken, teamId) : Promise.resolve(),
          fetchUsers(existingToken)
        ]);
        
        // Finally fetch direct messages (depends on users being loaded)
        await fetchDirectMessages(existingToken);

          // Determine WebSocket URL based on hostname to avoid mixed content issues
          const wsUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || 'ws://teams.webuildtrades.co'
            : process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

          // Attempt WebSocket connection first (default mode)
          console.log('🚀 Starting connection process (WebSocket default mode)...');
          if (debugEnabled) {
            console.log('🔧 Connection Configuration:', {
              wsUrl,
              websocketEnabled,
              baseUrl,
              isLocalhost: typeof window !== 'undefined' ? window.location.hostname === 'localhost' : false,
              tokenPresent: !!existingToken,
              tokenLength: existingToken?.length || 0
            });
          }
          
          if (websocketEnabled) {
            // Skip WebSocket connectivity test on localhost to avoid CORS issues
            // API polling is working fine, so use that as the primary mode for localhost
            const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
            
            if (isLocalhost) {
              console.log('🏠 Running on localhost - skipping WebSocket test and using polling mode (avoids CORS)');
              setPollingMode(true);
            } else {
              try {
                console.log('🧪 Testing WebSocket connectivity...');
                // Test WebSocket connectivity
                const webSocketAvailable = await testWebSocketConnection(wsUrl, existingToken);
                console.log('🧪 WebSocket test result:', webSocketAvailable ? '✅ Available' : '❌ Not Available');
                
                if (webSocketAvailable) {
                  // WebSocket is available - use it as primary mode
                  console.log('🔗 Establishing WebSocket connection...');
                  await connectWebSocket(wsUrl, existingToken);
                  setPollingMode(false);
                  console.log('✅ WebSocket connected successfully (real-time mode active)');
                } else {
                  // WebSocket failed - fallback to polling
                  console.warn('⚠️ WebSocket test failed - falling back to polling mode');
                
                // Diagnose potential issues
                const diagnostic = checkWebSocketIssues(wsUrl);
                if (diagnostic.hasIssues) {
                  console.log('🔍 Potential WebSocket Issues Detected:');
                  diagnostic.issues.forEach(issue => console.log('   ' + issue));
                  console.log('💡 Suggestions:');
                  diagnostic.suggestions.forEach(suggestion => console.log('   ' + suggestion));
                }
                
                setPollingMode(true);
              }
            } catch (wsError) {
              // WebSocket connection failed - fallback to polling
              console.error('⚠️ WebSocket connection exception - falling back to polling mode:', wsError);
              console.log('🔍 Error details:', {
                name: wsError instanceof Error ? wsError.name : 'Unknown',
                message: wsError instanceof Error ? wsError.message : String(wsError),
                stack: wsError instanceof Error ? wsError.stack : undefined
              });
              setPollingMode(true);
            }
            }
          } else {
            // WebSocket explicitly disabled - use polling
            console.info('ℹ️ WebSocket explicitly disabled in configuration - using polling mode');
            setPollingMode(true);
          }
          
          setLoading(false);
        } catch (err) {
          console.error('Auto-connect failed:', err);
          localStorage.removeItem('mattermost_token');
          setToken('');
          setError('Please enter your Personal Access Token');
          setLoading(false);
        }
      };

      initializeConnection();
    } else {
      setLoading(false);
      setError('Please enter your Personal Access Token');
    }
  }, []); // Remove dependencies to prevent infinite re-renders

  // Mobile view detection and responsive behavior
  useEffect(() => {
    const checkMobileView = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      setIsMobileView(isMobile);
      
      // Auto-hide sidebar on mobile when channel is selected
      if (isMobile && currentChannel) {
        setShowMobileSidebar(false);
      }
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    
    return () => window.removeEventListener('resize', checkMobileView);
  }, [currentChannel]);

  // WebSocket event handlers
  useEffect(() => {
    if (!token) return;

    const unsubscribers: (() => void)[] = [];

    // Handle new messages
    const unsubscribeNewMessage = addEventListener('posted', (data) => {
      if (debugEnabled) console.log('Received new message:', data);
      
      const newMessage: Message = {
        id: data.post.id,
        message: data.post.message,
        user_id: data.post.user_id,
        username: usersMap[data.post.user_id]?.username || 'Unknown',
        create_at: data.post.create_at,
        channel_id: data.post.channel_id,
      };

      if (data.post.channel_id === currentChannel) {
        if (debugEnabled) console.log('Adding message to current channel:', newMessage);
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(msg => msg.id === newMessage.id)) {
            if (debugEnabled) console.log('Duplicate message detected, skipping');
            return prev;
          }
          const updated = [...prev, newMessage].sort((a, b) => a.create_at - b.create_at);
          if (debugEnabled) console.log('Updated messages array length:', updated.length);
          return updated;
        });
      } else {
        if (debugEnabled) console.log('Message for different channel, updating unread count');
        // Update unread count for other channels
        setUnreadCounts(prev => ({
          ...prev,
          [data.post.channel_id]: (prev[data.post.channel_id] || 0) + 1,
        }));
        
        // WebSocket notifications disabled - using polling pipeline for consistency
        if (debugEnabled) console.log('WebSocket notification creation disabled - handled by polling');
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
      if (debugEnabled) console.log('Received typing indicator:', data);
      if (data.channel_id !== currentChannel || data.user_id === currentUser?.id) return;

      setTypingUsers(prev => {
        const newTyping = new Map(Object.entries(prev).map(([k, v]) => [k, new Set(v)]));
        if (!newTyping.has(data.channel_id)) {
          newTyping.set(data.channel_id, new Set());
        }
        newTyping.get(data.channel_id)!.add(data.user_id);
        
        if (debugEnabled) console.log('Updated typing users for channel:', data.channel_id, newTyping.get(data.channel_id));
        
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
  }, [token, currentChannel, currentUser?.id, addEventListener]); // Remove usersMap to prevent re-renders

  // Current channel polling (default mode)
  useEffect(() => {
    // Always use polling for current channel messages
    if (!token || !currentChannel) return;

    // Only log polling start once per channel to reduce console noise
    if (debugEnabled && !localStorage.getItem(`polling_logged_${currentChannel}`)) {
      console.log('🔄 Starting current channel polling for:', currentChannel, 'interval:', pollingIntervalMs + 'ms');
      localStorage.setItem(`polling_logged_${currentChannel}`, 'true');
    }

    const pollMessages = async () => {
      try {
        // Reduce polling message frequency - only log occasionally
        if (debugEnabled && Math.random() < 0.05) console.log('🔄 Polling messages for channel:', currentChannel);
        
        const response = await fetch(`/api/mattermost/channels/${currentChannel}/posts`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Only log polling status occasionally to reduce console noise
        if (debugEnabled && Math.random() < 0.1) console.log('📡 Polling response status:', response.status, response.statusText);
        
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
          
          // Check for new messages compared to current messages
          const existingMessageIds = new Set(messages.map(msg => msg.id));
          const newMessages = latestMessages.filter(msg => !existingMessageIds.has(msg.id));
          
          // NOTE: Activity storage removed from current channel polling to prevent duplicates
          // Global polling handles activity storage for ALL channels (including current)
          // This eliminates the duplicate storage problem
          
          // Current channel notifications are handled by global polling to avoid duplicates
          if (debugEnabled && newMessages.length > 0 && Math.random() < 0.2) {
            console.log('📨 Current channel polling found', newMessages.length, 'new messages - notifications handled by global polling');
          }
          
          setMessages(latestMessages);
          if (debugEnabled && newMessages.length > 0 && Math.random() < 0.1) console.log('📨 Polling update: fetched', latestMessages.length, 'messages,', newMessages.length, 'new');
        }
      } catch (error) {
        console.warn('⚠️ Polling failed:', error);
      }
    };

    // Initial fetch
    pollMessages();
    
    // Poll at configured interval
    const pollInterval = setInterval(pollMessages, pollingIntervalMs);
    
    return () => {
      clearInterval(pollInterval);
      if (debugEnabled) console.log('🛑 Stopped polling for channel:', currentChannel);
    };
  }, [token, currentChannel, pollingIntervalMs, debugEnabled]); // Removed pollingMode and connectionStatus dependencies

  // Global polling for notifications across all channels (default mode)
  useEffect(() => {
    if (!token || channels.length === 0) return;

    if (debugEnabled) console.log('🔄 Starting global notification polling for', channels.length, 'channels (default mode)');

    const pollNotifications = async () => {
      try {
        // Poll each channel for new messages (excluding current channel as it's handled above)
        const otherChannels = channels.filter(ch => ch.id !== currentChannel);
        
        for (const channel of otherChannels) {
          try {
            const response = await fetch(`/api/mattermost/channels/${channel.id}/posts?per_page=10`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              const channelMessages: Message[] = Object.values(data.posts).map((post: any) => ({
                id: post.id,
                message: post.message,
                user_id: post.user_id,
                username: usersMap[post.user_id]?.username || 'Unknown',
                create_at: post.create_at,
                channel_id: post.channel_id,
              })).sort((a, b) => b.create_at - a.create_at); // Sort by newest first
              
              // Check for new messages (compare with last known message timestamp)
              const lastKnownTimestamp = localStorage.getItem(`lastPoll_${channel.id}`);
              const latestMessageTimestamp = channelMessages.length > 0 ? channelMessages[0].create_at : Date.now();
              
              const newMessages = lastKnownTimestamp 
                ? channelMessages.filter(msg => msg.create_at > parseInt(lastKnownTimestamp))
                : []; // Don't show any messages on first poll to avoid spam
              
              // Store activities for new messages (since WebSocket is disabled in localhost)
              for (const message of newMessages) {
                const success = await storeActivitySafely({
                  platform: 'mattermost',
                  event_type: 'message_posted',
                  user_id: message.user_id,
                  channel_id: message.channel_id,
                  data: {
                    message_id: message.id,
                    message: message.message,
                    type: message.type,
                    props: message.props,
                    root_id: message.root_id,
                    parent_id: message.parent_id,
                    create_at: message.create_at,
                    update_at: message.update_at,
                    source: 'global_polling'
                  },
                  timestamp: new Date(message.create_at).toISOString()
                });
                
                if (!success) {
                  break; // Stop trying if activity storage is disabled
                }
              }
              
              // Create notifications for new messages
              newMessages.forEach(newMessage => {
                if (newMessage.user_id !== currentUser?.id) {
                  const user = usersMap[newMessage.user_id];
                  
                  if (user) {
                    const isMention = newMessage.message.includes(`@${currentUser?.username}`) || 
                                    newMessage.message.includes(`@all`) || 
                                    newMessage.message.includes(`@here`);
                    
                    addNotification({
                      type: channel.type === 'D' ? 'direct_message' : (isMention ? 'mention' : 'message'),
                      channelId: channel.id,
                      channelName: channel.name,
                      channelDisplayName: channel.display_name || channel.name,
                      channelType: channel.type,
                      userId: user.id,
                      username: user.username,
                      userDisplayName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
                      message: newMessage.message,
                      messageId: newMessage.id,
                      mentioned: isMention,
                      priority: isMention || channel.type === 'D' ? 'high' : 'medium'
                    });
                    
                    // Update unread count for this channel
                    setUnreadCounts(prev => ({
                      ...prev,
                      [channel.id]: (prev[channel.id] || 0) + 1
                    }));
                  }
                }
              });
              
              // Update last known timestamp to the latest message timestamp
              localStorage.setItem(`lastPoll_${channel.id}`, latestMessageTimestamp.toString());
              
              if (debugEnabled && newMessages.length > 0) {
                console.log('📨 Global polling found', newMessages.length, 'new messages in', channel.display_name);
              }
            }
          } catch (error) {
            if (debugEnabled) console.warn('⚠️ Failed to poll channel', channel.display_name, error);
          }
        }
      } catch (error) {
        console.warn('⚠️ Global notification polling failed:', error);
      }
    };

    // Initial poll
    pollNotifications();
    
    // Poll at longer intervals for notifications (every 10 seconds)
    const notificationPollInterval = setInterval(pollNotifications, 10000);
    
    return () => {
      clearInterval(notificationPollInterval);
      if (debugEnabled) console.log('🛑 Stopped global notification polling');
    };
  }, [token, channels, currentChannel, currentUser, usersMap, addNotification]);

  // Cleanup highlight timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Clear highlight when switching channels
  useEffect(() => {
    if (highlightedMessageId) {
      setHighlightedMessageId(null);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    }
  }, [currentChannel]);

  // Subscribe to current channel events
  useEffect(() => {
    if (currentChannel && connectionStatus === 'connected') {
      if (debugEnabled) console.log('Subscribing to channel:', currentChannel);
      subscribeToChannel(currentChannel);
      // Clear unread count for current channel
      setUnreadCounts(prev => ({ ...prev, [currentChannel]: 0 }));
    }
  }, [currentChannel, connectionStatus, subscribeToChannel]); // Remove debugEnabled to prevent re-renders

  // Auto-subscribe to all channels when WebSocket connects
  useEffect(() => {
    if (connectionStatus === 'connected' && channels.length > 0) {
      if (debugEnabled) console.log('Auto-subscribing to all channels:', channels.map(c => c.id));
      channels.forEach(channel => {
        subscribeToChannel(channel.id);
      });
    }
  }, [connectionStatus, channels, subscribeToChannel]); // Remove debugEnabled to prevent re-renders

  useEffect(() => {
    if (currentChannel && token) {
      fetchMessages(currentChannel, token, true);
    }
  }, [currentChannel, token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update document title when channel changes
  useEffect(() => {
    if (currentChannel) {
      const currentChannelData = channels.find(c => c.id === currentChannel) || 
                                 directMessages.find(dm => dm.id === currentChannel);
      
      if (currentChannelData) {
        let channelName = currentChannelData.display_name || currentChannelData.name;
        const isDirectMessage = directMessages.find(dm => dm.id === currentChannel);
        
        // For direct messages, if display_name is not set properly (showing encoded ID), 
        // try to reconstruct it from users data
        if (isDirectMessage && currentChannelData.name && currentChannelData.name.includes('__') && currentUser) {
          const userIds = currentChannelData.name.split('__');
          const otherUserId = userIds.find((id: string) => id !== currentUser.id);
          const otherUser = users.find(user => user.id === otherUserId);
          
          if (otherUser) {
            channelName = otherUser.first_name && otherUser.last_name 
              ? `${otherUser.first_name} ${otherUser.last_name}`
              : otherUser.username;
          }
        }
        
        const prefix = isDirectMessage ? 'Chat with' : 'Channel:';
        document.title = `${prefix} ${channelName} - Mattermost`;
      } else {
        document.title = 'Mattermost - Chat Dashboard';
      }
    } else {
      document.title = 'Mattermost - Chat Dashboard';
    }
  }, [currentChannel, channels, directMessages, users, currentUser]);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChannels = useCallback(async (authToken: string, teamId?: string) => {
    try {
      const teamIdToUse = teamId || currentTeam?.id;
      if (!teamIdToUse) {
        throw new Error('Team ID is required to fetch channels');
      }
      
      const response = await fetch(`/api/mattermost/channels?teamId=${teamIdToUse}`, {
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
      console.error('Failed to fetch channels:', err);
      let errorMessage = 'Failed to connect to Mattermost. Please check your token and server URL.';
      
      if (err instanceof Error) {
        if (err.message.includes('Team ID is required')) {
          errorMessage = 'Failed to connect to Mattermost: No team available. Please ensure you have access to at least one team.';
        } else if (err.message.includes('Failed to fetch channels')) {
          errorMessage = 'Failed to fetch channels. Please check your token and server URL.';
        }
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  }, [currentTeam]);

  const fetchMessages = useCallback(async (channelId: string, authToken: string, resetPagination = true) => {
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
      
      // Set pagination state
      if (resetPagination) {
        setHasMoreMessages(data.pagination?.hasMore !== false); // Default to true if not specified
        setOldestMessageId(sortedMessages.length > 0 ? sortedMessages[0].id : '');
      }
    } catch (err) {
      setError('Failed to fetch messages');
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!currentChannel || !token || loadingOlderMessages || !hasMoreMessages || !oldestMessageId) {
      return;
    }

    setLoadingOlderMessages(true);
    
    try {
      // Store current scroll position
      if (messagesContainerRef.current) {
        previousScrollHeight.current = messagesContainerRef.current.scrollHeight;
      }

      const response = await fetch(
        `/api/mattermost/messages?channelId=${currentChannel}&perPage=50&before=${oldestMessageId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch older messages');
      }

      const data = await response.json();
      const olderMessagesArray = Object.values(data.posts || {}) as Message[];
      const sortedOlderMessages = olderMessagesArray.sort((a, b) => a.create_at - b.create_at);

      if (sortedOlderMessages.length > 0) {
        // Prepend older messages to the beginning of the messages array
        setMessages(prev => {
          const combined = [...sortedOlderMessages, ...prev];
          // Remove duplicates based on message ID
          const uniqueMessages = combined.filter((msg, index, arr) => 
            arr.findIndex(m => m.id === msg.id) === index
          );
          return uniqueMessages.sort((a, b) => a.create_at - b.create_at);
        });
        
        // Update oldest message ID for next pagination
        setOldestMessageId(sortedOlderMessages[0].id);
        
        // Restore scroll position after messages are loaded
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight.current;
            messagesContainerRef.current.scrollTop += scrollDiff;
          }
        }, 0);
      }
      
      // Update hasMoreMessages based on response
      setHasMoreMessages(data.pagination?.hasMore !== false && sortedOlderMessages.length > 0);
      
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [currentChannel, token, loadingOlderMessages, hasMoreMessages, oldestMessageId]);

  // Scroll event handler for infinite scroll
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      const { scrollTop } = messagesContainer;
      
      // If user scrolled to within 100px of the top, load older messages
      if (scrollTop < 100 && hasMoreMessages && !loadingOlderMessages) {
        loadOlderMessages();
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loadingOlderMessages, loadOlderMessages]);

  // Sidebar resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      // Constrain sidebar width between 180px and 400px
      if (newWidth >= 180 && newWidth <= 400) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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
        console.log('📎 File upload response:', uploadedFileData);
        
        // Mattermost returns { file_infos: [...] } format
        const fileInfos = uploadedFileData.file_infos || [];
        console.log('📎 File infos received:', fileInfos);
        
        setUploadedFiles(prev => [...prev, ...fileInfos]);
        setShowFileUpload(false);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to upload files:', errorText);
        setError('Failed to upload files: ' + errorText);
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
    console.log('📤 Attempting to send message...', {
      messageLength: newMessage.trim().length,
      currentChannel,
      hasToken: !!token,
      uploadedFiles: uploadedFiles.length
    });
    
    // Enhanced validation with better feedback
    if (!newMessage.trim() && uploadedFiles.length === 0) {
      console.warn('❌ Cannot send empty message');
      setError('Please enter a message or attach files');
      setTimeout(() => setError(''), 3000); // Clear error after 3 seconds
      return;
    }
    
    if (!currentChannel) {
      console.warn('❌ No channel selected');
      setError('Please select a channel first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (!token) {
      console.warn('❌ No authentication token');
      setError('Authentication required - please refresh and re-enter your token');
      return;
    }

    try {
      setLoading(true); // Show loading state during message sending
      setError(''); // Clear any previous errors
      
      const messageData: any = {
        channelId: currentChannel,
        message: newMessage.trim() || '', // Ensure message is never undefined
      };

      // Add file attachments if any
      if (uploadedFiles.length > 0) {
        console.log('📎 Processing uploaded files:', uploadedFiles);
        
        // Map file IDs from Mattermost file info objects
        const fileIds = uploadedFiles.map(file => {
          console.log('📎 File object:', file);
          return file.id;
        }).filter(Boolean); // Remove any undefined values
        
        console.log('📎 Extracted file IDs:', fileIds);
        
        if (fileIds.length > 0) {
          messageData.file_ids = fileIds;
        } else {
          console.error('❌ No valid file IDs found in uploaded files');
          setError('Failed to attach files - invalid file data');
          return;
        }
      }

      console.log('📤 Sending message data:', {
        channelId: currentChannel,
        messagePreview: newMessage.trim().substring(0, 50) + (newMessage.length > 50 ? '...' : ''),
        hasFiles: uploadedFiles.length > 0,
        fileIds: messageData.file_ids || []
      });

      const response = await fetch('/api/mattermost/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      console.log('📡 Message API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Message sending failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        
        // More specific error messages based on status code
        let errorMessage = 'Failed to send message';
        if (response.status === 401) {
          errorMessage = 'Authentication failed - please check your token';
        } else if (response.status === 403) {
          errorMessage = 'Permission denied - you may not have access to this channel';
        } else if (response.status === 400) {
          errorMessage = 'Invalid message data - please try again';
        } else if (response.status >= 500) {
          errorMessage = 'Server error - please try again later';
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Message sent successfully:', result);

      // NOTE: Activity storage removed from sent message handler to prevent duplicates
      // Global polling will detect and store this message as an activity automatically
      // This eliminates duplicate storage when users send messages

      // Clear form only after successful send
      setNewMessage('');
      setUploadedFiles([]);
      
      // If WebSocket is connected, we don't need to refresh manually as we'll get the message via WebSocket
      // If not connected (polling mode), refresh messages
      if (connectionStatus !== 'connected' || pollingMode) {
        console.log('🔄 Refreshing messages manually (not connected via WebSocket)');
        await fetchMessages(currentChannel, token);
      } else {
        console.log('🔗 Message sent, waiting for WebSocket update');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('❌ Send message error:', err);
      setError(errorMessage);
      
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectMessages = useCallback(async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/direct-messages', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        console.warn('Authentication failed - invalid token in fetchDirectMessages');
        localStorage.removeItem('mattermost_token');
        setToken('');
        setError('Authentication failed. Please check your Personal Access Token');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch direct messages: ${response.status}`);
      }

      const dmChannels = await response.json();
      
      // Enhanced DM channels with proper display names
      const enhancedDMChannels = dmChannels.map((channel: any) => {
        // For direct messages, the name contains user IDs separated by double underscores
        // We need to find the other user's name
        if (channel.type === 'D' && currentUser) {
          const userIds = channel.name.split('__');
          const otherUserId = userIds.find((id: string) => id !== currentUser.id);
          const otherUser = users.find(user => user.id === otherUserId);
          
          if (otherUser) {
            const displayName = otherUser.first_name && otherUser.last_name 
              ? `${otherUser.first_name} ${otherUser.last_name}`
              : otherUser.username;
            
            return {
              ...channel,
              display_name: displayName,
              other_user_id: otherUserId,
              status: 'online' // Default to online, will be updated by status events
            };
          }
        }
        
        return channel;
      });
      
      setDirectMessages(enhancedDMChannels);
    } catch (err) {
      console.error('Failed to fetch direct messages:', err);
      setError('Failed to load direct messages. Please check your connection.');
    }
  }, [currentUser, users]);

  // Re-enhance direct messages when users or currentUser data becomes available
  useEffect(() => {
    if (currentUser && users.length > 0 && directMessages.length > 0) {
      const reEnhancedDMs = directMessages.map((channel) => {
        // Only re-enhance if it's a DM and doesn't have a proper display_name
        if (channel.type === 'D' && (!channel.display_name || channel.display_name.includes('__'))) {
          const userIds = channel.name.split('__');
          const otherUserId = userIds.find((id: string) => id !== currentUser.id);
          const otherUser = users.find(user => user.id === otherUserId);
          
          if (otherUser) {
            const displayName = otherUser.first_name && otherUser.last_name 
              ? `${otherUser.first_name} ${otherUser.last_name}`
              : otherUser.username;
            
            return {
              ...channel,
              display_name: displayName,
              other_user_id: otherUserId,
              status: 'online'
            };
          }
        }
        return channel;
      });
      
      // Only update if there are actual changes
      const hasChanges = reEnhancedDMs.some((dm, index) => 
        dm.display_name !== directMessages[index]?.display_name
      );
      
      if (hasChanges) {
        setDirectMessages(reEnhancedDMs);
      }
    }
  }, [currentUser, users, directMessages]);

  const fetchUsers = useCallback(async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        console.warn('Authentication failed - invalid token in fetchUsers');
        localStorage.removeItem('mattermost_token');
        setToken('');
        setError('Authentication failed. Please check your Personal Access Token');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
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
      setError('Failed to load users. Please check your connection.');
    }
  }, []);

  const createDirectMessage = useCallback(async (userId: string) => {
    if (!token || !currentUser) return;
    
    try {
      setLoading(true);
      
      // Create direct message channel
      const response = await fetch('/api/mattermost/direct-messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userIds: [currentUser.id, userId] }),
      });

      if (!response.ok) {
        throw new Error('Failed to create direct message');
      }

      const dmChannel = await response.json();
      
      // Add the new DM channel to the direct messages list if it's not already there
      setDirectMessages(prev => {
        const exists = prev.some(dm => dm.id === dmChannel.id);
        if (exists) return prev;
        return [...prev, dmChannel];
      });
      
      // Switch to the new DM channel
      setCurrentChannel(dmChannel.id);
      
      if (debugEnabled) console.log('Created direct message channel:', dmChannel.id);
      
    } catch (err) {
      console.error('Failed to create direct message:', err);
      setError('Failed to start chat with user');
    } finally {
      setLoading(false);
    }
  }, [token, currentUser]);

  const switchToChannel = async (channelId: string) => {
    if (channelId !== currentChannel) {
      const previousChannel = currentChannel;
      setCurrentChannel(channelId);
      
      // Store channel switch activity
      await storeActivitySafely({
        platform: 'mattermost',
        event_type: 'channel_switched',
        user_id: currentUser?.id,
        channel_id: channelId,
        data: {
          previous_channel_id: previousChannel,
          new_channel_id: channelId,
          source: 'manual_switch'
        },
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleChannelCreated = (newChannel: Channel) => {
    setChannels(prev => [...prev, newChannel]);
    switchToChannel(newChannel.id);
    setShowChannelManager(false);
  };

  const handleChannelDeleted = (channelId: string) => {
    setChannels(prev => prev.filter(c => c.id !== channelId));
    if (currentChannel === channelId) {
      setCurrentChannel(channels.length > 1 ? channels.find(c => c.id !== channelId)?.id || '' : '');
    }
  };

  // Notification handlers are now handled by the context
  
  const highlightMessage = (messageId: string) => {
    // Clear any existing highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    // Set the highlighted message
    setHighlightedMessageId(messageId);
    
    // Try to scroll to the message, with retry logic
    const tryScrollToMessage = (retries = 3) => {
      const messageElement = messageRefs.current.get(messageId);
      if (messageElement) {
        messageElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      } else if (retries > 0) {
        // Message not found, try again after a short delay
        setTimeout(() => tryScrollToMessage(retries - 1), 200);
      } else {
        // Message not found in current messages, check if it exists in the channel
        const messageExists = messages.some(msg => msg.id === messageId);
        if (!messageExists) {
          console.warn('Message not found for highlighting - may be in older messages:', messageId);
          // Could implement loading older messages here if needed
        } else {
          console.warn('Message element not found in DOM for highlighting:', messageId);
        }
      }
    };
    
    tryScrollToMessage();
    
    // Clear highlight after 5 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 5000);
  };
  
  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current.get(messageId);
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  };

  const handleUnifiedSearchChannelSelect = (channelId: string) => {
    setCurrentChannel(channelId);
    setShowUnifiedSearch(false);
  };

  const handleUnifiedSearchUserSelect = async (userId: string) => {
    await createDirectMessage(userId);
    setShowUnifiedSearch(false);
  };

  const handleQuickMessageSend = async (target: { type: 'channel' | 'user'; id: string; name: string }, message: string) => {
    if (target.type === 'channel') {
      // Send message to channel
      const originalChannel = currentChannel;
      setCurrentChannel(target.id);
      setNewMessage(message);
      await sendMessage();
      setCurrentChannel(originalChannel);
    } else {
      // Create DM and send message
      await createDirectMessage(target.id);
      setNewMessage(message);
      await sendMessage();
    }
  };

  const validateToken = useCallback(async (authToken: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/mattermost/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        console.warn('Token is invalid or expired');
        localStorage.removeItem('mattermost_token');
        setToken('');
        setError('Token expired. Please enter a new Personal Access Token');
        return false;
      }

      return response.ok;
    } catch (err) {
      console.error('Token validation failed:', err);
      return false;
    }
  }, []);

  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        console.warn('Authentication failed - invalid token');
        localStorage.removeItem('mattermost_token');
        setToken('');
        setError('Authentication failed. Please check your Personal Access Token');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch current user: ${response.status}`);
      }

      const userData = await response.json();
      setCurrentUser(userData);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      setError('Failed to connect to Mattermost. Please check your token and try again.');
    }
  }, []);

  const fetchTeams = useCallback(async (authToken: string) => {
    try {
      const response = await fetch('/api/mattermost/teams', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        console.warn('Authentication failed - invalid token in fetchTeams');
        localStorage.removeItem('mattermost_token');
        setToken('');
        setError('Authentication failed. Please check your Personal Access Token');
        return [];
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.status}`);
      }

      const teamsData = await response.json();
      setTeams(teamsData);
      if (teamsData.length > 0) {
        setCurrentTeam(teamsData[0]);
      }
      return teamsData;
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      setError('Failed to load teams. Please check your connection.');
      return [];
    }
  }, []);

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

  // Check for CORS and WebSocket configuration issues
  const checkWebSocketIssues = (wsUrl: string) => {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('192.168.');
    
    const issues = [];
    
    if (isLocalhost) {
      issues.push('🔒 CORS: Add "http://localhost:3000" and "ws://localhost:3000" to Mattermost server CORS settings');
    }
    
    if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      issues.push('🌐 URL: WebSocket URL might be malformed - should start with wss:// or ws://');
    }
    
    if (wsUrl.includes('localhost') && window.location.protocol === 'https:') {
      issues.push('🔐 Protocol: HTTPS page trying to connect to localhost WebSocket may be blocked');
    }
    
    // Check if URL is accessible
    try {
      new URL(wsUrl);
    } catch {
      issues.push('🌐 URL: WebSocket URL appears to be malformed or invalid');
    }
    
    // Check if connecting to a different domain
    if (typeof window !== 'undefined') {
      try {
        const wsHostname = new URL(wsUrl).hostname;
        const pageHostname = window.location.hostname;
        if (wsHostname !== pageHostname && !wsHostname.includes('localhost')) {
          issues.push('🔗 CORS: Connecting to different domain - ensure CORS is configured on the server');
        }
      } catch {
        // URL parsing failed, already caught above
      }
    }
    
    return {
      hasIssues: issues.length > 0,
      issues,
      suggestions: [
        '1. Check if Mattermost server supports WebSocket connections',
        '2. Verify CORS settings on Mattermost server',
        '3. Check network/firewall restrictions',
        '4. Ensure Personal Access Token has proper permissions'
      ]
    };
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
        // Fetch current user and teams first
        const [_, teamsData] = await Promise.all([
          fetchCurrentUser(userToken),
          fetchTeams(userToken)
        ]);
        
        // Then fetch users and channels (use first team if available)
        const teamId = teamsData.length > 0 ? teamsData[0].id : null;
        await Promise.all([
          teamId ? fetchChannels(userToken, teamId) : Promise.resolve(),
          fetchUsers(userToken)
        ]);
        
        // Finally fetch direct messages (depends on users being loaded)
        await fetchDirectMessages(userToken);

        // Attempt WebSocket connection first (default real-time mode)
        if (debugEnabled) console.log('Attempting WebSocket connection (default mode)...', { wsUrl, userToken: '***' });
        
        if (websocketEnabled) {
          // Skip WebSocket connectivity test on localhost to avoid CORS issues
          const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
          
          if (isLocalhost) {
            if (debugEnabled) console.log('🏠 Running on localhost - using polling mode (avoids CORS)');
            setPollingMode(true);
          } else {
            try {
              const webSocketAvailable = await testWebSocketConnection(wsUrl, userToken);
              if (debugEnabled) console.log('WebSocket connectivity test:', webSocketAvailable);
              
              if (webSocketAvailable) {
                // WebSocket is available - use it as primary mode
                await connectWebSocket(wsUrl, userToken);
                setPollingMode(false);
                if (debugEnabled) console.log('✅ WebSocket connected successfully (real-time mode active)');
              } else {
                // WebSocket failed - fallback to polling
                console.warn('⚠️ WebSocket not available, falling back to polling mode');
                setPollingMode(true);
              }
            } catch (wsError) {
              // WebSocket connection failed - fallback to polling
              console.warn('⚠️ WebSocket connection failed, falling back to polling mode:', wsError);
              setPollingMode(true);
            }
          }
        } else {
          // WebSocket explicitly disabled - use polling
          console.info('ℹ️ WebSocket explicitly disabled, using polling mode');
          setPollingMode(true);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Authentication failed:', err);
        
        // Check for specific WebSocket and configuration errors
        const wsUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || 'ws://teams.webuildtrades.co'
          : process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        const diagnostic = checkWebSocketIssues(wsUrl);
        if (diagnostic.hasIssues || (err instanceof Error && err.message.includes('CORS'))) {
          const corsMessage = diagnostic.issues.length > 0 ? diagnostic.issues.join('. ') : 'The Mattermost server needs CORS configuration for localhost development.';
          setError(`WebSocket connection failed. ${corsMessage} You can continue using the app in polling mode.`);
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
    <div className="flex h-screen bg-gray-100 relative">
      {/* Top Header */}
      <div className="fixed top-0 left-16 right-0 h-14 bg-[#1e1e2e] text-white border-b border-gray-600 z-50 flex items-center">
        {/* Mobile Menu Button */}
        {isMobileView && (
          <button
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            className="p-3 text-white hover:bg-gray-700 md:hidden"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        
        {/* Left: Mattermost Logo and Badge */}
        <div className={`flex items-center ${isMobileView ? 'px-2 mr-2' : 'px-4 mr-6'}`}>
          <div className="flex items-center space-x-2">
            {/* Mattermost Icon */}
            <div className="w-6 h-6 mr-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span className={`text-white font-medium ${isMobileView ? 'hidden sm:inline' : ''}`}>Mattermost</span>
            <span className={`ml-2 text-xs bg-blue-500 px-2 py-1 rounded text-white ${isMobileView ? 'hidden sm:inline' : ''}`}>FREE EDITION</span>
          </div>
        </div>

        {/* Center: Search */}
        <div className={`flex-1 max-w-md ${isMobileView ? 'mx-2' : 'mx-4'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={isMobileView ? "Search..." : "Search"}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className={`w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded focus:bg-gray-600 focus:outline-none placeholder-gray-400 ${isMobileView ? 'text-sm' : ''}`}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className={`flex items-center space-x-2 ${isMobileView ? 'px-2' : 'px-4'}`}>
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {connectionStatus === 'connected' && (
              <div className="flex items-center space-x-1 text-green-400" title="WebSocket real-time connection active (enhanced mode)">
                <Wifi className="h-4 w-4" />
                <span className={`text-xs ${isMobileView ? 'hidden' : ''}`}>Enhanced</span>
              </div>
            )}
            {connectionStatus !== 'connected' && connectionStatus !== 'connecting' && (
              <div className="flex items-center space-x-1 text-blue-400" title="Polling mode active (default mode)">
                <div className="animate-pulse h-4 w-4 bg-blue-400 rounded-full"></div>
                <span className={`text-xs ${isMobileView ? 'hidden' : ''}`}>Polling</span>
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div className="flex items-center space-x-1 text-yellow-400" title="Attempting WebSocket connection (enhanced mode)">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                <span className={`text-xs ${isMobileView ? 'hidden' : ''}`}>Connecting</span>
              </div>
            )}
          </div>
          
          <button className="p-2 hover:bg-gray-700 rounded">
            <HelpCircle className="h-5 w-5" />
          </button>
          <div className="relative">
            <button 
              className="p-2 hover:bg-gray-700 rounded relative"
              onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            >
              <Bell className="h-5 w-5" />
              {(unreadCount > 0 || Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 0) && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
              )}
            </button>
            
            <NotificationDropdown
              isOpen={showNotificationDropdown}
              onClose={() => setShowNotificationDropdown(false)}
              unreadCounts={unreadCounts}
              channels={channels}
              users={users}
              currentUser={currentUser}
              onChannelSelect={(channelId, messageId) => {
                setCurrentChannel(channelId);
                setShowNotificationDropdown(false);
                
                // Highlight the message if messageId is provided
                if (messageId) {
                  // Add a small delay to ensure the channel has switched and messages are loaded
                  setTimeout(() => {
                    highlightMessage(messageId);
                  }, 100);
                }
              }}
            />
          </div>
          <button 
            className="p-2 hover:bg-gray-700 rounded"
            onClick={() => {
              console.log('🔍 Mattermost Connection Debug Info:');
              console.log({
                connectionMode: connectionStatus === 'connected' ? 'WebSocket Enhanced' : 'Polling (Default)',
                connectionStatus,
                pollingMode,
                isReconnecting,
                reconnectAttempts,
                maxReconnectAttempts,
                websocketEnabled: websocketEnabled ? 'Yes (Default)' : 'No',
                wsUrl: (() => {
                  const wsUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
                    ? process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || 'ws://teams.webuildtrades.co'
                    : process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
                  return wsUrl;
                })(),
                baseUrl,
                currentChannel,
                currentChannelName: channels.find(c => c.id === currentChannel)?.display_name || directMessages.find(dm => dm.id === currentChannel)?.display_name || 'Unknown',
                channelsCount: channels.length,
                directMessagesCount: directMessages.length,
                messagesCount: messages.length,
                pollingInterval: pollingIntervalMs + 'ms',
                tokenPresent: !!token,
                tokenLength: token?.length || 0,
                currentUser: currentUser?.username || 'Unknown',
                usersCount: users.length
              });
              
              // Test message sending capability
              console.log('🧪 Message Sending Test:');
              console.log({
                canSendMessage: !!(currentChannel && token && !loading),
                validations: {
                  hasCurrentChannel: !!currentChannel,
                  hasToken: !!token,
                  notLoading: !loading,
                  hasMessageInput: newMessage.trim().length > 0
                }
              });
              
              // Run WebSocket diagnostics
              const wsUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
                ? process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || 'ws://teams.webuildtrades.co'
                : process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
              const diagnostic = checkWebSocketIssues(wsUrl);
              if (diagnostic.hasIssues) {
                console.log('⚠️ Potential Issues:');
                diagnostic.issues.forEach(issue => console.log('   ' + issue));
                console.log('💡 Suggestions:');
                diagnostic.suggestions.forEach(suggestion => console.log('   ' + suggestion));
              } else {
                console.log('✅ No obvious configuration issues detected');
              }
              
              // Test WebSocket connection manually
              if (token && pollingMode) {
                console.log('🧪 Running manual WebSocket test...');
                const wsUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
                  ? process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || 'ws://teams.webuildtrades.co'
                  : process.env.NEXT_PUBLIC_MATTERMOST_WS_URL || baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
                testWebSocketConnection(wsUrl, token)
                  .then(result => {
                    console.log('🧪 Manual WebSocket test result:', result ? '✅ Success' : '❌ Failed');
                  })
                  .catch(error => {
                    console.error('🧪 Manual WebSocket test error:', error);
                  });
              }
              
              // Test API connectivity
              if (token && currentChannel) {
                console.log('🧪 Testing message API connectivity...');
                fetch('/api/mattermost/messages', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    channelId: currentChannel,
                    message: '🧪 Test message - please ignore'
                  })
                })
                .then(response => {
                  console.log('🧪 Message API test result:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                  });
                  return response.text();
                })
                .then(text => {
                  console.log('🧪 Message API response body:', text);
                })
                .catch(error => {
                  console.error('🧪 Message API test error:', error);
                });
              }
            }}
          >
            <Settings className="h-5 w-5" />
          </button>
          
          {/* User Profile */}
          <div className="ml-2 flex items-center cursor-pointer hover:bg-gray-700 rounded px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold text-sm mr-2">
              {currentUser?.first_name?.charAt(0) || currentUser?.username?.charAt(0) || 'U'}
            </div>
            <span className="text-sm text-gray-300">{currentTeam?.display_name || 'Loading...'}</span>
            <ChevronDown className="h-4 w-4 ml-1 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileView && showMobileSidebar && (
        <div 
          className="fixed top-0 left-16 right-0 bottom-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex w-full h-full pt-14">
        {/* Left Sidebar */}
        <div 
          ref={sidebarRef}
          className={`
            bg-[#2d3748] text-white flex flex-col border-r border-gray-600 relative transition-transform duration-300 ease-in-out
            ${isMobileView 
              ? `fixed top-14 left-16 bottom-0 z-50 w-80 transform ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}`
              : 'relative'
            }
          `}
          style={!isMobileView ? { width: `${sidebarWidth}px`, minWidth: '180px', maxWidth: '400px' } : {}}
        >
          {/* Team Info */}
          <div className="p-4 border-b border-gray-600 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs font-bold">
                  {currentTeam?.display_name?.charAt(0) || 'T'}
                </div>
                <span className="font-semibold text-sm">{currentTeam?.display_name || 'Loading...'}</span>
              </div>
              <button
                onClick={() => setShowChannelManager(true)}
                className="p-1 hover:bg-gray-600 rounded transition-colors"
                title="Manage Channels"
              >
                <Settings className="h-4 w-4 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            {/* Unified Search */}
            <UnifiedSearch
              token={token}
              currentTeam={currentTeam}
              currentUser={currentUser}
              onChannelSelect={handleUnifiedSearchChannelSelect}
              onUserSelect={handleUnifiedSearchUserSelect}
              onSendMessage={handleQuickMessageSend}
              className="mb-3"
            />
            
            {/* Start New Chat Button */}
            <button 
              onClick={() => {
                setShowUserPicker(true);
                setUserSearchQuery('');
              }}
              className="w-full text-left px-3 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center transition-colors mb-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>Start New Chat</span>
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            {/* Threads */}
            <div className="p-2 border-b border-gray-600">
              <button className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-600 text-sm text-left">
                <div className="w-4 h-4 rounded bg-purple-500 flex items-center justify-center">
                  <span className="text-xs">T</span>
                </div>
                <span>Threads</span>
              </button>
            </div>

            {/* Channels Section */}
            <div className="px-2 py-3">
              <div className="flex items-center justify-between px-3 py-1 mb-2">
                <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Channels
                </span>
                <Plus className="h-4 w-4 text-gray-400 cursor-pointer hover:text-white" />
              </div>
              
              <div className="space-y-1">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => switchToChannel(channel.id)}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg text-sm font-medium
                      transition-all duration-200 ease-out flex items-center justify-between group
                      ${currentChannel === channel.id 
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-500/20' 
                        : 'text-gray-300 hover:bg-gray-600/70 hover:text-white hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex items-center min-w-0">
                      <Hash className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{channel.display_name || channel.name}</span>
                    </div>
                    {unreadCounts[channel.id] > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">
                        {unreadCounts[channel.id] > 99 ? '99+' : unreadCounts[channel.id]}
                      </div>
                    )}
                  </button>
                ))}
                
                {/* Add channels option */}
                <button className="w-full text-left px-3 py-1.5 rounded text-sm text-gray-400 hover:bg-gray-600 hover:text-white flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Add channels</span>
                </button>
              </div>
            </div>

            {/* Direct Messages Section */}
            <div className="px-2 py-3">
              <div className="flex items-center justify-between px-3 py-1 mb-2">
                <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Direct Messages
                </span>
                <button 
                  onClick={() => {
                    // Debug logging
                    console.log('Debug - Users array:', users);
                    console.log('Debug - Current user:', currentUser);
                    console.log('Debug - Direct messages:', directMessages);
                    console.log('Debug - Filtered users:', users.filter(user => user.id !== currentUser?.id));
                    
                    // Show user picker
                    setShowUserPicker(!showUserPicker);
                    setUserSearchQuery('');
                  }}
                  className="p-1 rounded hover:bg-gray-600 transition-colors"
                  title="Start new chat with team member"
                >
                  <Plus className="h-4 w-4 text-gray-400 hover:text-white" />
                </button>
              </div>
              
              <div className="space-y-1">
                {/* Existing Direct Message Channels */}
                {directMessages.map((dm) => (
                  <button
                    key={dm.id}
                    onClick={() => switchToChannel(dm.id)}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg text-sm font-medium
                      transition-all duration-200 ease-out flex items-center justify-between group
                      ${currentChannel === dm.id 
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-500/20' 
                        : 'text-gray-300 hover:bg-gray-600/70 hover:text-white hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex items-center min-w-0">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                      <span className="truncate">{dm.display_name || dm.name}</span>
                    </div>
                  </button>
                ))}
                
                {/* Available Users to Start Chat */}
                {(() => {
                  const availableUsers = users.filter(user => user.id !== currentUser?.id);
                  const usersWithoutDMs = availableUsers.filter(user => 
                    !directMessages.find(dm => dm.other_user_id === user.id)
                  );
                  
                  
                  return (
                    <>
                      {/* Always show section if we have users */}
                      {availableUsers.length > 0 && (
                        <>
                          <div className="border-t border-gray-600 my-2 pt-2">
                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3">
                              Start New Chat ({usersWithoutDMs.length} available)
                            </span>
                          </div>
                          
                          {usersWithoutDMs.length > 0 ? (
                            usersWithoutDMs.slice(0, 8).map((user) => {
                              const displayName = user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}`
                                : user.username;
                              
                              return (
                                <button
                                  key={user.id}
                                  onClick={() => createDirectMessage(user.id)}
                                  className="w-full text-left px-3 py-1.5 rounded text-sm text-gray-400 hover:bg-gray-600 hover:text-white flex items-center transition-colors"
                                  disabled={loading}
                                  title={`Start chat with ${displayName}`}
                                >
                                  <div className={`w-2 h-2 rounded-full mr-3 ${
                                    user.last_picture_update > 0 ? 'bg-green-400' : 'bg-gray-400'
                                  }`}></div>
                                  <span className="truncate">{displayName}</span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-3 py-2 text-xs text-gray-500">
                              All team members already have chats
                            </div>
                          )}
                        </>
                      )}
                      
                      {/* Fallback if no users loaded */}
                      {availableUsers.length === 0 && (
                        <div className="border-t border-gray-600 my-2 pt-2">
                          <div className="px-3 py-2 text-xs text-gray-500">
                            {users.length === 0 ? 'Loading team members...' : 'No other team members found'}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                
                {/* User Picker Modal */}
                {showUserPicker && (
                  <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-10 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg p-4 max-w-md w-full mx-4 max-h-96 overflow-hidden flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-semibold">Start New Chat</h3>
                        <button 
                          onClick={() => setShowUserPicker(false)}
                          className="text-gray-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                      
                      {/* Search Input */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search team members..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded text-sm focus:bg-gray-600 focus:outline-none placeholder-gray-400"
                          autoFocus
                        />
                      </div>
                      
                      {/* Users List */}
                      <div className="flex-1 overflow-y-auto space-y-1">
                        {(() => {
                          const availableUsers = users.filter(user => user.id !== currentUser?.id);
                          const filteredUsers = availableUsers.filter(user => {
                            const displayName = user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}`
                              : user.username;
                            return displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                   user.username.toLowerCase().includes(userSearchQuery.toLowerCase());
                          });
                          
                          if (filteredUsers.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-400">
                                {userSearchQuery ? 'No users found' : 'No team members available'}
                              </div>
                            );
                          }
                          
                          return filteredUsers.map(user => {
                            const displayName = user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}`
                              : user.username;
                              
                            const existingDM = directMessages.find(dm => dm.other_user_id === user.id);
                            
                            return (
                              <button
                                key={user.id}
                                onClick={() => {
                                  createDirectMessage(user.id);
                                  setShowUserPicker(false);
                                }}
                                className="w-full text-left px-3 py-3 rounded text-sm text-white hover:bg-gray-700 flex items-center transition-colors"
                                disabled={loading}
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm mr-3">
                                  {displayName[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">{displayName}</div>
                                  <div className="text-xs text-gray-400">@{user.username}</div>
                                  {existingDM && (
                                    <div className="text-xs text-green-400">Already have chat</div>
                                  )}
                                </div>
                                <div className={`w-2 h-2 rounded-full ${
                                  user.last_picture_update > 0 ? 'bg-green-400' : 'bg-gray-400'
                                }`}></div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                      
                      <div className="mt-4 text-xs text-gray-400 text-center">
                        Found {users.filter(user => user.id !== currentUser?.id).length} team members
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>


          </div>
          
          {/* Resize Handle */}
          <div
            className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors ${
              isResizing ? 'bg-blue-500' : ''
            }`}
            onMouseDown={handleMouseDown}
            title="Drag to resize sidebar"
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white shadow-lg border-l border-gray-200">
          {/* Channel Header */}
          <div className={`bg-white border-b border-gray-200 ${isMobileView ? 'px-3 py-2' : 'px-4 py-3'} flex-shrink-0`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0 flex-1">
                {(() => {
                  const currentChannelData = channels.find(c => c.id === currentChannel) || 
                                           directMessages.find(dm => dm.id === currentChannel);
                  
                  if (!currentChannelData) {
                    return (
                      <div className="flex items-center text-gray-500">
                        <Hash className="h-5 w-5 mr-2" />
                        <span className="text-lg font-medium">Select a channel</span>
                      </div>
                    );
                  }

                  const isDirectMessage = directMessages.find(dm => dm.id === currentChannel);
                  
                  return (
                    <div className="flex items-center min-w-0">
                      {isDirectMessage ? (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs mr-3">
                          {currentChannelData.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      ) : (
                        <Hash className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0" />
                      )}
                      
                      <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-gray-900 truncate">
                          {currentChannelData.display_name || currentChannelData.name}
                        </h1>
                        {isDirectMessage ? (
                          <span className="text-xs text-gray-500">Last online 15 hr. ago</span>
                        ) : currentChannelData.purpose ? (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {currentChannelData.purpose}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              <div className="flex items-center space-x-1 ml-4">
                <button 
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  title="Start a call"
                >
                  <Phone className="h-4 w-4 text-gray-600" />
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  title="Start video call"
                >
                  <Video className="h-4 w-4 text-gray-600" />
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  title="Add members"
                >
                  <UserPlus className="h-4 w-4 text-gray-600" />
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  title="More options"
                >
                  <MoreHorizontal className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-gray-50/30"
          >
            {/* Loading older messages indicator */}
            {loadingOlderMessages && (
              <div className="flex justify-center py-4">
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span className="text-sm">Loading older messages...</span>
                </div>
              </div>
            )}

            {/* No more messages indicator */}
            {!hasMoreMessages && messages.length > 50 && (
              <div className="flex justify-center py-4">
                <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  You've reached the beginning of this conversation
                </div>
              </div>
            )}

            {messages.length === 0 && currentChannel && !loadingOlderMessages && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                <Hash className="h-16 w-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">
                  Beginning of {(() => {
                    const channelData = channels.find(c => c.id === currentChannel) || 
                                       directMessages.find(dm => dm.id === currentChannel);
                    return channelData?.display_name || channelData?.name || 'conversation';
                  })()}
                </p>
                <p className="text-sm">
                  This is the very beginning of the {(() => {
                    const channelData = channels.find(c => c.id === currentChannel) || 
                                       directMessages.find(dm => dm.id === currentChannel);
                    return channelData?.display_name || channelData?.name || 'conversation';
                  })()} {directMessages.find(dm => dm.id === currentChannel) ? 'conversation' : 'channel'}.
                </p>
              </div>
            )}
            <div className="px-4 py-2">
              {messages.map((message, index) => {
                const prevMessage = index > 0 ? messages[index - 1] : null;
                const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
                
                // Check if this message should be grouped with the previous one (within 5 minutes, same user)
                const isGrouped = prevMessage && 
                  prevMessage.user_id === message.user_id && 
                  (message.create_at - prevMessage.create_at) < 300000; // 5 minutes
                
                const messageUser = usersMap[message.user_id] || { username: message.username, first_name: '', last_name: '' };
                const displayName = messageUser.first_name && messageUser.last_name 
                  ? `${messageUser.first_name} ${messageUser.last_name}`
                  : messageUser.username || 'Unknown User';

                const messageTime = new Date(message.create_at);
                const timeString = messageTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                });

                const isToday = messageTime.toDateString() === new Date().toDateString();
                const dateTimeString = isToday 
                  ? timeString 
                  : messageTime.toLocaleDateString() + ' ' + timeString;
                
                return (
                  <div 
                    key={message.id} 
                    ref={(el) => {
                      if (el) {
                        messageRefs.current.set(message.id, el);
                      } else {
                        messageRefs.current.delete(message.id);
                      }
                    }}
                    className={`
                      group hover:bg-gray-50/80 transition-all duration-300 ease-out
                      ${isMobileView ? '-mx-3 px-3 rounded-lg' : '-mx-4 px-4 rounded-md'}
                      ${isGrouped 
                        ? `${isMobileView ? 'py-0.5' : 'py-1'}` 
                        : `${isMobileView ? 'py-2 mt-2' : 'py-3 mt-4'}`
                      }
                      ${highlightedMessageId === message.id 
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-l-4 border-l-yellow-400 shadow-lg ring-2 ring-yellow-300/50' 
                        : 'hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex items-start">
                      {/* Avatar Column */}
                      <div className={`${isMobileView ? 'w-8 mr-2' : 'w-10 mr-3'} flex-shrink-0 mt-0.5`}>
                        {!isGrouped ? (
                          <div className={`${isMobileView ? 'w-7 h-7' : 'w-9 h-9'} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                            {displayName[0]?.toUpperCase() || '?'}
                          </div>
                        ) : (
                          <div className={`${isMobileView ? 'w-7 h-5' : 'w-9 h-5'} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <span className="text-xs text-gray-400">
                              {timeString}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Message Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header - only show for non-grouped messages */}
                        {!isGrouped && (
                          <div className={`flex items-baseline space-x-2 ${isMobileView ? 'mb-0.5' : 'mb-1'}`}>
                            <button className={`font-semibold text-gray-900 hover:underline transition-colors ${isMobileView ? 'text-sm' : 'text-base'}`}>
                              {displayName}
                            </button>
                            <span className={`${isMobileView ? 'text-xs' : 'text-sm'} text-gray-500 font-medium`}>
                              {dateTimeString}
                            </span>
                          </div>
                        )}
                        
                        {/* Message Text */}
                        <div className={`text-gray-800 leading-relaxed break-words ${isMobileView ? 'text-sm' : 'text-base'}`}>
                          <MessageRenderer
                            content={message.message}
                            className="enhanced-message-content"
                          />
                        </div>
                        
                        {/* Message Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="mt-1">
                            <MessageReactions
                              reactions={message.reactions}
                              onReact={(emoji) => handleReaction(message.id, emoji)}
                              onRemoveReaction={(emoji) => handleRemoveReaction(message.id, emoji)}
                              onAddReaction={() => {}} // Handle via message actions
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Message Actions - positioned on right */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex items-start pt-1">
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
          <div className={`bg-white border-t border-gray-200 ${isMobileView ? 'px-3 py-2' : 'px-4 py-3'} flex-shrink-0`}>
            {currentChannel ? (
              <div className="space-y-3">
                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                
                {/* Message Composer with native-style border */}
                <div className="border border-gray-300 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                  <RichTextEditor
                    value={newMessage}
                    onChange={setNewMessage}
                    onSubmit={sendMessage}
                    onTyping={handleTyping}
                    placeholder={`Write to ${channels.find(c => c.id === currentChannel)?.display_name || directMessages.find(dm => dm.id === currentChannel)?.display_name || 'channel'}...`}
                    disabled={loading}
                    users={users}
                  />
                  
                  {/* Composer Bottom Bar */}
                  <div className="flex justify-between items-center px-3 py-2 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => setShowFileUpload(!showFileUpload)}
                        className={`p-1.5 hover:bg-gray-200 rounded-md transition-colors ${showFileUpload ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Attach files"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-500 hover:text-gray-700"
                        title="Add emoji"
                      >
                        <Smile className="h-4 w-4" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-500 hover:text-gray-700"
                        title="Mention someone"
                      >
                        <span className="text-sm font-bold">@</span>
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">
                        Shift+Enter for new line
                      </span>
                      <button
                        onClick={() => {
                          console.log('🖱️ Send button clicked');
                          sendMessage();
                        }}
                        disabled={(!newMessage.trim() && uploadedFiles.length === 0) || loading}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-1.5 text-sm font-medium"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3 w-3" />
                            <span>Send</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
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
                        <div key={file.id || index} className="flex items-center justify-between text-sm text-blue-600">
                          <div className="flex items-center">
                            <Paperclip className="h-3 w-3 mr-1" />
                            {file.name}
                          </div>
                          <button
                            onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700 ml-2"
                            title="Remove file"
                          >
                            ✕
                          </button>
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
      
      {/* Channel Manager Modal */}
      {showChannelManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <ChannelManager
            token={token}
            currentTeam={currentTeam}
            users={users}
            onChannelCreated={handleChannelCreated}
            onChannelDeleted={handleChannelDeleted}
            onClose={() => setShowChannelManager(false)}
          />
        </div>
      )}
      
      {/* Notification Settings Modal */}
      <NotificationSettings
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
      
    </div>
  );
}