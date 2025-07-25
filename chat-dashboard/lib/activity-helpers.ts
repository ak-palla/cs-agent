/**
 * Activity Helper Utilities
 * Functions to resolve IDs to human-readable names and format activity data
 */

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  nickname: string;
}

interface Channel {
  id: string;
  name: string;
  display_name: string;
  type: string;
}

// Cache for resolved names to avoid repeated API calls
const userCache = new Map<string, User>();
const channelCache = new Map<string, Channel>();

/**
 * Resolve user ID to human-readable display name
 */
export async function resolveUserName(userId: string): Promise<string> {
  if (!userId) return 'Unknown User';
  
  // Check cache first
  if (userCache.has(userId)) {
    const user = userCache.get(userId)!;
    return formatUserDisplayName(user);
  }

  // Check if we have a token - if not, return fallback immediately
  const token = localStorage.getItem('mattermost_token');
  if (!token) {
    console.warn('No Mattermost token available for user resolution');
    return `User-${userId.slice(-8)}`;
  }

  try {
    // Fetch user data from API
    const response = await fetch(`/api/mattermost/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const user: User = await response.json();
      userCache.set(userId, user);
      return formatUserDisplayName(user);
    } else if (response.status === 401) {
      console.warn('Authentication failed when resolving user:', userId);
      return `User-${userId.slice(-8)} (auth failed)`;
    } else {
      console.warn('Failed to resolve user (status:', response.status, '):', userId);
    }
  } catch (error) {
    console.warn('Failed to resolve user:', userId, error);
  }

  // Improved fallback to shortened ID with better formatting
  return `User-${userId.slice(-8)}`;
}

/**
 * Format user display name from user object
 */
function formatUserDisplayName(user: User): string {
  if (user.nickname) return user.nickname;
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.first_name) return user.first_name;
  return user.username || 'Unknown User';
}

/**
 * Resolve channel ID to human-readable display name
 */
export async function resolveChannelName(channelId: string): Promise<string> {
  if (!channelId) return 'Unknown Channel';
  
  // Check cache first
  if (channelCache.has(channelId)) {
    const channel = channelCache.get(channelId)!;
    return formatChannelDisplayName(channel);
  }

  // Check if we have a token - if not, return fallback immediately
  const token = localStorage.getItem('mattermost_token');
  if (!token) {
    console.warn('No Mattermost token available for channel resolution');
    return `#${channelId.slice(-8)}`;
  }

  try {
    // Fetch channel data from API
    const response = await fetch(`/api/mattermost/channels/${channelId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const channel: Channel = await response.json();
      channelCache.set(channelId, channel);
      return formatChannelDisplayName(channel);
    } else if (response.status === 401) {
      console.warn('Authentication failed when resolving channel:', channelId);
      return `#${channelId.slice(-8)} (auth failed)`;
    } else {
      console.warn('Failed to resolve channel (status:', response.status, '):', channelId);
    }
  } catch (error) {
    console.warn('Failed to resolve channel:', channelId, error);
  }

  // Improved fallback to shortened ID with better formatting
  return `#${channelId.slice(-8)}`;
}

/**
 * Format channel display name from channel object
 */
function formatChannelDisplayName(channel: Channel): string {
  if (channel.display_name) return channel.display_name;
  if (channel.name) return `#${channel.name}`;
  return 'Unknown Channel';
}

/**
 * Extract and format message preview from activity data
 */
export function getMessagePreview(data: any, maxLength: number = 100): string {
  if (!data) return '';
  
  // Try different possible message fields
  let message = data.message || data.text || data.content || '';
  
  // For system messages, try to extract meaningful content
  if (!message && data.props) {
    if (data.props.username) {
      message = `User ${data.props.username} joined the channel`;
    } else if (data.props.old_displayname && data.props.new_displayname) {
      message = `Display name changed from ${data.props.old_displayname} to ${data.props.new_displayname}`;
    }
  }
  
  // For webhook messages, try to get the message content
  if (!message && data.webhook_display_name) {
    message = `Webhook message from ${data.webhook_display_name}`;
  }
  
  if (!message) {
    // If still no message, try to create a meaningful preview from the event data
    if (data.post_id) return 'Message activity';
    if (data.file_ids && data.file_ids.length > 0) return `${data.file_ids.length} file(s) shared`;
    return '';
  }
  
  // Convert to string and clean up the message (remove markdown, extra whitespace)
  const cleaned = String(message)
    .replace(/[*_`~]/g, '') // Remove markdown formatting
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
  
  if (cleaned.length <= maxLength) return cleaned;
  
  return cleaned.substring(0, maxLength - 3) + '...';
}

/**
 * Format timestamp to relative time
 */
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  // For older dates, show actual date
  return time.toLocaleDateString();
}

/**
 * Get event type display information
 */
export function getEventTypeInfo(eventType: string): {
  icon: string;
  label: string;
  color: string;
} {
  const eventTypes: Record<string, { icon: string; label: string; color: string }> = {
    message_posted: { icon: '💬', label: 'Message', color: 'text-blue-600' },
    message_updated: { icon: '✏️', label: 'Message Edited', color: 'text-yellow-600' },
    message_deleted: { icon: '🗑️', label: 'Message Deleted', color: 'text-red-600' },
    reaction_added: { icon: '❤️', label: 'Reaction', color: 'text-pink-600' },
    file_uploaded: { icon: '📎', label: 'File Upload', color: 'text-green-600' },
    user_joined: { icon: '👋', label: 'User Joined', color: 'text-green-600' },
    user_left: { icon: '👋', label: 'User Left', color: 'text-gray-600' },
    channel_created: { icon: '📢', label: 'Channel Created', color: 'text-purple-600' },
  };
  
  return eventTypes[eventType] || { 
    icon: '📝', 
    label: eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
    color: 'text-gray-600' 
  };
}

/**
 * Get platform display information
 */
export function getPlatformInfo(platform: string): {
  icon: string;
  color: string;
  bgColor: string;
} {
  const platforms: Record<string, { icon: string; color: string; bgColor: string }> = {
    mattermost: { icon: '💬', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    trello: { icon: '📋', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    flock: { icon: '🐦', color: 'text-green-600', bgColor: 'bg-green-100' },
  };
  
  return platforms[platform] || { 
    icon: '📝', 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-100' 
  };
}

/**
 * Clear caches (useful for testing or when data becomes stale)
 */
export function clearResolverCaches(): void {
  userCache.clear();
  channelCache.clear();
}

/**
 * Check if Mattermost authentication is available
 */
export function isAuthenticationAvailable(): boolean {
  return !!localStorage.getItem('mattermost_token');
}

/**
 * Get authentication status message for display
 */
export function getAuthenticationStatus(): { available: boolean; message: string } {
  const token = localStorage.getItem('mattermost_token');
  if (token) {
    return { available: true, message: 'Mattermost authentication available' };
  } else {
    return { 
      available: false, 
      message: 'No Mattermost token found. User and channel names will show as IDs. To see real names, authenticate with Mattermost first.' 
    };
  }
}

/**
 * Preload user and channel data into cache
 */
export async function preloadUserAndChannelData(): Promise<void> {
  const token = localStorage.getItem('mattermost_token');
  if (!token) {
    console.info('No Mattermost token available - skipping user/channel data preload');
    return;
  }

  try {
    // Fetch users and channels in parallel
    const [usersResponse, channelsResponse] = await Promise.all([
      fetch('/api/mattermost/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
      fetch('/api/mattermost/channels', {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
    ]);

    if (usersResponse.ok) {
      const users: User[] = await usersResponse.json();
      users.forEach(user => userCache.set(user.id, user));
      console.log(`Preloaded ${users.length} users into cache`);
    }

    if (channelsResponse.ok) {
      const channels: Channel[] = await channelsResponse.json();
      channels.forEach(channel => channelCache.set(channel.id, channel));
      console.log(`Preloaded ${channels.length} channels into cache`);
    }
  } catch (error) {
    console.warn('Failed to preload user/channel data:', error);
  }
}