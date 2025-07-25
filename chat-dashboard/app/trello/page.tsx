'use client';

import { useState, useEffect } from 'react';
import TrelloBoard from '@/components/TrelloBoard';
import TrelloOAuthLogin from '@/components/TrelloOAuthLogin';
import { TrelloOAuthClient, TrelloUser } from '@/lib/trello-oauth-client';
import { createTrelloClientWithOAuth } from '@/lib/trello-client';
import { AlertCircle, ExternalLink, Key, Settings, Shield, CheckCircle } from 'lucide-react';

export default function TrelloPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<TrelloUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize OAuth and check authentication status
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const oauth = new TrelloOAuthClient();
        
        // Use the health check endpoint to verify configuration
        const healthResponse = await fetch('/api/trello/health', {
          credentials: 'include' // Include cookies for OAuth authentication
        });
        const health = await healthResponse.json();
        
        if (!health.configured) {
          setError('Trello OAuth not properly configured. Please check environment variables.');
          return;
        }
        
        const userData = await oauth.getCurrentUser();
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error initializing Trello OAuth:', error);
        setError('Failed to initialize Trello integration');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Handle successful OAuth authentication
   */
  const handleOAuthSuccess = (userData: TrelloUser) => {
    setUser(userData);
    setIsAuthenticated(true);
    setError(null);
  };

  /**
   * Handle OAuth error
   */
  const handleOAuthError = (errorMessage: string) => {
    setError(errorMessage);
    setIsAuthenticated(false);
    setUser(null);
  };

  /**
   * Handle logout/disconnect
   */
  const handleDisconnect = async () => {
    try {
      const oauth = new TrelloOAuthClient();
      oauth.clearStoredToken();
      
      // Also call the logout API endpoint
      await fetch('/auth/trello/logout', { method: 'POST' });
      
      setIsAuthenticated(false);
      setUser(null);
      setError(null);
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Trello integration...</p>
        </div>
      </div>
    );
  }

  // Render OAuth authentication form
  if (!isAuthenticated) {
    return (
      <div className="h-full bg-gray-50 zoom-reset">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Trello Integration</h1>
          <p className="text-sm text-gray-600">Connect your Trello account using secure OAuth authentication</p>
        </div>

        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <TrelloOAuthLogin
              onSuccess={handleOAuthSuccess}
              onError={handleOAuthError}
            />
          </div>
        </div>
      </div>
    );
  }

  // Render main Trello interface
  return (
    <div className="h-full flex flex-col zoom-reset">
      {/* Header with user info and disconnect option */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trello</h1>
          <p className="text-sm text-gray-600">Manage your Trello boards and cards</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {user && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              {user.avatarUrl && (
                <img 
                  src={user.avatarUrl} 
                  alt={user.fullName}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span>Connected as {user.fullName}</span>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <Shield className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          )}
          
          <button
            onClick={handleDisconnect}
            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings className="h-4 w-4 mr-1" />
            Disconnect
          </button>
        </div>
      </div>

      {/* Trello Board Component */}
      <div className="flex-1 responsive-container">
        <TrelloBoard
          onBoardChange={(board) => {
            console.log('Board changed:', board.name);
          }}
        />
      </div>
    </div>
  );
}