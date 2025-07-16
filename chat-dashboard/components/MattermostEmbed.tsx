'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, Server, Settings } from 'lucide-react';

export default function MattermostEmbed() {
  const [url, setUrl] = useState('');
  const [showWarning, setShowWarning] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  
  useEffect(() => {
    const mattermostUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'https://teams.webuildtrades.co';
    setUrl(mattermostUrl);
  }, []);

  const handleProceed = () => {
    setShowWarning(false);
  };

  const handleIframeError = () => {
    setIframeError(true);
  };

  if (showWarning) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          <div className="rounded-lg border bg-white p-6 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900">Security Warning</h3>
              <p className="mt-2 text-sm text-gray-600">
                Embedding Mattermost via iframe may pose security risks. Only proceed if you're on a trusted private network.
              </p>
              
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleProceed}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  I understand, proceed
                </button>
                
                <button
                  onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  className="w-full rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
                >
                  Open in new tab (safer)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (iframeError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-lg">
          <div className="rounded-lg border bg-white p-6 shadow-lg">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <Server className="h-8 w-8 text-red-600" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900">Connection Refused</h3>
              <p className="mt-2 text-sm text-gray-600">
                {url} refused to connect due to X-Frame-Options security policy.
              </p>
              
              <div className="mt-4 rounded-md bg-blue-50 p-4 text-left">
                <h4 className="mb-2 flex items-center text-sm font-medium text-blue-900">
                  <Settings className="mr-2 h-4 w-4" />
                  Server Configuration Required
                </h4>
                <p className="text-sm text-blue-800 mb-2">
                  To enable iframe embedding, your Mattermost admin needs to:
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-700">
                  <li>Go to System Console → Environment → Web Server</li>
                  <li>Set "Enable Cross-origin Requests" to true</li>
                  <li>Add your domain to "CORS Expose Headers"</li>
                  <li>Or disable X-Frame-Options (less secure)</li>
                </ol>
              </div>
              
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </button>
                
                <button
                  onClick={() => {
                    setIframeError(false);
                    setShowWarning(true);
                  }}
                  className="w-full rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <iframe
        src={url}
        className="h-full w-full border-0"
        title="Mattermost Chat"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        onError={handleIframeError}
        onLoad={(e) => {
          const iframe = e.target as HTMLIFrameElement;
          try {
            if (!iframe.contentDocument) {
              handleIframeError();
            }
          } catch {
            handleIframeError();
          }
        }}
      />
    </div>
  );
}