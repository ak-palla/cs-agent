'use client';

import { useState, useEffect } from 'react';
import { useFlockAuth } from '@/lib/flock-oauth-manager';
import FlockOAuthChat from '@/components/FlockOAuthChat';
import AuthenticatedFlockOAuth from '@/components/AuthenticatedFlockOAuth';
import { FlockUser } from '@/lib/types/flock-types';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

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

  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Check Supabase authentication
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSupabaseUser(user);
      setSupabaseLoading(false);
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSupabaseUser(session?.user ?? null);
        setSupabaseLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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

  const handleLogout = async () => {
    // Logout from Flock
    logout();
    
    // Logout from Supabase
    await supabase.auth.signOut();
    
    setSupabaseUser(null);
    setConnectionStatus('idle');
    setError(null);
  };

  // Show loading while checking Supabase auth
  if (supabaseLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show login if not authenticated with Supabase or Flock
  if (!supabaseUser || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Secure Flock Integration</h2>
            <p className="mt-2 text-sm text-gray-600">
              Two-step authentication: Login first, then connect to Flock
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

            {/* Use the new authenticated Flock OAuth component */}
            <AuthenticatedFlockOAuth 
              onFlockConnected={() => {
                setConnectionStatus('connected');
                setError(null);
              }}
              onError={(err) => setError(err)}
            />

            <div className="bg-white py-6 px-4 shadow rounded-lg sm:px-10">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Two-Step Security Process:</h4>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>First, authenticate with your dashboard account</li>
                <li>Then, securely connect to Flock using OAuth 2.0</li>
                <li>Both authentications work together for maximum security</li>
              </ol>
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