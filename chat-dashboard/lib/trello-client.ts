/**
 * Trello API Client
 * 
 * Provides a comprehensive interface to the Trello REST API with:
 * - Authentication management (OAuth 1.0a and API key/token)
 * - Rate limiting and error handling
 * - TypeScript type safety
 * - Request/response transformation
 */

import { TrelloOAuth, createTrelloOAuth } from './trello-oauth';

// Core Trello API types
export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
  idOrganization?: string;
  prefs: {
    permissionLevel: string;
    voting: string;
    comments: string;
    invitations: string;
    selfJoin: boolean;
    cardCovers: boolean;
    background: string;
  };
  dateLastActivity: string;
  dateLastView?: string;
  shortUrl: string;
  powerUps: string[];
  members: TrelloMember[];
  lists?: TrelloList[];
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
  pos: number;
  subscribed?: boolean;
  cards?: TrelloCard[];
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  url: string;
  shortUrl: string;
  idBoard: string;
  idList: string;
  idMembers: string[];
  labels: TrelloLabel[];
  pos: number;
  due?: string;
  dueComplete: boolean;
  closed: boolean;
  dateLastActivity: string;
  badges: {
    votes: number;
    attachments: number;
    comments: number;
    checkItems: number;
    checkItemsChecked: number;
    description: boolean;
    due?: string;
    dueComplete: boolean;
  };
  attachments?: TrelloAttachment[];
  actions?: TrelloAction[];
}

export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
  initials: string;
  avatarHash?: string;
  avatarUrl?: string;
  confirmed: boolean;
  memberType: string;
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: string;
  uses?: number;
}

export interface TrelloAction {
  id: string;
  type: string;
  date: string;
  data: {
    board?: Partial<TrelloBoard>;
    list?: Partial<TrelloList>;
    card?: Partial<TrelloCard>;
    text?: string;
    old?: any;
    [key: string]: any;
  };
  idMemberCreator: string;
  memberCreator: TrelloMember;
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  bytes?: number;
  date: string;
  idMember: string;
  isUpload: boolean;
  mimeType?: string;
  previews?: Array<{
    id: string;
    url: string;
    bytes: number;
    height: number;
    width: number;
  }>;
}

export interface TrelloWebhook {
  id: string;
  description: string;
  idModel: string;
  callbackURL: string;
  active: boolean;
}

// API Request/Response types
export interface TrelloApiError {
  message: string;
  error: string;
  status: number;
}

export interface CreateBoardRequest {
  name: string;
  desc?: string;
  idOrganization?: string;
  prefs_permissionLevel?: 'private' | 'org' | 'public';
  prefs_voting?: 'disabled' | 'members' | 'observers' | 'org' | 'public';
  prefs_comments?: 'disabled' | 'members' | 'observers' | 'org' | 'public';
  prefs_invitations?: 'members' | 'admins';
  prefs_selfJoin?: boolean;
  prefs_cardCovers?: boolean;
  prefs_background?: string;
}

export interface CreateListRequest {
  name: string;
  idBoard: string;
  pos?: number | 'top' | 'bottom';
}

export interface CreateCardRequest {
  name: string;
  desc?: string;
  idList: string;
  pos?: number | 'top' | 'bottom';
  due?: string;
  idMembers?: string[];
  idLabels?: string[];
  urlSource?: string;
}

export interface UpdateCardRequest {
  name?: string;
  desc?: string;
  closed?: boolean;
  idList?: string;
  pos?: number | 'top' | 'bottom';
  due?: string;
  dueComplete?: boolean;
  idMembers?: string[];
  idLabels?: string[];
}

// Rate limiting configuration
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs: number;
}

type AuthMode = 'oauth' | 'api_key';

