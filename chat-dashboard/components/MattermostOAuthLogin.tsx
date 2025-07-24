/**
 * Mattermost OAuth Login Component
 * Handles OAuth 2.0 authentication flow with enhanced UI
 */

'use client';

import { useState, useEffect } from 'react';
import { LogIn, Shield, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { mattermostLogger } from '@/lib/logger';

interface OAuthLoginProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
}

interface MattermostUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function MattermostOAuthLogin({ onSuccess, onError }: OAuthLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<MattermostUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check for existing authentication on component mount
  useEffect(() => {
    checkExistingAuth();
    handleOAuthCallback();
  }, []);

  /**
   * Check if user is already authenticated
   */
  const checkExistingAuth = async () => {
    try {
      mattermostLogger.info('Checking existing authentication status');
      setIsCheckingAuth(true);

      // Check for user cookie
      const userCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('mattermost_user='));

      if (userCookie) {
        const userValue = userCookie.split('=')[1];
        const userData = JSON.parse(decodeURIComponent(userValue));
        
        mattermostLogger.info('Found existing authentication', {
          userId: userData.id,
          username: userData.username
        });
        
        setUser(userData);
        if (onSuccess) {
          onSuccess(userData);
        }
      } else {
        mattermostLogger.debug('No existing authentication found');
      }
    } catch (error) {
      mattermostLogger.error('Error checking existing auth', {
        error: error instanceof Error ? error.message : error
      });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  /**
   * Handle OAuth callback parameters
   */
  const handleOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const errorDescription = urlParams.get('error_description');

    if (oauthSuccess === 'true') {
      const userId = urlParams.get('user_id');
      const username = urlParams.get('username');
      
      mattermostLogger.info('OAuth callback success detected', {
        userId,
        username
      });

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      // Refresh to get updated user data
      checkExistingAuth();
    } else if (oauthError) {
      mattermostLogger.error('OAuth callback error detected', {
        error: oauthError,
        description: errorDescription
      });

      setError(errorDescription || `OAuth error: ${oauthError}`);
      if (onError) {
        onError(errorDescription || oauthError);
      }

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  /**
   * Initiate OAuth login flow
   */
  const handleLogin = async () => {
    try {
      mattermostLogger.info('OAuth login initiated by user');
      setIsLoading(true);
      setError(null);

      // Redirect to OAuth login endpoint
      window.location.href = '/auth/mattermost/login';
    } catch (error) {
      mattermostLogger.error('Error initiating OAuth login', {
        error: error instanceof Error ? error.message : error
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate login';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      setIsLoading(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      mattermostLogger.info('OAuth logout initiated by user');
      setIsLoading(true);

      const response = await fetch('/auth/mattermost/logout', {
        method: 'POST',
      });

      if (response.ok) {
        setUser(null);
        setError(null);
        mattermostLogger.info('OAuth logout successful');
        
        // Clear any client-side storage
        localStorage.removeItem('mattermost_oauth_token');
        
        // Refresh the page to clear all state
        window.location.reload();
      } else {
        throw new Error('Logout request failed');
      }
    } catch (error) {
      mattermostLogger.error('Error during logout', {
        error: error instanceof Error ? error.message : error
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to logout';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Checking authentication status...</p>
        </div>
      </div>
    );
  }

  // Show authenticated state
  if (user) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <h2 className="font-semibold text-lg">Connected to Mattermost</h2>
              <p className="text-sm text-gray-600">Authenticated via OAuth 2.0</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-medium mb-2">User Information</h3>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Username:</span> {user.username}</p>
            <p><span className="font-medium">Email:</span> {user.email}</p>
            <p><span className="font-medium">Name:</span> {user.first_name} {user.last_name}</p>
            <p><span className="font-medium">User ID:</span> {user.id}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Shield className="w-4 h-4" />
            <span>Secure OAuth 2.0 Authentication</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 rounded-md transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Logout'
            )}
          </button>
        </div>
      </div>
    );
  }

  // Show login state
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <LogIn className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="font-semibold text-xl mb-2">Connect to Mattermost</h2>
        <p className="text-gray-600">
          Authenticate with your Mattermost account using secure OAuth 2.0
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">Authentication Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">OAuth 2.0 Benefits</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• No need to store or enter passwords</li>
            <li>• Secure token-based authentication</li>
            <li>• Automatic token refresh</li>
            <li>• Revocable access permissions</li>
          </ul>
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ExternalLink className="w-5 h-5" />
              <span>Login with Mattermost</span>
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          You'll be redirected to your Mattermost server to authorize this application
        </p>
      </div>
    </div>
  );
}