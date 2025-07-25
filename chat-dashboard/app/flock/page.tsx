'use client';

import { useState, useEffect } from 'react';
import { useFlockAuth } from '@/lib/flock-oauth-manager';
import FlockOAuthChat from '@/components/FlockOAuthChat';
import { FlockUser } from '@/lib/types/flock-types';

export default function FlockOAuthPage() {
  const { 
    isAuthenticated, 
    user, 
    client, 
    isLoading: authLoading, 
    error: authError,
    login,
    logout
  } = useFlockAuth();

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('oauth_error');
    const oauthSuccess = params.get('oauth_success');

    if (oauthError) {
      const errorDescription = params.get('error_description') || 'OAuth authentication failed';
      setError(errorDescription);
      setConnectionStatus('error');
      
      // Clean URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (oauthSuccess === 'true') {
      setConnectionStatus('connected');
      
      // Clean URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Test connection when authenticated
  useEffect(() => {
    const testConnection = async () => {
      if (isAuthenticated && client) {
        setConnectionStatus('connecting');
        setError(null);
        
        try {
          const connected = await client.testConnection();
          if (connected) {
            setConnectionStatus('connected');
          } else {
            setConnectionStatus('error');
            setError('Could not connect to Flock API');
          }
        } catch (error) {
          console.error('Connection test error:', error);
          setConnectionStatus('error');
          setError(error instanceof Error ? error.message : 'Connection failed');
        }
      }
    };

    testConnection();
  }, [isAuthenticated, client]);

  const handleLogout = () => {
    logout();
    setConnectionStatus('idle');
    setError(null);
  };

  // Show OAuth login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Connect to Flock</h2>
            <p className="mt-2 text-sm text-gray-600">
              Securely connect your Flock workspace using OAuth 2.0
            </p>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}

            <div className="bg-white py-8 px-4 shadow rounded-lg sm:px-10">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">OAuth Authentication</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Connect your Flock account securely using OAuth 2.0. This method uses 
                    the official Flock authentication flow and provides access to your 
                    workspace data without storing tokens locally.
                  </p>
                  
                  <div className="space-y-4">
                    <button
                      onClick={login}
                      disabled={authLoading}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {authLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z" clipRule="evenodd" />
                          </svg>
                          Connect with Flock OAuth
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Benefits of OAuth:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✅ Secure authentication via Flock</li>
                    <li>✅ No need to manage tokens manually</li>
                    <li>✅ Access to full workspace data</li>
                    <li>✅ Automatic token refresh</li>
                    <li>✅ Easy logout and re-authentication</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  <strong>How OAuth works:</strong>
                </p>
                <ol className="text-left text-xs space-y-1 list-decimal list-inside">
                  <li>Click "Connect with Flock OAuth" above</li>
                  <li>You'll be redirected to Flock's login page</li>
                  <li>Sign in with your Flock account</li>
                  <li>Grant necessary permissions to the app</li>
                  <li>You'll be redirected back with access to your workspace</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show the OAuth-enabled chat interface
  return (
    <div className="h-screen flex flex-col">
      {/* Header with logout option */}
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between shadow-md"
        >
        <div>
          <h1 className="text-xl font-bold">Flock Integration</h1>
          <p className="text-blue-100 text-sm">
            Connected as {user?.firstName} {user?.lastName} • OAuth Authentication
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          Logout
        </button>
      </div>
      
      {/* OAuth-enabled Chat Component */}
      <div className="flex-1">
        <FlockOAuthChat />
      </div>
    </div>
  );
}