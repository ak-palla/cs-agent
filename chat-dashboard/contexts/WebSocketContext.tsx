'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import EnhancedMattermostClient from '@/lib/enhanced-mattermost-client';
import { websocketLogger, mattermostLogger } from '@/lib/logger';

interface WebSocketContextType {
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  isReconnecting: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  sendTyping: (channelId: string, parentId?: string) => void;
  subscribeToChannel: (channelId: string) => void;
  unsubscribeFromChannel: (channelId: string) => void;
  addEventListener: (event: string, callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [mattermostClient, setMattermostClient] = useState<EnhancedMattermostClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [reconnectInfo, setReconnectInfo] = useState({
    isReconnecting: false,
    attempts: 0,
    maxAttempts: 3,
  });

  // Event listeners management
  const [eventListeners, setEventListeners] = useState<Map<string, Set<(data: any) => void>>>(new Map());

  const connect = useCallback(async (url: string, token: string) => {
    if (mattermostClient) {
      websocketLogger.info('Disconnecting existing Mattermost client');
      await mattermostClient.disconnect();
      setMattermostClient(null);
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Convert WebSocket URL to HTTP URL for API calls
    const httpUrl = url.replace('wss://', 'https://').replace('ws://', 'http://');
    
    websocketLogger.info('Creating new Enhanced Mattermost client with comprehensive logging', {
      originalUrl: url,
      httpUrl: httpUrl
    });
    
    const client = new EnhancedMattermostClient({
      serverUrl: httpUrl,
      accessToken: token,
      onConnect: () => {
        websocketLogger.info('WebSocketContext: Connection established');
        setConnectionStatus('connected');
        setReconnectInfo(prev => ({ ...prev, isReconnecting: false, attempts: 0 }));
      },
      onDisconnect: () => {
        websocketLogger.warn('WebSocketContext: Connection lost');
        setConnectionStatus('disconnected');
        setReconnectInfo(prev => ({ ...prev, isReconnecting: true }));
      },
      onReconnect: () => {
        websocketLogger.info('WebSocketContext: Reconnection successful');
        setReconnectInfo(prev => ({ 
          ...prev, 
          isReconnecting: false, 
          attempts: prev.attempts + 1 
        }));
      },
      onError: (error) => {
        websocketLogger.error('WebSocketContext: Connection error', { error });
        setConnectionStatus('disconnected');
        
        // Provide more user-friendly error handling
        if (error instanceof Error) {
          if (error.message.includes('CORS')) {
            websocketLogger.warn('CORS issue detected. Consider using polling mode or configuring CORS on the server.');
          }
        }
      },
      onMessage: (event) => {
        websocketLogger.debug('WebSocketContext: Message received', { event: event.event });
        
        // Dispatch to event listeners
        const listeners = eventListeners.get(event.event);
        if (listeners) {
          listeners.forEach(callback => {
            try {
              callback(event.data);
            } catch (error) {
              websocketLogger.error('Error in WebSocket event listener', { error, event: event.event });
            }
          });
        }

        // Also dispatch to 'all' listeners
        const allListeners = eventListeners.get('*');
        if (allListeners) {
          allListeners.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              websocketLogger.error('Error in global WebSocket event listener', { error, event: event.event });
            }
          });
        }
      },
    });

    try {
      setConnectionStatus('connecting');
      await client.connect();
      setMattermostClient(client);
      mattermostLogger.info('WebSocketContext: Connection successful');
    } catch (error) {
      mattermostLogger.error('Failed to connect Mattermost client', { error });
      setConnectionStatus('disconnected');
      throw error;
    }
  }, [eventListeners]);

  const disconnect = useCallback(async () => {
    if (mattermostClient) {
      await mattermostClient.disconnect();
      setMattermostClient(null);
    }
    setConnectionStatus('disconnected');
    setReconnectInfo({ isReconnecting: false, attempts: 0, maxAttempts: 3 });
  }, [mattermostClient]);

  const sendTyping = useCallback((channelId: string, parentId?: string) => {
    if (mattermostClient && connectionStatus === 'connected') {
      // Note: Official client handles typing through WebSocket client
      websocketLogger.debug('Sending typing indicator', { channelId, parentId });
      // The official client's WebSocket client handles typing events automatically
    }
  }, [mattermostClient, connectionStatus]);

  const subscribeToChannel = useCallback((channelId: string) => {
    if (mattermostClient && connectionStatus === 'connected') {
      websocketLogger.debug('Subscribing to channel', { channelId });
      // The official client automatically handles channel subscriptions
    }
  }, [mattermostClient, connectionStatus]);

  const unsubscribeFromChannel = useCallback((channelId: string) => {
    if (mattermostClient && connectionStatus === 'connected') {
      websocketLogger.debug('Unsubscribing from channel', { channelId });
      // The official client handles channel unsubscriptions automatically
    }
  }, [mattermostClient, connectionStatus]);

  const addEventListener = useCallback((event: string, callback: (data: any) => void) => {
    setEventListeners(prev => {
      const newListeners = new Map(prev);
      if (!newListeners.has(event)) {
        newListeners.set(event, new Set());
      }
      newListeners.get(event)!.add(callback);
      return newListeners;
    });

    // Return cleanup function
    return () => {
      setEventListeners(prev => {
        const newListeners = new Map(prev);
        const eventSet = newListeners.get(event);
        if (eventSet) {
          eventSet.delete(callback);
          if (eventSet.size === 0) {
            newListeners.delete(event);
          }
        }
        return newListeners;
      });
    };
  }, []);

  // Update connection status periodically
  useEffect(() => {
    if (!mattermostClient) return;

    const interval = setInterval(() => {
      // The official client manages connection status internally
      // We rely on the callback events for status updates
      websocketLogger.debug('Connection status check', { 
        connected: mattermostClient.connected,
        connectionStatus 
      });
    }, 5000); // Check less frequently since status is event-driven

    return () => clearInterval(interval);
  }, [mattermostClient, connectionStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mattermostClient) {
        mattermostClient.disconnect();
        websocketLogger.info('WebSocketContext: Cleaned up on unmount');
      }
    };
  }, [mattermostClient]);

  const value: WebSocketContextType = {
    connectionStatus,
    isReconnecting: reconnectInfo.isReconnecting,
    reconnectAttempts: reconnectInfo.attempts,
    maxReconnectAttempts: reconnectInfo.maxAttempts,
    connect,
    disconnect,
    sendTyping,
    subscribeToChannel,
    unsubscribeFromChannel,
    addEventListener,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export default WebSocketContext;