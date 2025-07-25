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

interface TrelloUser {
  id: string;
  fullName: string;
  username: string;
  initials: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  list?: {
    id: string;
    name: string;
  };
}

interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
}

// Cache for resolved names to avoid repeated API calls
const userCache = new Map<string, User>();
const channelCache = new Map<string, Channel>();
const trelloUserCache = new Map<string, TrelloUser>();
const trelloCardCache = new Map<string, TrelloCard>();
const trelloBoardCache = new Map<string, TrelloBoard>();

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
  
  // Check if this is a Trello activity first
  if (data.action_type) {
    const description = getTrelloActivityDescription(data);
    // Apply maxLength limit to Trello descriptions too
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength - 3) + '...';
  }
  
  // Try different possible message fields for Mattermost
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
    // Mattermost events
    message_posted: { icon: '💬', label: 'Message', color: 'text-blue-600' },
    message_updated: { icon: '✏️', label: 'Message Edited', color: 'text-yellow-600' },
    message_deleted: { icon: '🗑️', label: 'Message Deleted', color: 'text-red-600' },
    reaction_added: { icon: '❤️', label: 'Reaction', color: 'text-pink-600' },
    file_uploaded: { icon: '📎', label: 'File Upload', color: 'text-green-600' },
    user_joined: { icon: '👋', label: 'User Joined', color: 'text-green-600' },
    user_left: { icon: '👋', label: 'User Left', color: 'text-gray-600' },
    channel_created: { icon: '📢', label: 'Channel Created', color: 'text-purple-600' },
    
    // Trello events
    createCard: { icon: '📋', label: 'Card Created', color: 'text-green-600' },
    updateCard: { icon: '📝', label: 'Card Updated', color: 'text-blue-600' },
    deleteCard: { icon: '🗑️', label: 'Card Deleted', color: 'text-red-600' },
    commentCard: { icon: '💬', label: 'Comment Added', color: 'text-blue-600' },
    addMemberToCard: { icon: '👤', label: 'Member Added', color: 'text-green-600' },
    removeMemberFromCard: { icon: '👤', label: 'Member Removed', color: 'text-orange-600' },
    addAttachmentToCard: { icon: '📎', label: 'Attachment Added', color: 'text-purple-600' },
    deleteAttachmentFromCard: { icon: '📎', label: 'Attachment Removed', color: 'text-red-600' },
    addChecklistToCard: { icon: '☑️', label: 'Checklist Added', color: 'text-green-600' },
    updateCheckItemStateOnCard: { icon: '✅', label: 'Checklist Updated', color: 'text-blue-600' },
    moveCardFromBoard: { icon: '🔄', label: 'Card Moved', color: 'text-yellow-600' },
    moveCardToBoard: { icon: '🔄', label: 'Card Moved', color: 'text-yellow-600' },
    createList: { icon: '📊', label: 'List Created', color: 'text-green-600' },
    updateList: { icon: '📊', label: 'List Updated', color: 'text-blue-600' },
    moveListFromBoard: { icon: '🔄', label: 'List Moved', color: 'text-yellow-600' },
    moveListToBoard: { icon: '🔄', label: 'List Moved', color: 'text-yellow-600' },
    updateBoard: { icon: '📋', label: 'Board Updated', color: 'text-blue-600' },
    addMemberToBoard: { icon: '👥', label: 'Member Added to Board', color: 'text-green-600' },
    removeMemberFromBoard: { icon: '👥', label: 'Member Removed from Board', color: 'text-orange-600' },
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
 * Resolve Trello user ID to human-readable display name
 */
