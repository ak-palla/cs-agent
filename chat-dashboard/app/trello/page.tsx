'use client';

import { useState, useEffect } from 'react';
import TrelloBoard from '@/components/TrelloBoard';
import { AlertCircle, ExternalLink, Key, Settings } from 'lucide-react';

export default function TrelloPage() {
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Check for stored credentials on component mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem('trello_api_key');
    const storedToken = localStorage.getItem('trello_token');
    
    if (storedApiKey && storedToken) {
      setApiKey(storedApiKey);
      setToken(storedToken);
      testConnection(storedApiKey, storedToken);
    } else {
      setShowAuthForm(true);
    }
  }, []);

  /**
   * Test connection to Trello API
   */
  const testConnection = async (testApiKey: string, testToken: string) => {
    setIsTestingConnection(true);
    setError(null);

    try {
      const response = await fetch(`/api/trello/boards?apiKey=${testApiKey}&token=${testToken}`);
      const data = await response.json();

      if (response.ok) {
        setIsAuthenticated(true);
        setShowAuthForm(false);
        
        // Store credentials in localStorage
        localStorage.setItem('trello_api_key', testApiKey);
        localStorage.setItem('trello_token', testToken);
      } else {
        throw new Error(data.error || 'Failed to connect to Trello');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsAuthenticated(false);
    } finally {
      setIsTestingConnection(false);
    }
  };

  /**
   * Handle authentication form submission
   */
  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !token.trim()) {
      setError('Both API key and token are required');
      return;
    }
    await testConnection(apiKey.trim(), token.trim());
  };

  /**
   * Handle logout/disconnect
   */
  const handleDisconnect = () => {
    localStorage.removeItem('trello_api_key');
    localStorage.removeItem('trello_token');
    setApiKey('');
    setToken('');
    setIsAuthenticated(false);
    setShowAuthForm(true);
    setError(null);
  };

  /**
   * Generate Trello token URL
   */
  const getTrelloTokenUrl = () => {
    const appName = 'CS Agent Dashboard';
    const scope = 'read,write,account';
    const expiration = 'never';
    const responseType = 'token';
    
    return `https://trello.com/1/authorize?expiration=${expiration}&scope=${scope}&response_type=${responseType}&name=${encodeURIComponent(appName)}&key=${apiKey}`;
  };

  // Render authentication form
  if (!isAuthenticated || showAuthForm) {
    return (
      <div className="h-full bg-gray-50">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Trello Integration</h1>
          <p className="text-sm text-gray-600">Connect your Trello account to manage boards and cards</p>
        </div>

        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="rounded-lg border bg-white p-6 shadow-lg">
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <Key className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Connect to Trello</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Enter your Trello API credentials to get started
                </p>
              </div>

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

              <form onSubmit={handleAuthentication} className="space-y-4">
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                    API Key
                  </label>
                  <input
                    type="text"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Trello API key"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get your API key from{' '}
                    <a 
                      href="https://trello.com/app-key" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-500"
                    >
                      trello.com/app-key
                    </a>
                  </p>
                </div>

                <div>
                  <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                    Token
                  </label>
                  <input
                    type="text"
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter your Trello token"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {apiKey ? (
                      <a 
                        href={getTrelloTokenUrl()} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-500 inline-flex items-center"
                      >
                        Generate token <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    ) : (
                      'Enter API key first to generate token'
                    )}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!apiKey.trim() || !token.trim() || isTestingConnection}
                  className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingConnection ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    'Connect to Trello'
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-md bg-blue-50 p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions:</h4>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-800">
                  <li>Visit <a href="https://trello.com/app-key" target="_blank" rel="noopener noreferrer" className="underline">trello.com/app-key</a> to get your API key</li>
                  <li>Enter the API key above</li>
                  <li>Click "Generate token" to create an access token</li>
                  <li>Copy and paste the token above</li>
                  <li>Click "Connect to Trello" to start using the integration</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render main Trello interface
  return (
    <div className="h-full flex flex-col">
      {/* Header with disconnect option */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trello</h1>
          <p className="text-sm text-gray-600">Manage your Trello boards and cards</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-xs text-gray-500">
            Connected to Trello
          </div>
          
          <button
            onClick={handleDisconnect}
            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4 mr-1" />
            Disconnect
          </button>
        </div>
      </div>

      {/* Trello Board Component */}
      <div className="flex-1">
        <TrelloBoard
          apiKey={apiKey}
          token={token}
          onBoardChange={(board) => {
            console.log('Board changed:', board.name);
          }}
        />
      </div>
    </div>
  );
}