class TrelloApiClient {
  private apiKey?: string;
  private token?: string;
  private authMode: AuthMode;
  private trelloOAuth?: TrelloOAuth;
  private baseUrl = 'https://api.trello.com/1';
  private rateLimit: RateLimitConfig = {
    maxRequests: 100, // Conservative limit
    windowMs: 10000, // 10 seconds
    retryAfterMs: 1000 // 1 second
  };
  private requestQueue: Array<{ resolve: Function; reject: Function; request: () => Promise<any> }> = [];
  private isProcessingQueue = false;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(apiKey?: string, token?: string) {
    if (apiKey && token) {
      // API key/token mode
      this.authMode = 'api_key';
      this.apiKey = apiKey;
      this.token = token;
    } else {
      // OAuth mode
      this.authMode = 'oauth';
      try {
        this.trelloOAuth = createTrelloOAuth();
      } catch (error) {
        console.warn('OAuth not configured, falling back to API key mode');
        this.authMode = 'api_key';
      }
    }
  }

  /**
   * Rate limiting middleware
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if enough time has passed
    if (now - this.windowStart >= this.rateLimit.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // If we're at the limit, wait
    if (this.requestCount >= this.rateLimit.maxRequests) {
      const waitTime = this.rateLimit.windowMs - (now - this.windowStart);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit();
    }

    this.requestCount++;
  }

  /**
   * Queue and execute API requests with rate limiting
   */
  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, request });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { resolve, reject, request } = this.requestQueue.shift()!;
      
      try {
        await this.checkRateLimit();
        const result = await request();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Make authenticated HTTP request to Trello API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.queueRequest(async () => {
      const fullUrl = `${this.baseUrl}${endpoint}`;

      if (this.authMode === 'oauth' && this.trelloOAuth) {
        // Use OAuth authentication
        const method = (options.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE';
        const body = options.body ? JSON.parse(options.body as string) : undefined;
        
        return this.trelloOAuth.makeAuthenticatedRequest<T>(fullUrl, method, body);
      } else if (this.authMode === 'api_key' && this.apiKey && this.token) {
        // Use API key/token authentication
        const url = new URL(fullUrl);
        url.searchParams.append('key', this.apiKey);
        url.searchParams.append('token', this.token);

        const defaultHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        const response = await fetch(url.toString(), {
          ...options,
          headers: {
            ...defaultHeaders,
            ...options.headers
          }
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Use default error message if JSON parsing fails
          }

          throw new Error(errorMessage);
        }

        return response.json();
      } else {
        throw new Error('No valid authentication method configured');
      }
    });
  }

  // Board operations
  async getBoards(): Promise<TrelloBoard[]> {
    return this.makeRequest<TrelloBoard[]>('/members/me/boards?fields=all&lists=open&members=all');
  }

  async getBoard(boardId: string): Promise<TrelloBoard> {
    const board = await this.makeRequest<TrelloBoard>(`/boards/${boardId}?fields=all&lists=open&cards=open&members=all`);
    
    // The Trello API returns cards separately, so we need to organize them by list
    if (board.lists && (board as any).cards) {
      const cards = (board as any).cards as TrelloCard[];
      
      // Group cards by list ID
      const cardsByList = cards.reduce((acc, card) => {
        if (!acc[card.idList]) {
          acc[card.idList] = [];
        }
        acc[card.idList].push(card);
        return acc;
      }, {} as Record<string, TrelloCard[]>);
      
      // Assign cards to their respective lists
      board.lists = board.lists.map(list => ({
        ...list,
        cards: cardsByList[list.id] || []
      }));
    }
    
    return board;
  }

  async createBoard(data: CreateBoardRequest): Promise<TrelloBoard> {
    return this.makeRequest<TrelloBoard>('/boards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateBoard(boardId: string, data: Partial<CreateBoardRequest>): Promise<TrelloBoard> {
    return this.makeRequest<TrelloBoard>(`/boards/${boardId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.makeRequest(`/boards/${boardId}`, {
      method: 'DELETE'
    });
  }

  // List operations
  async getLists(boardId: string): Promise<TrelloList[]> {
    const lists = await this.makeRequest<TrelloList[]>(`/boards/${boardId}/lists?fields=all&cards=open`);
    
    // Get all cards for the board and organize them by list
    const allCards = await this.makeRequest<TrelloCard[]>(`/boards/${boardId}/cards?fields=all`);
    
    // Group cards by list ID
    const cardsByList = allCards.reduce((acc, card) => {
      if (!acc[card.idList]) {
        acc[card.idList] = [];
      }
      acc[card.idList].push(card);
      return acc;
    }, {} as Record<string, TrelloCard[]>);
    
    // Assign cards to their respective lists
    return lists.map(list => ({
      ...list,
      cards: cardsByList[list.id] || []
    }));
  }

  async createList(data: CreateListRequest): Promise<TrelloList> {
    return this.makeRequest<TrelloList>('/lists', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateList(listId: string, data: { name?: string; closed?: boolean; pos?: number }): Promise<TrelloList> {
    return this.makeRequest<TrelloList>(`/lists/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async archiveList(listId: string): Promise<TrelloList> {
    return this.updateList(listId, { closed: true });
  }

  // Card operations
  async getCards(listId: string): Promise<TrelloCard[]> {
    return this.makeRequest<TrelloCard[]>(`/lists/${listId}/cards?fields=all&members=true&attachments=true&actions=commentCard`);
  }

  async getCard(cardId: string): Promise<TrelloCard> {
    return this.makeRequest<TrelloCard>(`/cards/${cardId}?fields=all&members=true&attachments=true&actions=all&action_limit=50`);
  }

  async createCard(data: CreateCardRequest): Promise<TrelloCard> {
    return this.makeRequest<TrelloCard>('/cards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCard(cardId: string, data: UpdateCardRequest): Promise<TrelloCard> {
    return this.makeRequest<TrelloCard>(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCard(cardId: string): Promise<void> {
    await this.makeRequest(`/cards/${cardId}`, {
      method: 'DELETE'
    });
  }

  async addCommentToCard(cardId: string, text: string): Promise<TrelloAction> {
    return this.makeRequest<TrelloAction>(`/cards/${cardId}/actions/comments`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  }

  // Actions API
  async getBoardActions(boardId: string, options: {
    filter?: string;
    since?: string;
    before?: string;
    limit?: number;
  } = {}): Promise<TrelloAction[]> {
    const params = new URLSearchParams();
    if (options.filter) params.append('filter', options.filter);
    if (options.since) params.append('since', options.since);
    if (options.before) params.append('before', options.before);
    if (options.limit) params.append('limit', options.limit.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest<TrelloAction[]>(`/boards/${boardId}/actions${query}&memberCreator_fields=all`);
  }

  async getCardActions(cardId: string, options: {
    filter?: string;
    since?: string;
    before?: string;
    limit?: number;
  } = {}): Promise<TrelloAction[]> {
    const params = new URLSearchParams();
    if (options.filter) params.append('filter', options.filter);
    if (options.since) params.append('since', options.since);
    if (options.before) params.append('before', options.before);
    if (options.limit) params.append('limit', options.limit.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest<TrelloAction[]>(`/cards/${cardId}/actions${query}&memberCreator_fields=all`);
  }

  // Member operations
  async getCurrentMember(): Promise<TrelloMember> {
    return this.makeRequest<TrelloMember>('/members/me');
  }

  async getBoardMembers(boardId: string): Promise<TrelloMember[]> {
    return this.makeRequest<TrelloMember[]>(`/boards/${boardId}/members`);
  }

  async addMemberToBoard(boardId: string, memberId: string, type: 'normal' | 'admin' = 'normal'): Promise<void> {
    await this.makeRequest(`/boards/${boardId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ type })
    });
  }

  async removeMemberFromBoard(boardId: string, memberId: string): Promise<void> {
    await this.makeRequest(`/boards/${boardId}/members/${memberId}`, {
      method: 'DELETE'
    });
  }

  // Webhook operations
  async createWebhook(idModel: string, callbackURL: string, description: string = 'Trello Webhook'): Promise<TrelloWebhook> {
    return this.makeRequest<TrelloWebhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        idModel,
        callbackURL,
        description
      })
    });
  }

  async getWebhooks(): Promise<TrelloWebhook[]> {
    if (this.authMode === 'oauth' && this.trelloOAuth) {
      const accessToken = this.trelloOAuth.getStoredAccessToken();
      if (!accessToken) {
        throw new Error('No OAuth token available');
      }
      return this.makeRequest<TrelloWebhook[]>(`/tokens/${accessToken.oauth_token}/webhooks`);
    } else if (this.token) {
      return this.makeRequest<TrelloWebhook[]>(`/tokens/${this.token}/webhooks`);
    } else {
      throw new Error('No token available for webhook retrieval');
    }
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.makeRequest(`/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
  }

  // Search
  async search(query: string, options: {
    modelTypes?: string[];
    board_fields?: string[];
    cards_limit?: number;
    boards_limit?: number;
  } = {}): Promise<{
    cards: TrelloCard[];
    boards: TrelloBoard[];
    actions: TrelloAction[];
    members: TrelloMember[];
  }> {
    const params = new URLSearchParams();
    params.append('query', query);
    if (options.modelTypes) params.append('modelTypes', options.modelTypes.join(','));
    if (options.board_fields) params.append('board_fields', options.board_fields.join(','));
    if (options.cards_limit) params.append('cards_limit', options.cards_limit.toString());
    if (options.boards_limit) params.append('boards_limit', options.boards_limit.toString());

    return this.makeRequest(`/search?${params.toString()}`);
  }

  // Utility methods
  async testConnection(): Promise<boolean> {
    try {
      await this.getCurrentMember();
      return true;
    } catch (error) {
      console.error('Trello connection test failed:', error);
      return false;
    }
  }

  // Update authentication
  updateAuth(apiKey: string, token: string): void {
    this.authMode = 'api_key';
    this.apiKey = apiKey;
    this.token = token;
    this.trelloOAuth = undefined;
  }

  // OAuth authentication methods
  
  /**
   * Check if OAuth is configured and user is authenticated
   */
  isOAuthAuthenticated(): boolean {
    return this.authMode === 'oauth' && this.trelloOAuth ? this.trelloOAuth.isAuthenticated() : false;
  }

  /**
   * Get OAuth authentication status
   */
  getAuthStatus(): { mode: AuthMode; authenticated: boolean; user?: any } {
    if (this.authMode === 'oauth' && this.trelloOAuth) {
      return {
        mode: 'oauth',
        authenticated: this.trelloOAuth.isAuthenticated()
      };
    } else {
      return {
        mode: 'api_key',
        authenticated: !!(this.apiKey && this.token)
      };
    }
  }

  /**
   * Get current user using OAuth
   */
  async getCurrentOAuthUser() {
    if (this.authMode === 'oauth' && this.trelloOAuth) {
      return this.trelloOAuth.getCurrentUser();
    }
    throw new Error('OAuth not configured or not in OAuth mode');
  }

  /**
   * Clear OAuth authentication
   */
  clearOAuthAuth(): void {
    if (this.trelloOAuth) {
      this.trelloOAuth.clearStoredToken();
    }
  }

  /**
   * Switch to OAuth mode
   */
  switchToOAuth(): void {
    this.authMode = 'oauth';
    this.apiKey = undefined;
    this.token = undefined;
    try {
      this.trelloOAuth = createTrelloOAuth();
    } catch (error) {
      throw new Error('Failed to initialize OAuth: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

// Factory functions for different authentication modes

/**
 * Create TrelloApiClient with API key/token authentication
 */
export function createTrelloClientWithApiKey(apiKey: string, token: string): TrelloApiClient {
  return new TrelloApiClient(apiKey, token);
}

/**
 * Create TrelloApiClient with OAuth authentication
 */
export function createTrelloClientWithOAuth(): TrelloApiClient {
  return new TrelloApiClient();
}

/**
 * Create TrelloApiClient with automatic authentication detection
 */
export function createTrelloClient(apiKey?: string, token?: string): TrelloApiClient {
  if (apiKey && token) {
    return new TrelloApiClient(apiKey, token);
  } else {
    return new TrelloApiClient();
  }
}

export default TrelloApiClient; 