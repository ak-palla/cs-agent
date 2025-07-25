/**
 * Flock OAuth Login Component
 * Provides OAuth authentication for Flock
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createFlockOAuth } from '@/lib/flock-oauth';

interface FlockOAuthLoginProps {
  onLoginSuccess?: () => void;
  onLoginError?: (error: string) => void;
  className?: string;
  buttonText?: string;
  showUserInfo?: boolean;
}

export default function FlockOAuthLogin({
  onLoginSuccess,
  onLoginError,
  className = '',
  buttonText = 'Sign in with Flock',
  showUserInfo = true,
}: FlockOAuthLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for OAuth callback parameters
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const errorDescription = params.get('error_description');

    if (oauthSuccess === 'true') {
      // OAuth was successful
      const userId = params.get('user_id');
      const email = params.get('email');
      
      if (userId && email) {
        setUser({ id: userId, email });
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }

      // Clean up URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (oauthError) {
      // OAuth failed
      const errorMsg = errorDescription || 'Authentication failed';
      setError(errorMsg);
      if (onLoginError) {
        onLoginError(errorMsg);
      }

      // Clean up URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Check for existing user session
    checkExistingSession();
  }, [onLoginSuccess, onLoginError]);

  const checkExistingSession = () => {
    try {
      const oauth = createFlockOAuth();
      if (oauth.isAuthenticated()) {
        const userCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('flock_user='));
        
        if (userCookie) {
          const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Redirect to OAuth login route
      window.location.href = '/auth/flock/login';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Login failed';
      setError(errorMsg);
      if (onLoginError) {
        onLoginError(errorMsg);
      }
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      const oauth = createFlockOAuth();
      oauth.clearStoredToken();
      
      // Clear cookies
      document.cookie = 'flock_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'flock_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'flock_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      setUser(null);
      setError(null);
      
      // Force reload to clear any cached state
      window.location.reload();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Logout failed';
      setError(errorMsg);
    }
  };

  if (user && showUserInfo) {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className="flex items-center space-x-2">
          {user.profileImage && (
            <img
              src={user.profileImage}
              alt={user.firstName || user.email}
              className="w-8 h-8 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div>
            <div className="text-sm font-medium">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.email}
            </div>
            <div className="text-xs text-gray-500">Connected to Flock</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="flex items-center justify-center w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Signing in...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z"
                clipRule="evenodd"
              />
            </svg>
            {buttonText}
          </>
        )}
      </button>
      
      <p className="mt-2 text-xs text-gray-500 text-center">
        Sign in to connect your Flock account
      </p>
    </div>
  );
}