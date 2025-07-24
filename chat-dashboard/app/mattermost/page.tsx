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
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8 px-4">
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto">
            <MattermostOAuthLogin 
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
            />
          </div>
        ) : (
          <div className="h-screen bg-white rounded-lg shadow-lg overflow-hidden">
            <MattermostChat />
          </div>
        )}
      </div>
    </div>
  );
}