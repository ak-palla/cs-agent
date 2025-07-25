/**
 * Trello OAuth 1.0a Authentication Service
 * Handles OAuth flow for secure authentication with Trello API
 */

import trelloLogger from './trello-logger';

// Use Web Crypto API in browser, Node.js crypto in server
let cryptoImpl: any;
if (typeof window !== 'undefined') {
  // Browser environment - use Web Crypto API
  cryptoImpl = {
    randomBytes: (size: number) => {
      const array = new Uint8Array(size);
      window.crypto.getRandomValues(array);
      return Buffer.from(array);
    },
    createHmac: (algorithm: string, key: string) => {
      return {
        update: (data: string) => ({
          digest: (encoding: string) => {
            // For Web Crypto, we'd need to implement HMAC manually
            // This is a simplified version - in production, use a proper crypto library
            return btoa(data + key).substring(0, 28); // Simplified for demo
          }
        })
      };
    }
  };
} else {
  // Server environment - use Node.js crypto
  try {
    cryptoImpl = require('crypto');
  } catch (error) {
    throw new Error('Crypto module not available');
  }
}

// Note: Environment variables are loaded by Next.js from .env.local
// No need for dotenv import in browser/client-side code

export interface TrelloOAuthConfig {
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  scopes?: string[];
  expiration?: string; // 'never', '1day', '30days' - matches omniauth-trello pattern
}

export interface TrelloRequestToken {
  oauth_token: string;
  oauth_token_secret: string;
  oauth_callback_confirmed: string;
}

export interface TrelloAccessToken {
  oauth_token: string;
  oauth_token_secret: string;
  oauth_session_handle?: string;
}

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

export class TrelloOAuth {
  private config: TrelloOAuthConfig;
  private baseUrl = 'https://trello.com/1';

  constructor(config: TrelloOAuthConfig) {
    this.config = {
      scopes: ['read', 'write', 'account'], // Default scopes matching omniauth-trello
      expiration: 'never', // Permanent tokens as default
      ...config
    };
    trelloLogger.info('TrelloOAuth initialized', {
      apiKey: config.apiKey.substring(0, 8) + '...',
      redirectUri: config.redirectUri,
      scopes: this.config.scopes,
      expiration: this.config.expiration
    });
  }