export async function resolveTrelloUserName(userId: string): Promise<string> {
  if (!userId) return 'Unknown User';
  
  // Check cache first
  if (trelloUserCache.has(userId)) {
    const user = trelloUserCache.get(userId)!;
    return formatTrelloUserDisplayName(user);
  }

  try {
    // Fetch user data from Trello API via our proxy
    const response = await fetch(`/api/trello/members/${userId}`, {
      credentials: 'include',
    });

    if (response.ok) {
      const result = await response.json();
      const user: TrelloUser = result.data || result;
      trelloUserCache.set(userId, user);
      return formatTrelloUserDisplayName(user);
    } else {
      console.warn('Failed to resolve Trello user (status:', response.status, '):', userId);
    }
  } catch (error) {
    console.warn('Failed to resolve Trello user:', userId, error);
  }

  // Fallback to shortened ID
  return `User-${userId.slice(-8)}`;
}

/**
 * Format Trello user display name from user object
 */
function formatTrelloUserDisplayName(user: TrelloUser): string {
  if (user.fullName) return user.fullName;
  if (user.username) return `@${user.username}`;
  return user.initials || 'Unknown User';
}

/**
 * Resolve Trello card ID to human-readable display name
 */
export async function resolveTrelloCardName(cardId: string): Promise<string> {
  if (!cardId) return 'Unknown Card';
  
  // Check cache first
  if (trelloCardCache.has(cardId)) {
    const card = trelloCardCache.get(cardId)!;
    return formatTrelloCardDisplayName(card);
  }

  try {
    // Fetch card data from Trello API via our proxy
    const response = await fetch(`/api/trello/cards/${cardId}`, {
      credentials: 'include',
    });

    if (response.ok) {
      const result = await response.json();
      const card: TrelloCard = result.data || result;
      trelloCardCache.set(cardId, card);
      return formatTrelloCardDisplayName(card);
    } else {
      console.warn('Failed to resolve Trello card (status:', response.status, '):', cardId);
    }
  } catch (error) {
    console.warn('Failed to resolve Trello card:', cardId, error);
  }

  // Fallback to shortened ID
  return `Card-${cardId.slice(-8)}`;
}

/**
 * Format Trello card display name from card object
 */
function formatTrelloCardDisplayName(card: TrelloCard): string {
  return card.name || 'Unnamed Card';
}

/**
 * Resolve Trello board ID to human-readable display name
 */
export async function resolveTrelloBoardName(boardId: string): Promise<string> {
  if (!boardId) return 'Unknown Board';
  
  // Check cache first
  if (trelloBoardCache.has(boardId)) {
    const board = trelloBoardCache.get(boardId)!;
    return formatTrelloBoardDisplayName(board);
  }

  try {
    // Fetch board data from Trello API via our proxy
    const response = await fetch(`/api/trello/boards/${boardId}`, {
      credentials: 'include',
    });

    if (response.ok) {
      const result = await response.json();
      const board: TrelloBoard = result.data || result;
      trelloBoardCache.set(boardId, board);
      return formatTrelloBoardDisplayName(board);
    } else {
      console.warn('Failed to resolve Trello board (status:', response.status, '):', boardId);
    }
  } catch (error) {
    console.warn('Failed to resolve Trello board:', boardId, error);
  }

  // Fallback to shortened ID
  return `Board-${boardId.slice(-8)}`;
}

/**
 * Format Trello board display name from board object
 */
function formatTrelloBoardDisplayName(board: TrelloBoard): string {
  return board.name || 'Unnamed Board';
}

/**
 * Get enhanced message preview for Trello activities
 */
