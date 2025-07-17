// FlockOS API Client - Updated for correct Flock authentication
import { FlockUser, FlockChannel, FlockMessage, FlockAttachment, FlockReaction, FlockTeam, SendMessageRequest, CreateChannelRequest, FlockApiResponse } from './types/flock-types';

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
 * FlockOS API Client
 * Uses FlockOS API endpoints and token-based authentication
 */
export default class FlockApiClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private accessToken: string | null = null;
  private rateLimiter: RateLimiter;
  private readonly baseUrl = '/api/flock';

  constructor(appId: string, appSecret: string = '') {
    this.appId = appId;
    this.appSecret = appSecret;
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Set access token for API requests
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Generate App Install URL for FlockOS
   * This is used instead of OAuth for Flock apps
   */
  generateInstallUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      appId: this.appId,
      redirect_uri: redirectUri
    });

    return `https://web.flock.com/apps/install?${params.toString()}`;
  }

  /**
   * Test connection to FlockOS API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/me');
      return response.success;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<FlockUser | null> {
    try {
      const response = await this.makeRequest('GET', '/me');
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }

  /**
   * Get teams for authenticated user
   */
  async getTeams(): Promise<FlockTeam[]> {
    try {
      const response = await this.makeRequest('GET', '/teams');
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  }

  /**
   * Get channels for a team
   */
  async getChannels(teamId?: string): Promise<FlockChannel[]> {
    try {
      const endpoint = teamId ? `/teams/${teamId}/channels` : '/channels';
      const response = await this.makeRequest('GET', endpoint);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching channels:', error);
      return [];
    }
  }

  /**
   * Get users in a team or channel
   */
  async getUsers(teamId?: string, channelId?: string): Promise<FlockUser[]> {
    try {
      let endpoint = '/users';
      if (channelId) {
        endpoint = `/channels/${channelId}/members`;
      } else if (teamId) {
        endpoint = `/teams/${teamId}/members`;
      }
      
      const response = await this.makeRequest('GET', endpoint);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching users:', error);
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
      
      const response = await this.makeRequest('GET', `/messages?${params.toString()}`);
      
      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  /**
   * Send message
   */
  async sendMessage(request: SendMessageRequest): Promise<FlockMessage | null> {
    try {
      const response = await this.makeRequest('POST', '/messages', request);

      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  /**
   * Create channel
   */
  async createChannel(request: CreateChannelRequest): Promise<FlockChannel | null> {
    try {
      const response = await this.makeRequest('POST', '/channels', request);

      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error creating channel:', error);
      return null;
    }
  }

  /**
   * Upload file using FlockOS files.upload method
   */
  async uploadFile(file: File, channelId?: string): Promise<FlockAttachment | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (channelId) {
        formData.append('channel', channelId);
      }

      const response = await this.makeRequest('POST', '/files/upload', formData);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error uploading file:', error);
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
      const response = await this.makeRequest('GET', `/search?${params.toString()}`);

      if (response.success) {
        return response.data;
      }

      return { messages: [], channels: [], users: [] };
    } catch (error) {
      console.error('Error searching:', error);
      return { messages: [], channels: [], users: [] };
    }
  }



  /**
   * Make direct HTTP request to FlockOS API
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

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
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
        console.error(`FlockOS API Error ${response.status}:`, responseData);
        return {
          success: false,
          error: typeof responseData === 'string' ? responseData : responseData.error || 'API request failed'
        };
      }

      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      console.error('FlockOS API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
}

/**
 * Utility function to create Flock client instance
 */
export function createFlockClient(): FlockApiClient | null {
  const appId = process.env.NEXT_PUBLIC_FLOCK_APP_ID;
  const appSecret = process.env.FLOCK_APP_SECRET;

  if (!appId || !appSecret) {
    console.warn('Flock credentials not configured');
    return null;
  }

  return new FlockApiClient(appId, appSecret);
} 