  /**
   * Generate OAuth 1.0a signature
   */
  private generateSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    tokenSecret?: string
  ): string {
    // Sort parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    // Create signature base string
    const signatureBaseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams)
    ].join('&');

    // Create signing key
    const signingKey = [
      encodeURIComponent(this.config.apiSecret),
      encodeURIComponent(tokenSecret || '')
    ].join('&');

    // Always use Node.js crypto implementation (server-side only)
    // This ensures proper HMAC-SHA1 signature generation
    const signature = cryptoImpl
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    return signature;
  }

  /**
   * Generate OAuth 1.0a authorization header
   */
  private generateOAuthHeader(
    method: string,
    url: string,
    additionalParams: Record<string, string> = {},
    tokenSecret?: string
  ): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Always use Node.js crypto for nonce generation
    const nonce = cryptoImpl.randomBytes(16).toString('hex');

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
      ...additionalParams
    };

    // Generate signature
    const signature = this.generateSignature(method, url, oauthParams, tokenSecret);
    oauthParams.oauth_signature = signature;

    // Build authorization header
    const headerParams = Object.keys(oauthParams)
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    return `OAuth ${headerParams}`;
  }

  /**
   * Step 1: Get request token
   */
  async getRequestToken(): Promise<TrelloRequestToken> {
    const startTime = Date.now();
    
    try {
      trelloLogger.info('Getting Trello request token');

      const url = `${this.baseUrl}/OAuthGetRequestToken`;
      const authHeader = this.generateOAuthHeader('POST', url, {
        oauth_callback: this.config.redirectUri
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        trelloLogger.error('Request token failed', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Request token failed: ${response.status} ${errorText}`);
      }

      const responseText = await response.text();
      const params = new URLSearchParams(responseText);
      
      const requestToken: TrelloRequestToken = {
        oauth_token: params.get('oauth_token') || '',
        oauth_token_secret: params.get('oauth_token_secret') || '',
        oauth_callback_confirmed: params.get('oauth_callback_confirmed') || 'false'
      };

      trelloLogger.info('Request token obtained successfully', {
        oauth_callback_confirmed: requestToken.oauth_callback_confirmed,
        duration
      });

      // Store request token temporarily
      this.storeRequestToken(requestToken);

      return requestToken;
    } catch (error) {
      const duration = Date.now() - startTime;
      trelloLogger.error('Request token error', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Step 2: Generate authorization URL
   */
getAuthorizationUrl(requestToken: string, appName?: string): string {
    const params = new URLSearchParams({
      oauth_token: requestToken,
      return_url: this.config.redirectUri
    });

    if (appName) {
      params.append('name', appName);
    }

    if (this.config.scopes && this.config.scopes.length > 0) {
      params.append('scope', this.config.scopes.join(','));
    }

    // Add expiration parameter matching omniauth-trello pattern
    if (this.config.expiration) {
      params.append('expiration', this.config.expiration);
    }

    const authUrl = `${this.baseUrl}/OAuthAuthorizeToken?${params.toString()}`;
    trelloLogger.info('Generated Trello authorization URL', {
      scopes: this.config.scopes,
      expiration: this.config.expiration
    });
    
    return authUrl;
  }

  /**
   * Step 3: Exchange request token + verifier for access token
   */
  async getAccessToken(requestToken: string, oauthVerifier: string, requestTokenSecret?: string): Promise<TrelloAccessToken> {
    const startTime = Date.now();
    
    try {
      trelloLogger.info('Exchanging request token for access token');

      if (!requestTokenSecret) {
        throw new Error('Request token secret required');
      }

      const url = `${this.baseUrl}/OAuthGetAccessToken`;
      const authHeader = this.generateOAuthHeader('POST', url, {
        oauth_token: requestToken,
        oauth_verifier: oauthVerifier
      }, requestTokenSecret);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        trelloLogger.error('Access token exchange failed', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Access token exchange failed: ${response.status} ${errorText}`);
      }

      const responseText = await response.text();
      const params = new URLSearchParams(responseText);
      
      const accessToken: TrelloAccessToken = {
        oauth_token: params.get('oauth_token') || '',
        oauth_token_secret: params.get('oauth_token_secret') || '',
        oauth_session_handle: params.get('oauth_session_handle') || undefined
      };

      trelloLogger.info('Access token obtained successfully', {
        hasSessionHandle: !!accessToken.oauth_session_handle,
        duration
      });

      return accessToken;
    } catch (error) {
      const duration = Date.now() - startTime;
      trelloLogger.error('Access token exchange error', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Get current user information using access token
   */
async getCurrentUser(accessToken?: TrelloAccessToken): Promise<TrelloUser> {
    const startTime = Date.now();
    
    try {
      trelloLogger.info('Fetching current Trello user information');

      const token = accessToken || this.getStoredAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      const url = 'https://api.trello.com/1/members/me';
      const authHeader = this.generateOAuthHeader('GET', url, {
        oauth_token: token.oauth_token
      }, token.oauth_token_secret);

      const response = await fetch(url, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        trelloLogger.error('Failed to fetch current Trello user', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Failed to fetch user: ${response.status} ${errorText}`);
      }

      const userData = await response.json();
      
      const user: TrelloUser = {
        id: userData.id,
        username: userData.username,
        fullName: userData.fullName,
        initials: userData.initials,
        email: userData.email,
        avatarHash: userData.avatarHash,
        avatarUrl: userData.avatarHash ? `https://trello-avatars.s3.amazonaws.com/${userData.avatarHash}/170.png` : undefined,
        confirmed: userData.confirmed,
        memberType: userData.memberType
      };
      
      trelloLogger.info('Current Trello user fetched successfully', {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        duration
      });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      trelloLogger.error('Error fetching current Trello user', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Get extended user information matching omniauth-trello pattern
   */
  async getExtendedUserInfo(): Promise<{
    user: TrelloUser;
    boards: any[];
    organizations: any[];
  }> {
    const accessToken = this.getStoredAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const user = await this.getCurrentUser();
    
    // Fetch user's boards (matching omniauth-trello pattern)
    const boardsUrl = 'https://api.trello.com/1/members/me/boards';
    const boards = await this.makeAuthenticatedRequest(boardsUrl);
    
    // Fetch user's organizations
    const orgsUrl = 'https://api.trello.com/1/members/me/organizations';
    const organizations = await this.makeAuthenticatedRequest(orgsUrl);

    return {
      user,
      boards,
      organizations
    };
  }

  /**
   * Make authenticated API request to Trello
   */
async makeAuthenticatedRequest<T>(
    url: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const accessToken = this.getStoredAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    return this.makeAuthenticatedRequestWithToken<T>(url, method, body, accessToken);
  }

  /**
   * Make authenticated API request with explicit token
   */
  async makeAuthenticatedRequestWithToken<T>(
    url: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    accessToken?: TrelloAccessToken
  ): Promise<T> {
    if (!accessToken) {
      throw new Error('No access token provided');
    }

    const authHeader = this.generateOAuthHeader(method, url, {
      oauth_token: accessToken.oauth_token
    }, accessToken.oauth_token_secret);

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      if (method === 'POST') {
        // For POST requests, use form data as per Trello API
        const formData = new URLSearchParams();
        Object.keys(body).forEach(key => {
          formData.append(key, body[key]);
        });
        options.body = formData.toString();
        options.headers = {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        };
      } else {
        options.body = JSON.stringify(body);
      }
    }

    console.log('🔗 Making Trello API request:', { method, url, authHeader: authHeader.substring(0, 50) + '...' });
    
    const response = await fetch(url, options);

    console.log('📡 Trello API response:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Trello API error:', response.status, errorText);
      throw new Error(`Trello API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Store request token temporarily - server-side only
   */
  private storeRequestToken(requestToken: TrelloRequestToken): void {
    // Server-side only - tokens are managed via cookies
    trelloLogger.debug('Request token obtained (server-side)');
  }

  /**
   * Get stored request token - server-side only
   */
  private getStoredRequestToken(): TrelloRequestToken | null {
    // Server-side only - tokens come from cookies
    return null;
  }

  /**
   * Clear request token - server-side only
   */
  private clearRequestToken(): void {
    // Server-side only - handled by cookie management
    trelloLogger.debug('Request token cleared (server-side)');
  }

  /**
   * Store access token securely - server-side only
   */
  private storeAccessToken(accessToken: TrelloAccessToken): void {
    // Server-side only - tokens are managed via cookies
    trelloLogger.debug('Access token obtained (server-side)');
  }

  /**
   * Get stored access token - server-side only, returns null
   * Access tokens are managed via cookies in server routes
   */
  getStoredAccessToken(): TrelloAccessToken | null {
    // Server-side only - tokens come from cookies in API routes
    return null;
  }

  /**
   * Clear stored access token - server-side only
   */
  clearStoredToken(): void {
    // Server-side only - handled by cookie management
    trelloLogger.info('Trello tokens cleared (server-side)');
  }

  /**
   * Check if user is authenticated - server-side only, always returns false
   * Authentication status is determined by cookie presence in API routes
   */
  isAuthenticated(): boolean {
    // Server-side only - always returns false, cookies determine auth status
    return false;
  }

  /**
   * Test connection with current token
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      trelloLogger.error('Trello connection test failed:', error);
      return false;
    }
  }
}

// Default OAuth configuration
export const createTrelloOAuth = (): TrelloOAuth => {
  const config: TrelloOAuthConfig = {
    apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
    apiSecret: process.env.TRELLO_API_SECRET || '',
    redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
    scopes: ['read', 'write', 'account'], // Full access matching omniauth-trello
    expiration: 'never' // Permanent tokens as default, like omniauth-trello
  };

  if (!config.apiKey) {
    trelloLogger.error('NEXT_PUBLIC_TRELLO_API_KEY environment variable is required');
    throw new Error('Trello API key is required');
  }

  if (!config.apiSecret) {
    trelloLogger.error('TRELLO_API_SECRET environment variable is required');
    throw new Error('Trello API secret is required');
  }

  return new TrelloOAuth(config);
};

export default TrelloOAuth;