export function getTrelloActivityDescription(data: any): string {
  if (!data) return '';
  
  const actionData = data.action_data;
  const actionType = data.action_type;
  const cardName = data.card_name || actionData?.card?.name || '';
  const listName = data.list_name || '';
  const memberName = data.member_name || '';
  
  // Build context-aware descriptions based on action type
  switch (actionType) {
    case 'updateCard':
      const changes = [];
      if (actionData?.old?.name && actionData?.card?.name) {
        changes.push(`renamed to "${actionData.card.name}"`);
      }
      if (actionData?.listBefore && actionData?.listAfter) {
        changes.push(`moved from "${actionData.listBefore.name}" to "${actionData.listAfter.name}"`);
      }
      if (actionData?.old?.desc !== undefined && actionData?.card?.desc !== undefined) {
        changes.push('updated description');
      }
      if (actionData?.old?.due !== undefined && actionData?.card?.due !== undefined) {
        const dueDate = actionData.card.due ? new Date(actionData.card.due).toLocaleDateString() : 'removed';
        changes.push(`due date set to ${dueDate}`);
      }
      if (actionData?.old?.closed !== undefined && actionData?.card?.closed !== undefined) {
        changes.push(actionData.card.closed ? 'archived' : 'unarchived');
      }
      
      // If we have card name, include it in the description
      const cardRef = cardName ? ` card "${cardName}"` : ' card';
      const changeText = changes.length > 0 ? changes.join(', ') : 'updated';
      return `${changeText}${cardRef}`;
      
    case 'createCard':
      const createListName = listName || actionData?.list?.name || '';
      const cardRef2 = cardName ? ` "${cardName}"` : '';
      return createListName ? `created${cardRef2} in "${createListName}"` : `created${cardRef2}`;
      
    case 'commentCard':
      const commentText = data.text || actionData?.text || '';
      const preview = commentText.length > 50 ? commentText.substring(0, 50) + '...' : commentText;
      const cardRef3 = cardName ? ` on "${cardName}"` : '';
      return preview ? `commented${cardRef3}: "${preview}"` : `added comment${cardRef3}`;
      
    case 'addMemberToCard':
    case 'removeMemberFromCard':
      const memberNameToUse = actionData?.member?.fullName || actionData?.member?.username || memberName || 'member';
      const cardRef4 = cardName ? ` to "${cardName}"` : '';
      return actionType === 'addMemberToCard' 
        ? `added ${memberNameToUse}${cardRef4}` 
        : `removed ${memberNameToUse}${cardRef4}`;
      
    case 'addAttachmentToCard':
      const attachmentName = actionData?.attachment?.name || 'file';
      const cardRef5 = cardName ? ` to "${cardName}"` : '';
      return `attached "${attachmentName}"${cardRef5}`;
      
    case 'deleteAttachmentFromCard':
      const deletedAttachment = actionData?.attachment?.name || 'file';
      const cardRef6 = cardName ? ` from "${cardName}"` : '';
      return `removed attachment "${deletedAttachment}"${cardRef6}`;
      
    case 'addChecklistToCard':
      const checklistName = actionData?.checklist?.name || 'checklist';
      const cardRef7 = cardName ? ` to "${cardName}"` : '';
      return `added checklist "${checklistName}"${cardRef7}`;
      
    case 'updateCheckItemStateOnCard':
      const checkItem = actionData?.checkItem?.name || 'item';
      const isComplete = actionData?.checkItem?.state === 'complete';
      const cardRef8 = cardName ? ` in "${cardName}"` : '';
      return `${isComplete ? 'completed' : 'unchecked'} "${checkItem}"${cardRef8}`;
      
    case 'deleteCard':
      const cardRef9 = cardName ? ` "${cardName}"` : '';
      return `deleted${cardRef9}`;
      
    case 'copyCard':
      const cardRef10 = cardName ? ` "${cardName}"` : '';
      return `copied${cardRef10}`;
      
    case 'moveCardFromBoard':
    case 'moveCardToBoard':
      const cardRef11 = cardName ? ` "${cardName}"` : '';
      return `moved${cardRef11} between boards`;
      
    default:
      const cardRef12 = cardName ? ` "${cardName}"` : '';
      return actionType.replace(/([A-Z])/g, ' $1').toLowerCase() + cardRef12;
  }
}

/**
 * Clear caches (useful for testing or when data becomes stale)
 */
export function clearResolverCaches(): void {
  userCache.clear();
  channelCache.clear();
  trelloUserCache.clear();
  trelloCardCache.clear();
  trelloBoardCache.clear();
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