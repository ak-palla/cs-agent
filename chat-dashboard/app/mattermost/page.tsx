'use client';

import { useState } from 'react';
import MattermostChat from '@/components/MattermostChat';
import MattermostOAuthLogin from '@/components/MattermostOAuthLogin';

export default function MattermostPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleAuthError = (error: string) => {
    console.error('Authentication error:', error);
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <div className="h-screen bg-gray-100">
      {!isAuthenticated ? (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="max-w-md mx-auto px-4">
            <MattermostOAuthLogin 
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
            />
          </div>
        </div>
      ) : (
        <MattermostChat />
      )}
    </div>
  );
}