/**
 * Flock API Data Types
 * 
 * TypeScript interfaces for Flock messaging platform integration
 * Updated for FlockOS API compatibility
 */

// Core Flock Data Types
export interface FlockUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
  timezone?: string;
  role?: string;
  status?: 'AVAILABLE' | 'BUSY' | 'AWAY' | 'OFFLINE';
}

export interface FlockChannel {
  id: string;
  name: string;
  type: 'CHANNEL' | 'DIRECT' | 'GROUP';
  description?: string;
  memberCount?: number;
  isPrivate?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlockMessage {
  id: string;
  text: string;
  html?: string;
  channelId: string;
  userId: string;
  user?: FlockUser;
  createdAt: string;
  updatedAt?: string;
  attachments?: FlockAttachment[];
  reactions?: FlockReaction[];
  threadId?: string;
  isEdited?: boolean;
}

export interface FlockAttachment {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LINK';
  url: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

export interface FlockReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface FlockTeam {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  logoUrl?: string;
  memberCount?: number;
}

// API Request/Response Types
export interface SendMessageRequest {
  to: string; // channel ID or user ID
  text: string;
  html?: string;
  attachments?: string[]; // attachment IDs
  threadId?: string;
}

export interface CreateChannelRequest {
  name: string;
  description?: string;
  type?: 'CHANNEL' | 'GROUP';
  isPrivate?: boolean;
  members?: string[]; // user IDs
}

export interface FlockApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
} 