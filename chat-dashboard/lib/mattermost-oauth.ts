/**
 * Mattermost OAuth 2.0 Authentication Service
 * Handles OAuth flow for secure authentication
 */

import { mattermostLogger } from './logger';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  serverUrl: string;
  redirectUri: string;
  scopes?: string[];
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface MattermostUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string;
  position: string;
  roles: string;
  locale: string;
}

export class MattermostOAuth {
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
    mattermostLogger.info('MattermostOAuth initialized', {
      serverUrl: config.serverUrl,
      clientId: config.clientId,
      redirectUri: config.redirectUri
    });
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes?.join(' ') || 'read_user read_channel read_team',
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `${this.config.serverUrl}/oauth/authorize?${params.toString()}`;
    mattermostLogger.info('Generated OAuth authorization URL', { authUrl: authUrl.replace(this.config.clientId, '***CLIENT_ID***') });
    
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state?: string): Promise<OAuthTokenResponse> {
    const startTime = Date.now();
    
    try {
      mattermostLogger.info('Exchanging authorization code for token', { code: code.substring(0, 8) + '...' });

      const tokenUrl = `${this.config.serverUrl}/oauth/access_token`;
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: this.config.redirectUri,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: params.toString(),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        mattermostLogger.error('OAuth token exchange failed', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData: OAuthTokenResponse = await response.json();
      
      mattermostLogger.info('OAuth token exchange successful', {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        hasRefreshToken: !!tokenData.refresh_token,
        duration
      });

      // Store token securely (in real app, use secure storage)
      this.storeToken(tokenData);

      return tokenData;
    } catch (error) {
      const duration = Date.now() - startTime;
      mattermostLogger.error('OAuth token exchange error', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Get current user information using access token
   */
  async getCurrentUser(accessToken: string): Promise<MattermostUser> {
    const startTime = Date.now();
    
    try {
      mattermostLogger.info('Fetching current user information');

      const response = await fetch(`${this.config.serverUrl}/api/v4/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        mattermostLogger.error('Failed to fetch current user', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Failed to fetch user: ${response.status} ${errorText}`);
      }

      const user: MattermostUser = await response.json();
      
      mattermostLogger.info('Current user fetched successfully', {
        userId: user.id,
        username: user.username,
        email: user.email,
        duration
      });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      mattermostLogger.error('Error fetching current user', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const startTime = Date.now();
    
    try {
      mattermostLogger.info('Refreshing access token');

      const tokenUrl = `${this.config.serverUrl}/oauth/access_token`;
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: params.toString(),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        mattermostLogger.error('Token refresh failed', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData: OAuthTokenResponse = await response.json();
      
      mattermostLogger.info('Token refresh successful', {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        duration
      });

      // Update stored token
      this.storeToken(tokenData);

      return tokenData;
    } catch (error) {
      const duration = Date.now() - startTime;
      mattermostLogger.error('Token refresh error', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Store token securely (localStorage for demo, use secure storage in production)
   */
  private storeToken(tokenData: OAuthTokenResponse): void {
    if (typeof window !== 'undefined') {
      const tokenInfo = {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
      };

      localStorage.setItem('mattermost_oauth_token', JSON.stringify(tokenInfo));
      mattermostLogger.debug('Token stored in localStorage');
    }
  }

  /**
   * Get stored token
   */
  getStoredToken(): OAuthTokenResponse | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mattermost_oauth_token');
      if (stored) {
        try {
          const tokenInfo = JSON.parse(stored);
          
          // Check if token is expired
          if (tokenInfo.expires_at && Date.now() > tokenInfo.expires_at) {
            mattermostLogger.warn('Stored token is expired');
            this.clearStoredToken();
            return null;
          }

          return tokenInfo;
        } catch (error) {
          mattermostLogger.error('Failed to parse stored token', { error });
          this.clearStoredToken();
        }
      }
    }
    return null;
  }

  /**
   * Clear stored token
   */
  clearStoredToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mattermost_oauth_token');
      mattermostLogger.info('Stored token cleared');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    return token !== null;
  }

  /**
   * Generate a random state parameter for OAuth security
   */
  generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

// Default OAuth configuration
export const createMattermostOAuth = (): MattermostOAuth => {
  const config: OAuthConfig = {
    clientId: process.env.NEXT_PUBLIC_MATTERMOST_CLIENT_ID || '',
    clientSecret: process.env.MATTERMOST_CLIENT_SECRET || '',
    serverUrl: process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co',
    redirectUri: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || `${typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000'}/auth/mattermost/callback`,
    scopes: ['read_user', 'read_channel', 'read_team', 'read_post', 'write_post'],
  };

  if (!config.clientId) {
    mattermostLogger.error('NEXT_PUBLIC_MATTERMOST_CLIENT_ID environment variable is required');
    throw new Error('Mattermost OAuth client ID is required');
  }

  return new MattermostOAuth(config);
};

export default MattermostOAuth;