'use client';

/**
 * Flock OAuth Manager
 * Manages OAuth authentication state for Flock integration
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { createEnhancedFlockClient, EnhancedFlockApiClient } from '@/lib/enhanced-flock-client';
import { createFlockOAuth, FlockUser } from '@/lib/flock-oauth';
import { flockLogger } from '@/lib/logger';

interface FlockAuthState {
  isAuthenticated: boolean;
  user: FlockUser | null;
  accessToken: string | null;
  client: EnhancedFlockApiClient | null;
  isLoading: boolean;
  error: string | null;
}

interface FlockAuthContextType extends FlockAuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
}

const FlockAuthContext = createContext<FlockAuthContextType | undefined>(undefined);

interface FlockAuthProviderProps {
  children: ReactNode;
}

export function FlockAuthProvider({ children }: FlockAuthProviderProps) {
  const [state, setState] = useState<FlockAuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    client: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check for OAuth token in cookies
      const response = await fetch('/api/flock/auth/check', {
        credentials: 'include',
      });

      if (response.ok) {
        const { token, user } = await response.json();
        
        if (token) {
          const client = createEnhancedFlockClient({
            accessToken: token,
            useOAuth: true,
          });

          if (client) {
            setState({
              isAuthenticated: true,
              user,
              accessToken: token,
              client,
              isLoading: false,
              error: null,
            });
            return;
          }
        }
      }

      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        client: null,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      flockLogger.error('Error checking Flock auth', { error });
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        client: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication check failed',
      }));
    }
  };

  const login = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Redirect to OAuth login
      window.location.href = '/auth/flock/login';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Login failed';
      flockLogger.error('Flock login error', { error });
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }));
    }
  };

  const logout = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Call logout endpoint
      await fetch('/api/flock/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Clear local storage
      const oauth = createFlockOAuth();
      oauth.clearStoredToken();

      setState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        client: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      flockLogger.error('Flock logout error', { error });
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      }));
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const response = await fetch('/api/flock/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const { token, user } = await response.json();
        
        if (token) {
          const client = createEnhancedFlockClient({
            accessToken: token,
            useOAuth: true,
          });

          if (client) {
            setState(prev => ({
              ...prev,
              isAuthenticated: true,
              user,
              accessToken: token,
              client,
              isLoading: false,
              error: null,
            }));
            return true;
          }
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Token refresh failed',
      }));
      return false;
    } catch (error) {
      flockLogger.error('Flock token refresh error', { error });
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      }));
      return false;
    }
  };

  const value = {
    ...state,
    login,
    logout,
    refreshToken,
    checkAuth,
  };

  return (
    <FlockAuthContext.Provider value={value}>
      {children}
    </FlockAuthContext.Provider>
  );
}

export function useFlockAuth() {
  const context = useContext(FlockAuthContext);
  if (context === undefined) {
    throw new Error('useFlockAuth must be used within a FlockAuthProvider');
  }
  return context;
}

// API endpoints for OAuth management
export const flockOAuthApi = {
  checkAuth: async () => {
    const response = await fetch('/api/flock/auth/check', {
      credentials: 'include',
    });
    return response.json();
  },

  logout: async () => {
    const response = await fetch('/api/flock/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    return response.json();
  },

  refreshToken: async () => {
    const response = await fetch('/api/flock/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    return response.json();
  },
};