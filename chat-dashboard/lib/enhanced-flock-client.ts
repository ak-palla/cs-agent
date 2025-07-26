/**
 * Enhanced Flock API Client
 * Supports both OAuth tokens and traditional app-based authentication
 */

import { FlockUser, FlockChannel, FlockMessage, FlockAttachment, FlockReaction, FlockTeam, SendMessageRequest, CreateChannelRequest, FlockApiResponse } from './types/flock-types';
import { flockLogger } from './logger';

/**
 * Rate limiter for API requests
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly limit: number;
  private readonly window: number;

  constructor(limit = 100, windowMs = 60000) {
    this.limit = limit;
    this.window = windowMs;
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.window);

    if (this.requests.length >= this.limit) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.window - (now - oldestRequest);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requests.push(now);
  }
}

/**
 * Enhanced Flock API Client with OAuth support
 */
export class EnhancedFlockApiClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private accessToken: string | null = null;
  private useOAuth: boolean = false;
  private rateLimiter: RateLimiter;
  private readonly baseUrl: string;

  constructor(options: {
    appId: string;
    appSecret?: string;
    accessToken?: string;
    useOAuth?: boolean;
    baseUrl?: string;
  }) {
    this.appId = options.appId;
    this.appSecret = options.appSecret || '';
    this.accessToken = options.accessToken || null;
    this.useOAuth = options.useOAuth || false;
    this.baseUrl = options.baseUrl || 'https://api.flock.com';
    this.rateLimiter = new RateLimiter();

    flockLogger.info('EnhancedFlockApiClient initialized', {
      appId: this.appId,
      useOAuth: this.useOAuth,
      hasAccessToken: !!this.accessToken,
      baseUrl: this.baseUrl
    });
  }

  /**
   * Set access token for OAuth authentication
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    this.useOAuth = true;
    flockLogger.info('Flock access token set', { tokenLength: token?.length || 0 });
  }

  /**
   * Clear access token
   */
  clearAccessToken(): void {
    this.accessToken = null;
    this.useOAuth = false;
    flockLogger.info('Flock access token cleared');
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.useOAuth ? !!this.accessToken : !!(this.appId && this.appSecret);
  }

  /**
   * Test connection to Flock API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/v1/users/me');
      return response.success;
    } catch (error) {
      flockLogger.error('Flock connection test failed', { error });
      return false;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<FlockUser | null> {
    try {
      const response = await this.makeRequest('GET', '/v1/users/me');
      return response.success ? response.data : null;
    } catch (error) {
      flockLogger.error('Error fetching current Flock user', { error });
      return null;
    }
  }

  /**
   * Get teams for authenticated user
   */
  async getTeams(): Promise<FlockTeam[]> {
    try {
      const response = await this.makeRequest('GET', '/v1/teams');
      return response.success ? response.data : [];
    } catch (error) {
      flockLogger.error('Error fetching Flock teams', { error });
      return [];
    }
  }

  /**
   * Get channels for a team
   */
  async getChannels(teamId?: string): Promise<FlockChannel[]> {
    try {
      const endpoint = teamId ? `/v1/teams/${teamId}/channels` : '/v1/channels';
      const response = await this.makeRequest('GET', endpoint);
      return response.success ? response.data : [];
    } catch (error) {
      flockLogger.error('Error fetching Flock channels', { error });
      return [];
    }
  }

  /**
   * Get users in a team or channel
   */
  async getUsers(teamId?: string, channelId?: string): Promise<FlockUser[]> {
    try {
      let endpoint = '/v1/users';
      if (channelId) {
        endpoint = `/v1/channels/${channelId}/members`;
      } else if (teamId) {
        endpoint = `/v1/teams/${teamId}/members`;
      }
      
      const response = await this.makeRequest('GET', endpoint);
      return response.success ? response.data : [];
    } catch (error) {
      flockLogger.error('Error fetching Flock users', { error });
      return [];
    }
  }

  /**
   * Get messages from a channel
   */
  async getMessages(channelId: string, options: {
    limit?: number;
    before?: string;
    after?: string;
  } = {}): Promise<FlockMessage[]> {
    try {
      const params = new URLSearchParams({
        channelId,
        limit: String(options.limit || 50)
      });
      
      if (options.before) params.append('before', options.before);
      if (options.after) params.append('after', options.after);
      
      const response = await this.makeRequest('GET', `/v1/messages?${params.toString()}`);
      
      return response.success ? response.data : [];
    } catch (error) {
      flockLogger.error('Error fetching Flock messages', { error });
      return [];
    }
  }

  /**
   * Send message
   */
  async sendMessage(request: SendMessageRequest): Promise<FlockMessage | null> {
    try {
      const response = await this.makeRequest('POST', '/v1/messages', request);
      return response.success ? response.data : null;
    } catch (error) {
      flockLogger.error('Error sending Flock message', { error });
      return null;
    }
  }

  /**
   * Create channel
   */
  async createChannel(request: CreateChannelRequest): Promise<FlockChannel | null> {
    try {
      const response = await this.makeRequest('POST', '/v1/channels', request);
      return response.success ? response.data : null;
    } catch (error) {
      flockLogger.error('Error creating Flock channel', { error });
      return null;
    }
  }

  /**
   * Upload file
   */
  async uploadFile(file: File, channelId?: string): Promise<FlockAttachment | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (channelId) {
        formData.append('channel', channelId);
      }

      const response = await this.makeRequest('POST', '/v1/files/upload', formData);
      return response.success ? response.data : null;
    } catch (error) {
      flockLogger.error('Error uploading file to Flock', { error });
      return null;
    }
  }

  /**
   * Search messages, channels, and users
   */
  async search(query: string, type: 'messages' | 'channels' | 'users' | 'all' = 'all'): Promise<{
    messages: FlockMessage[];
    channels: FlockChannel[];
    users: FlockUser[];
  }> {
    try {
      const params = new URLSearchParams({ query, type });
      const response = await this.makeRequest('GET', `/v1/search?${params.toString()}`);

      if (response.success) {
        return response.data;
      }

      return { messages: [], channels: [], users: [] };
    } catch (error) {
      flockLogger.error('Error searching Flock', { error });
      return { messages: [], channels: [], users: [] };
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any
  ): Promise<FlockApiResponse> {
    await this.rateLimiter.checkLimit();

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'CS-Agent-Dashboard/1.0'
      };

      // Add authentication based on method
      if (this.useOAuth && this.accessToken) {
        // OAuth authentication
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      } else if (this.appId && this.appSecret) {
        // App-based authentication (legacy)
        headers['X-App-Id'] = this.appId;
        headers['X-App-Secret'] = this.appSecret;
      } else {
        throw new Error('No authentication method available');
      }

      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      const url = `${this.baseUrl}${endpoint}`;
      
      flockLogger.debug('Making Flock API request', {
        method,
        endpoint,
        useOAuth: this.useOAuth,
        hasAccessToken: !!this.accessToken
      });

      const response = await fetch(url, {
        method,
        headers,
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined)
      });

      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        flockLogger.error('Flock API request failed', {
          status: response.status,
          statusText: response.statusText,
          endpoint,
          method,
          response: responseData
        });
        
        return {
          success: false,
          error: typeof responseData === 'string' ? responseData : responseData.error || 'API request failed'
        };
      }

      flockLogger.debug('Flock API request successful', {
        endpoint,
        method,
        status: response.status
      });

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      flockLogger.error('Flock API request error', {
        endpoint,
        method,
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
}

/**
 * Create Enhanced Flock client instance
 */
export function createEnhancedFlockClient(options?: {
  accessToken?: string;
  useOAuth?: boolean;
}): EnhancedFlockApiClient | null {
  const appId = process.env.NEXT_PUBLIC_FLOCK_APP_ID || '';
  const appSecret = process.env.FLOCK_APP_SECRET || '';

  if (!appId) {
    flockLogger.warn('Flock app ID not configured');
    return null;
  }

  return new EnhancedFlockApiClient({
    appId,
    appSecret,
    accessToken: options?.accessToken,
    useOAuth: options?.useOAuth || false,
  });
}

/**
 * Create Flock client from OAuth token
 */
export function createFlockClientFromOAuth(accessToken: string): EnhancedFlockApiClient | null {
  const appId = process.env.NEXT_PUBLIC_FLOCK_APP_ID || '';

  if (!appId) {
    flockLogger.warn('Flock app ID not configured');
    return null;
  }

  return new EnhancedFlockApiClient({
    appId,
    accessToken,
    useOAuth: true,
  });
}