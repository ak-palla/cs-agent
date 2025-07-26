/**
 * Flock OAuth 2.0 Authentication Service
 * Handles OAuth flow for secure authentication with Flock API
 */

import { flockLogger } from './logger';

export interface FlockOAuthConfig {
  clientId: string;
  clientSecret: string;
  serverUrl: string;
  redirectUri: string;
  scopes?: string[];
}

export interface FlockOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface FlockUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string;
  timezone: string;
  locale: string;
}

export class FlockOAuth {
  private config: FlockOAuthConfig;

  constructor(config: FlockOAuthConfig) {
    this.config = config;
    flockLogger.info('FlockOAuth initialized', {
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
      scope: this.config.scopes?.join(' ') || 'chat:read chat:write',
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `${this.config.serverUrl}/oauth/v2/authorize?${params.toString()}`;
    flockLogger.info('Generated Flock OAuth authorization URL', { 
      authUrl: authUrl.replace(this.config.clientId, '***CLIENT_ID***') 
    });
    
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state?: string): Promise<FlockOAuthTokenResponse> {
    const startTime = Date.now();
    
    try {
      flockLogger.info('Exchanging authorization code for Flock token', { 
        code: code.substring(0, 8) + '...' 
      });

      const tokenUrl = `${this.config.serverUrl}/oauth/token`;
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
        flockLogger.error('Flock OAuth token exchange failed', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Flock token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData: FlockOAuthTokenResponse = await response.json();
      
      flockLogger.info('Flock OAuth token exchange successful', {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        hasRefreshToken: !!tokenData.refresh_token,
        duration
      });

      // Store token securely
      this.storeToken(tokenData);

      return tokenData;
    } catch (error) {
      const duration = Date.now() - startTime;
      flockLogger.error('Flock OAuth token exchange error', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Get current user information using access token
   */
  async getCurrentUser(accessToken: string): Promise<FlockUser> {
    const startTime = Date.now();
    
    try {
      flockLogger.info('Fetching current Flock user information');

      const response = await fetch(`${this.config.serverUrl}/v1/users.getInfo?token=${accessToken}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        flockLogger.error('Failed to fetch current Flock user', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Failed to fetch Flock user: ${response.status} ${errorText}`);
      }

      const userData = await response.json();
      
      // Handle Flock API response structure
      const userInfo = userData.data || userData;
      const user: FlockUser = {
        id: userInfo.userId || userInfo.id,
        userId: userInfo.userId || userInfo.id,
        firstName: userInfo.firstName || userInfo.name?.split(' ')[0] || 'Unknown',
        lastName: userInfo.lastName || userInfo.name?.split(' ')[1] || '',
        email: userInfo.email || '',
        profileImage: userInfo.profileImage || '',
        timezone: userInfo.timezone || 'UTC',
        locale: userInfo.locale || 'en-US',
      };
      
      flockLogger.info('Flock user fetched successfully', {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        duration
      });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      flockLogger.error('Error fetching current Flock user', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<FlockOAuthTokenResponse> {
    const startTime = Date.now();
    
    try {
      flockLogger.info('Refreshing Flock access token');

      const tokenUrl = `${this.config.serverUrl}/oauth/token`;
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
        flockLogger.error('Flock token refresh failed', {
          status: response.status,
          error: errorText,
          duration
        });
        throw new Error(`Flock token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData: FlockOAuthTokenResponse = await response.json();
      
      flockLogger.info('Flock token refresh successful', {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        duration
      });

      // Update stored token
      this.storeToken(tokenData);

      return tokenData;
    } catch (error) {
      const duration = Date.now() - startTime;
      flockLogger.error('Flock token refresh error', {
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  /**
   * Store token securely (localStorage for demo, use secure storage in production)
   */
  private storeToken(tokenData: FlockOAuthTokenResponse): void {
    if (typeof window !== 'undefined') {
      const tokenInfo = {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
      };

      localStorage.setItem('flock_oauth_token', JSON.stringify(tokenInfo));
      flockLogger.debug('Flock token stored in localStorage');
    }
  }

  /**
   * Get stored token
   */
  getStoredToken(): FlockOAuthTokenResponse | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('flock_oauth_token');
      if (stored) {
        try {
          const tokenInfo = JSON.parse(stored);
          
          // Check if token is expired
          if (tokenInfo.expires_at && Date.now() > tokenInfo.expires_at) {
            flockLogger.warn('Stored Flock token is expired');
            this.clearStoredToken();
            return null;
          }

          return tokenInfo;
        } catch (error) {
          flockLogger.error('Failed to parse stored Flock token', { error });
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
      localStorage.removeItem('flock_oauth_token');
      flockLogger.info('Stored Flock token cleared');
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
export const createFlockOAuth = (): FlockOAuth => {
  const config: FlockOAuthConfig = {
    clientId: process.env.NEXT_PUBLIC_FLOCK_CLIENT_ID || '',
    clientSecret: process.env.FLOCK_CLIENT_SECRET || '',
    serverUrl: process.env.NEXT_PUBLIC_FLOCK_URL || 'https://api.flock.com',
    redirectUri: process.env.NEXT_PUBLIC_FLOCK_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/flock/callback',
    scopes: ['chat:read', 'chat:write'],
  };

  if (!config.clientId) {
    flockLogger.error('NEXT_PUBLIC_FLOCK_CLIENT_ID environment variable is required');
    throw new Error('Flock OAuth client ID is required');
  }

  if (!config.clientSecret) {
    flockLogger.error('FLOCK_CLIENT_SECRET environment variable is required');
    throw new Error('Flock OAuth client secret is required');
  }

  flockLogger.info('FlockOAuth configuration validated', {
    hasClientId: !!config.clientId,
    hasClientSecret: !!config.clientSecret,
    serverUrl: config.serverUrl,
    redirectUri: config.redirectUri
  });

  return new FlockOAuth(config);
};

export default FlockOAuth;