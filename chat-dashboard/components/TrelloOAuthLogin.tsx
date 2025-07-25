/**
 * Trello OAuth Login Component
 * Handles OAuth 1.0a authentication flow with Trello
 */

'use client';

import { useState, useEffect } from 'react';
import { LogIn, Shield, CheckCircle, AlertCircle, Loader2, ExternalLink, CreditCard } from 'lucide-react';
import trelloLogger from '@/lib/trello-logger';
import { TrelloOAuthClient, TrelloUser } from '@/lib/trello-oauth-client';

interface TrelloOAuthLoginProps {
  onSuccess?: (user: TrelloUser) => void;
  onError?: (error: string) => void;
}

export default function TrelloOAuthLogin({ onSuccess, onError }: TrelloOAuthLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<TrelloUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [oauthClient] = useState(new TrelloOAuthClient());

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
      trelloLogger.info('Checking existing Trello authentication status');
      setIsCheckingAuth(true);

      const userData = await oauthClient.getCurrentUser();
      
      if (userData) {
        trelloLogger.info('Found existing Trello authentication', {
          userId: userData.id,
          username: userData.username
        });
        
        setUser(userData);
        if (onSuccess) {
          onSuccess(userData);
        }
      } else {
        trelloLogger.debug('No existing Trello authentication found');
      }
    } catch (error) {
      trelloLogger.error('Error checking existing Trello auth', {
        error: error instanceof Error ? error.message : error
      });
      // Clear potentially corrupted tokens
      oauthClient.clearStoredToken();
    } finally {
      setIsCheckingAuth(false);
    }
  };

  /**
   * Handle OAuth callback parameters
   */
  const handleOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const trelloAuthSuccess = urlParams.get('trello_auth');
    const trelloError = urlParams.get('error');
    const message = urlParams.get('message');

    if (trelloAuthSuccess === 'success') {
      trelloLogger.info('Trello OAuth callback success detected');

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      // Refresh to get updated user data
      checkExistingAuth();
    } else if (trelloError) {
      trelloLogger.error('Trello OAuth callback error detected', {
        error: trelloError,
        message: message
      });

      setError(message || `Trello OAuth error: ${trelloError}`);
      if (onError) {
        onError(message || trelloError);
      }

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Handle logout callback
    const trelloLogout = urlParams.get('trello_logout');
    if (trelloLogout === 'success') {
      trelloLogger.info('Trello OAuth logout callback detected');
      setUser(null);
      setError(null);
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  /**
   * Initiate OAuth login flow
   */
  const handleLogin = async () => {
    try {
      trelloLogger.info('Trello OAuth login initiated by user');
      setIsLoading(true);
      setError(null);

      // Redirect to OAuth login endpoint
      window.location.href = '/auth/trello/login';
    } catch (error) {
      trelloLogger.error('Error initiating Trello OAuth login', {
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
      trelloLogger.info('Trello OAuth logout initiated by user');
      setIsLoading(true);

      const response = await fetch('/auth/trello/logout', {
        method: 'POST',
      });

      if (response.ok) {
        setUser(null);
        setError(null);
        trelloLogger.info('Trello OAuth logout successful');
        
        // Clear any client-side storage
        oauthClient.clearStoredToken();
        
        // Refresh the page to clear all state
        window.location.reload();
      } else {
        throw new Error('Logout request failed');
      }
    } catch (error) {
      trelloLogger.error('Error during Trello logout', {
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
          <p className="text-gray-600">Checking Trello authentication status...</p>
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
              <h2 className="font-semibold text-lg">Connected to Trello</h2>
              <p className="text-sm text-gray-600">Authenticated via OAuth 1.0a</p>
            </div>
          </div>
          <CreditCard className="w-8 h-8 text-blue-500" />
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-medium mb-2">User Information</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              <p><span className="font-medium">Username:</span> {user.username}</p>
              {user.avatarUrl && (
                <img 
                  src={user.avatarUrl} 
                  alt={user.fullName}
                  className="w-6 h-6 rounded-full"
                />
              )}
            </div>
            <p><span className="font-medium">Full Name:</span> {user.fullName}</p>
            {user.email && <p><span className="font-medium">Email:</span> {user.email}</p>}
            <p><span className="font-medium">Initials:</span> {user.initials}</p>
            <p><span className="font-medium">User ID:</span> {user.id}</p>
            <p><span className="font-medium">Member Type:</span> {user.memberType}</p>
            <p><span className="font-medium">Confirmed:</span> {user.confirmed ? 'Yes' : 'No'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Shield className="w-4 h-4" />
            <span>Secure OAuth 1.0a Authentication</span>
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
          <CreditCard className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="font-semibold text-xl mb-2">Connect to Trello</h2>
        <p className="text-gray-600">
          Authenticate with your Trello account using secure OAuth 1.0a
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
          <h3 className="font-medium text-blue-900 mb-2">OAuth 1.0a Benefits</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• No need to store or enter passwords</li>
            <li>• Secure token-based authentication</li>
            <li>• Access to all your Trello boards and cards</li>
            <li>• Real-time activity monitoring</li>
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
              <span>Login with Trello</span>
            </>
          )}
        </button>

        {error && (
          <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              {error}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 text-center">
          You'll be redirected to Trello to authorize this application
        </p>
      </div>
    </div>
  );
}