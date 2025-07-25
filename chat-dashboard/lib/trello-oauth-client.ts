/**
 * Browser-side Trello OAuth client
 * Uses server-side API routes for OAuth operations
 */

import trelloLogger from './trello-logger';

export interface TrelloUser {
  id: string;
  username: string;
  fullName: string;
  initials: string;
  email?: string;
  avatarHash?: string;
  avatarUrl?: string;
  confirmed: boolean;
  memberType: string;
}

export class TrelloOAuthClient {
  private baseUrl = 'https://trello.com/1';

  /**
   * Check if user is authenticated via cookies
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check for cookie-based authentication
    const cookies = document.cookie;
    return cookies.includes('trello_access_token=');
  }

  /**
   * Get stored access token - always use server-side check via API
   */
  async getStoredAccessToken() {
    if (typeof window === 'undefined') return null;
    
    try {
      const response = await fetch('/api/trello/me');
      if (response.ok) {
        return { oauth_token: 'cookie-based', oauth_token_secret: 'cookie-based' };
      }
      return null;
    } catch (error) {
      trelloLogger.error('Failed to check authentication status', { error });
      return null;
    }
  }

  /**
   * Clear stored access token - clear cookies via API
   */
  async clearStoredToken(): Promise<void> {
    try {
      await fetch('/auth/trello/logout', { method: 'POST' });
      trelloLogger.info('Trello tokens cleared via API');
    } catch (error) {
      trelloLogger.error('Error clearing tokens', { error });
    }
  }

  /**
   * Initiate OAuth login flow - redirect to server endpoint
   */
  async initiateLogin(): Promise<void> {
    try {
      trelloLogger.info('Initiating Trello OAuth login via client');
      window.location.href = '/auth/trello/login';
    } catch (error) {
      trelloLogger.error('Error initiating Trello OAuth login', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Get current user - use server endpoint
   */
  async getCurrentUser(): Promise<TrelloUser | null> {
    try {
      const response = await fetch('/api/trello/me');
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      trelloLogger.error('Error fetching current Trello user', {
        error: error instanceof Error ? error.message : error
      });
      return null;
    }
  }

  /**
   * Make authenticated request using server proxy
   */
  async makeAuthenticatedRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    try {
      const url = `/api/trello/proxy${endpoint}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      return response.json();
    } catch (error) {
      trelloLogger.error('Error making authenticated Trello request', {
        error: error instanceof Error ? error.message : error,
        endpoint,
        method
      });
      throw error;
    }
  }

  /**
   * Get user's boards via server proxy
   */
  async getUserBoards(includeClosed = false): Promise<any[]> {
    const boards = await this.makeAuthenticatedRequest('/members/me/boards?fields=all');
    return includeClosed ? boards : boards.filter((board: any) => !board.closed);
  }

  /**
   * Get user's organizations via server proxy
   */
  async getUserOrganizations(): Promise<any[]> {
    return await this.makeAuthenticatedRequest('/members/me/organizations');
  }

  /**
   * Search across Trello via server proxy
   */
  async search(query: string, options: {
    modelTypes?: string[];
    board_fields?: string[];
    cards_limit?: number;
    boards_limit?: number;
  } = {}) {
    const params = new URLSearchParams();
    params.append('query', query);
    if (options.modelTypes) params.append('modelTypes', options.modelTypes.join(','));
    if (options.board_fields) params.append('board_fields', options.board_fields.join(','));
    if (options.cards_limit) params.append('cards_limit', options.cards_limit.toString());
    if (options.boards_limit) params.append('boards_limit', options.boards_limit.toString());

    return await this.makeAuthenticatedRequest(`/search?${params.toString()}`);
  }
}

export default TrelloOAuthClient;