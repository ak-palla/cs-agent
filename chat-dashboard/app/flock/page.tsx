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
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Check for stored access token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('flock_access_token');
    const storedUser = localStorage.getItem('flock_user');
    
    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser));
      setConnectionStatus('connected');
    } else {
      setShowTokenInput(true);
    }
  }, []);

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) {
      setError('Please enter a valid token');
      return;
    }

    setIsConnecting(true);
    setError(null);
    setConnectionStatus('connecting');

    try {
      // Call our auth API endpoint to validate the token
      const response = await fetch('/api/flock/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenInput.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${data.details || 'Authentication failed'}`);
      }

      if (!data.success || !data.user) {
        throw new Error('Invalid response from authentication server');
      }

      // Store credentials
      localStorage.setItem('flock_access_token', data.accessToken);
      localStorage.setItem('flock_user', JSON.stringify(data.user));
      
      setAccessToken(data.accessToken);
      setUser(data.user);
      setConnectionStatus('connected');
      setShowTokenInput(false);
      setError(null);

    } catch (error) {
      console.error('Authentication error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDebugToken = async () => {
    if (!tokenInput.trim()) {
      setError('Please enter a token to debug');
      return;
    }

    setIsTestingConnection(true);
    setError(null);

    try {
      const response = await fetch('/api/flock/test-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenInput.trim()
        })
      });

      const data = await response.json();
      setDebugInfo(data);

      if (!response.ok) {
        setError(`Debug test failed: ${data.error}`);
      }

    } catch (error) {
      console.error('Debug test error:', error);
      setError(error instanceof Error ? error.message : 'Debug test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('flock_access_token');
    localStorage.removeItem('flock_user');
    setAccessToken(null);
    setUser(null);
    setConnectionStatus('idle');
    setShowTokenInput(true);
    setError(null);
    setDebugInfo(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isConnecting) {
      handleTokenSubmit();
    }
  };

  // If authenticated, show the chat interface
  if (accessToken && user && connectionStatus === 'connected') {
    return (
      <div className="h-screen flex flex-col">
        {/* Header with logout option */}
        <div className="bg-purple-600 text-white p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Flock Integration</h1>
            <p className="text-purple-200 text-sm">
              Connected as {user.firstName} {user.lastName} • 
              {accessToken === 'demo_token' ? 'Demo Mode • ' : ''}
              Polling-based (no webhooks needed)
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded text-sm"
          >
            Logout
          </button>
        </div>
        
        {/* Chat Component */}
        <div className="flex-1">
          <FlockChat />
        </div>
      </div>
    );
  }

  // Show authentication form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Connect to Flock
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your Flock bot token to start using the polling-based integration
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900">Polling-Based Integration</h3>
            <p className="text-xs text-blue-800 mt-1">
              This integration uses polling instead of webhooks, so no ngrok or external URLs are needed. 
              Your app will check for new messages every few seconds.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">
              Flock Bot Token
            </label>
            <div className="mt-1">
              <input
                id="token"
                name="token"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your Flock bot token (c2b0b801-9fb8-4ce8-9...)"
                className="w-full rounded-md border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500"
                disabled={isConnecting || isTestingConnection}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Your token will be stored locally and used for API requests.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleTokenSubmit}
              disabled={isConnecting || isTestingConnection || !tokenInput.trim()}
              className="flex-1 rounded-md bg-purple-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <div className="flex items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span className="ml-2">Connecting...</span>
                </div>
              ) : (
                'Connect'
              )}
            </button>

            <button
              onClick={handleDebugToken}
              disabled={isConnecting || isTestingConnection || !tokenInput.trim()}
              className="rounded-md bg-gray-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingConnection ? (
                <div className="flex items-center justify-center">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span className="ml-2">Testing...</span>
                </div>
              ) : (
                'Debug Token'
              )}
            </button>
          </div>

          <div className="text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-gray-50 px-2 text-gray-500">Or</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              // Set up mock authentication
              const mockUser = {
                id: 'demo_user',
                firstName: 'Demo',
                lastName: 'User',
                email: 'demo@example.com',
                username: 'demo_user'
              };
              
              localStorage.setItem('flock_access_token', 'demo_token');
              localStorage.setItem('flock_user', JSON.stringify(mockUser));
              
              setAccessToken('demo_token');
              setUser(mockUser);
              setConnectionStatus('connected');
              setShowTokenInput(false);
              setError(null);
            }}
            className="w-full rounded-md bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Try Demo Mode (No Token Required)
          </button>

          {debugInfo && (
            <div className="mt-6 rounded-md bg-gray-50 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Debug Results</h3>
              <div className="text-xs text-gray-600 space-y-2">
                <div>
                  <strong>Token Info:</strong> Length {debugInfo.tokenInfo?.length}, Pattern: {debugInfo.tokenInfo?.pattern}
                </div>
                <div className="space-y-1">
                  <strong>API Test Results:</strong>
                  {debugInfo.results?.map((result: any, index: number) => (
                    <div key={index} className="ml-2">
                      <div className="font-mono text-xs">
                        {result.endpoint}: 
                        <span className={result.status === 200 ? 'text-green-600' : 'text-red-600'}>
                          {' '}{result.status || 'Error'} {result.statusText || result.error}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600">
              <p className="mb-2">
                <strong>How to get your Flock bot token:</strong>
              </p>
              <ol className="text-left text-xs space-y-1 list-decimal list-inside">
                <li>Go to your Flock admin panel</li>
                <li>Navigate to Apps & Integrations</li>
                <li>Create a new bot or select existing bot</li>
                <li>Copy the bot token from the settings</li>
                <li>Paste it above and click Connect</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}