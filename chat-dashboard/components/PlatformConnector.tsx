'use client';

import { useState } from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';

interface PlatformConnectorProps {
  platform: 'mattermost' | 'trello' | 'flock';
  title: string;
  description: string;
  url: string;
}

export default function PlatformConnector({ platform, title, description, url }: PlatformConnectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    setIsConnecting(true);
    setError(null);
    
    // Try to open in new tab for authentication
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsConnecting(false);
  };

  const platformConfig = {
    mattermost: {
      color: 'blue',
      instructions: [
        'Open your Mattermost workspace URL',
        'Log in with your credentials',
        'Copy the workspace URL from your browser',
        'Update the URL in your .env.local file'
      ]
    },
    trello: {
      color: 'green',
      instructions: [
        'Go to your Trello board',
        'Copy the board URL (format: https://trello.com/b/BOARD-ID)',
        'Update the URL in your .env.local file'
      ]
    },
    flock: {
      color: 'purple',
      instructions: [
        'Open Flock in your browser',
        'Log in to your workspace',
        'Copy the workspace URL',
        'Update the URL in your .env.local file'
      ]
    }
  };

  const config = platformConfig[platform];

  return (
    <div className="flex h-full items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md">
        <div className={`rounded-lg border bg-white p-6 shadow-lg`}>
          <div className="text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-${config.color}-100`}>
              <AlertCircle className={`h-8 w-8 text-${config.color}-600`} />
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-600">{description}</p>
            
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            <div className="mt-6 space-y-4">
              <div className="rounded-md bg-gray-50 p-4">
                <h4 className="mb-2 text-sm font-medium text-gray-900">Setup Instructions:</h4>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
                  {config.instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>
              </div>
              
              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className={`inline-flex items-center justify-center rounded-md bg-${config.color}-600 px-4 py-2 text-sm font-medium text-white hover:bg-${config.color}-700 disabled:opacity-50`}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {isConnecting ? 'Connecting...' : 'Open in New Tab'}
                </button>
                
                <div className="text-xs text-gray-500">
                  <p>Current URL: {url}</p>
                  <p className="mt-1">
                    Update your .env.local file with the correct workspace URL
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}