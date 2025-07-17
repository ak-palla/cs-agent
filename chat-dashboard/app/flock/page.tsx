'use client';

import { useState, useEffect } from 'react';
import FlockApiClient from '@/lib/flock-client';
import { FlockUser } from '@/lib/types/flock-types';
import FlockChat from '@/components/FlockChat';

export default function FlockPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<FlockUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showCredentialsSetup, setShowCredentialsSetup] = useState(false);

  // Check for stored access token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('flock_access_token');
    const storedUser = localStorage.getItem('flock_user');
    
    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser));
      setConnectionStatus('connected');
    }
  }, []);

  const handleConnect = async () => {
    if (!process.env.NEXT_PUBLIC_FLOCK_APP_ID) {
      setError('Flock App ID not configured');
      setConnectionStatus('error');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      setConnectionStatus('connecting');

      // For FlockOS, we need to redirect to app install URL
      const flockClient = new FlockApiClient(
        process.env.NEXT_PUBLIC_FLOCK_APP_ID,
        '' // App secret is only needed on server side
      );

      const redirectUri = `${window.location.origin}/flock`;
      const installUrl = flockClient.generateInstallUrl(redirectUri);

      // Show token input instead of redirecting to OAuth
      setShowTokenInput(true);
      setConnectionStatus('idle');
      
    } catch (error) {
      console.error('Connection error:', error);
      setError(error instanceof Error ? error.message : 'Connection failed');
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) {
      setError('Please enter a valid token');
      return;
    }

    setIsConnecting(true);
    setError(null);
    setConnectionStatus('connecting');

    try {
      const flockClient = new FlockApiClient(
        process.env.NEXT_PUBLIC_FLOCK_APP_ID!,
        '' // App secret is only needed on server side
      );
      
      flockClient.setAccessToken(tokenInput.trim());

      // Test the token by fetching user info
      const user = await flockClient.getCurrentUser();

      if (!user) {
        throw new Error('Invalid token or failed to fetch user info');
      }

      // Store credentials
      localStorage.setItem('flock_access_token', tokenInput.trim());
      localStorage.setItem('flock_user', JSON.stringify(user));
      
      setAccessToken(tokenInput.trim());
      setUser(user);
      setConnectionStatus('connected');
      setShowTokenInput(false);
      setTokenInput('');

    } catch (error) {
      console.error('Token validation error:', error);
      setError(error instanceof Error ? error.message : 'Token validation failed');
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!accessToken) return;

    setIsTestingConnection(true);
    setError(null);

    try {
      const flockClient = new FlockApiClient(
        process.env.NEXT_PUBLIC_FLOCK_APP_ID!,
        '' // App secret is only needed on server side
      );
      
      flockClient.setAccessToken(accessToken);
      const isConnected = await flockClient.testConnection();

      if (isConnected) {
        setError(null);
        alert('✅ Connection test successful!');
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setError(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('flock_access_token');
    localStorage.removeItem('flock_user');
    setAccessToken(null);
    setUser(null);
    setConnectionStatus('idle');
    setError(null);
    setShowTokenInput(false);
    setTokenInput('');
  };

  // If connected, show the chat interface
  if (connectionStatus === 'connected' && accessToken && user) {
    return <FlockChat />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-600">
              <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Flock Integration</h1>
            <p className="mt-2 text-gray-600">Connect your Flock workspace for seamless team communication</p>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-lg">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  {connectionStatus === 'connected' ? 'Connected to Flock' : 'Connect to Flock'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {connectionStatus === 'connected' 
                    ? `Signed in as ${user?.firstName} ${user?.lastName}`
                    : 'Enter your Flock bot token to get started'
                  }
                </p>
              </div>

              {connectionStatus !== 'connected' && (
                <div className="space-y-4">
                  {!showTokenInput ? (
                    <div className="space-y-3">
                      <button
                        onClick={handleConnect}
                        disabled={isConnecting || connectionStatus === 'connecting'}
                        className="w-full rounded-lg bg-purple-600 px-4 py-3 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isConnecting ? (
                          <div className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Connecting...
                          </div>
                        ) : (
                          'Connect with Flock'
                        )}
                      </button>

                      <div className="text-center">
                        <button
                          onClick={() => setShowCredentialsSetup(!showCredentialsSetup)}
                          className="text-sm text-purple-600 hover:text-purple-800"
                        >
                          Setup Instructions
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
                          Flock Bot Token
                        </label>
                        <input
                          type="password"
                          id="token"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          placeholder="Enter your Flock bot token"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Get your token from your Flock app settings
                        </p>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={handleTokenSubmit}
                          disabled={isConnecting || !tokenInput.trim()}
                          className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                        <button
                          onClick={() => {
                            setShowTokenInput(false);
                            setTokenInput('');
                            setError(null);
                          }}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {connectionStatus === 'connected' && (
                <div className="space-y-3">
                  <div className="flex space-x-3">
                    <button
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {isTestingConnection ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showCredentialsSetup && (
              <div className="mt-6 rounded-lg border bg-gray-50 p-6">
                <h4 className="mb-4 text-lg font-semibold text-gray-900">Setup Instructions</h4>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Step 1: Create a Flock Bot</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-600">
                      <li>Go to <a href="https://dev.flock.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">dev.flock.com</a></li>
                      <li>Sign in with your Flock account</li>
                      <li>Create a new app or bot</li>
                      <li>Copy the bot token from your app settings</li>
                    </ol>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-700">Step 2: Environment Setup</p>
                    <div className="mt-2 rounded bg-gray-100 p-3 font-mono text-xs">
                      <div>NEXT_PUBLIC_FLOCK_APP_ID={process.env.NEXT_PUBLIC_FLOCK_APP_ID || 'your_app_id'}</div>
                      <div>FLOCK_APP_SECRET=*** (configured server-side)</div>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-gray-700">Step 3: Install Bot to Team</p>
                    <p className="mt-1 text-gray-600">
                      Install your bot to your Flock team and get the bot token for authentication.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}