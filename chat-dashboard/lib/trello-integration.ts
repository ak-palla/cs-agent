/**
 * Complete Trello Integration Service
 * Implements patterns from omniauth-trello Ruby gem
 * https://github.com/joshrowley/omniauth-trello
 */

import { TrelloOAuth, TrelloUser, TrelloAccessToken } from './trello-oauth';
import { TrelloApiClient, createTrelloClient } from './trello-client';
import trelloLogger from './trello-logger';

export interface TrelloIntegrationConfig {
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  scopes?: string[];
  expiration?: string;
  appName?: string;
}

export interface TrelloIntegrationUser {
  user: TrelloUser;
  boards: TrelloBoard[];
  organizations: TrelloOrganization[];
  token: TrelloAccessToken;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
  idOrganization?: string;
  prefs: any;
  dateLastActivity: string;
  shortUrl: string;
}

export interface TrelloOrganization {
  id: string;
  name: string;
  displayName: string;
  desc?: string;
  url: string;
  website?: string;
  logoHash?: string;
}

export class TrelloIntegration {
  private oauth: TrelloOAuth;
  private client?: TrelloApiClient;
  private config: TrelloIntegrationConfig;

  constructor(config: TrelloIntegrationConfig) {
    this.config = config;
    this.oauth = new TrelloOAuth({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      redirectUri: config.redirectUri,
      scopes: config.scopes || ['read', 'write', 'account'],
      expiration: config.expiration || 'never'
    });
    
    trelloLogger.info('TrelloIntegration initialized', {
      apiKey: config.apiKey.substring(0, 8) + '...',
      redirectUri: config.redirectUri,
      scopes: this.config.scopes,
      expiration: this.config.expiration
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.oauth.isAuthenticated();
  }

  /**
   * Get authorization URL for OAuth flow
   */
  async getAuthorizationUrl(): Promise<string> {
    const requestToken = await this.oauth.getRequestToken();
    return this.oauth.getAuthorizationUrl(
      requestToken.oauth_token,
      this.config.appName || 'Chat Dashboard'
    );
  }

  /**
   * Complete OAuth flow and get access token
   */
  async completeAuthentication(oauthToken: string, oauthVerifier: string): Promise<TrelloIntegrationUser> {
    const accessToken = await this.oauth.getAccessToken(oauthToken, oauthVerifier);
    
    // Initialize API client with OAuth
    this.client = createTrelloClient();
    
    // Get extended user info matching omniauth-trello pattern
    const userInfo = await this.oauth.getExtendedUserInfo();
    
    return {
      user: userInfo.user,
      boards: userInfo.boards,
      organizations: userInfo.organizations,
      token: accessToken
    };
  }

  /**
   * Get current authenticated user with full details
   */
  async getCurrentUser(): Promise<TrelloIntegrationUser | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      if (!this.client) {
        this.client = createTrelloClient();
      }

      const userInfo = await this.oauth.getExtendedUserInfo();
      const token = this.oauth.getStoredAccessToken();
      
      if (!token) {
        return null;
      }

      return {
        user: userInfo.user,
        boards: userInfo.boards,
        organizations: userInfo.organizations,
        token
      };
    } catch (error) {
      trelloLogger.error('Failed to get current user', { error });
      return null;
    }
  }

  /**
   * Get user's boards with full details
   */
  async getUserBoards(includeClosed = false): Promise<TrelloBoard[]> {
    if (!this.client || !this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const boards = await this.client.getBoards();
      return includeClosed ? boards : boards.filter(board => !board.closed);
    } catch (error) {
      trelloLogger.error('Failed to get user boards', { error });
      throw error;
    }
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(): Promise<TrelloOrganization[]> {
    if (!this.client || !this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const organizations = await this.oauth.makeAuthenticatedRequest<TrelloOrganization[]>(
        'https://api.trello.com/1/members/me/organizations'
      );
      return organizations;
    } catch (error) {
      trelloLogger.error('Failed to get user organizations', { error });
      throw error;
    }
  }

  /**
   * Create a new board
   */
  async createBoard(name: string, description?: string, organizationId?: string): Promise<TrelloBoard> {
    if (!this.client || !this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const board = await this.client.createBoard({
        name,
        desc: description || '',
        idOrganization: organizationId,
        prefs_permissionLevel: 'private'
      });
      
      trelloLogger.info('Board created', { boardId: board.id, name });
      return board;
    } catch (error) {
      trelloLogger.error('Failed to create board', { error, name });
      throw error;
    }
  }

  /**
   * Search across Trello
   */
  async search(query: string, options: {
    modelTypes?: string[];
    board_fields?: string[];
    cards_limit?: number;
    boards_limit?: number;
  } = {}) {
    if (!this.client || !this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      return await this.client.search(query, options);
    } catch (error) {
      trelloLogger.error('Search failed', { error, query });
      throw error;
    }
  }

  /**
   * Logout and clear authentication
   */
  async logout(): Promise<void> {
    this.oauth.clearStoredToken();
    this.client = undefined;
    trelloLogger.info('User logged out from Trello');
  }

  /**
   * Test connection with current token
   */
  async testConnection(): Promise<boolean> {
    return this.oauth.testConnection();
  }

  /**
   * Get authentication status
   */
  getAuthStatus() {
    return {
      authenticated: this.isAuthenticated(),
      token: this.oauth.getStoredAccessToken(),
      config: {
        apiKey: this.config.apiKey,
        redirectUri: this.config.redirectUri,
        scopes: this.config.scopes,
        expiration: this.config.expiration
      }
    };
  }
}

/**
 * Create Trello integration with environment variables
 */
export function createTrelloIntegration(): TrelloIntegration {
  const config: TrelloIntegrationConfig = {
    apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
    apiSecret: process.env.TRELLO_API_SECRET || '',
    redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || `${typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000'}/auth/trello/callback`,
    scopes: ['read', 'write', 'account'],
    expiration: 'never',
    appName: 'Chat Dashboard'
  };

  if (!config.apiKey) {
    trelloLogger.error('NEXT_PUBLIC_TRELLO_API_KEY environment variable is required');
    throw new Error('Trello API key is required');
  }

  if (!config.apiSecret) {
    trelloLogger.error('TRELLO_API_SECRET environment variable is required');
    throw new Error('Trello API secret is required');
  }

  return new TrelloIntegration(config);
}

export default TrelloIntegration;