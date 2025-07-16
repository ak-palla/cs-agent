'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import MattermostWebSocketManager from '@/lib/websocket-manager';

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
  const [wsManager, setWsManager] = useState<MattermostWebSocketManager | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [reconnectInfo, setReconnectInfo] = useState({
    isReconnecting: false,
    attempts: 0,
    maxAttempts: 3,
  });

  // Event listeners management
  const [eventListeners, setEventListeners] = useState<Map<string, Set<(data: any) => void>>>(new Map());

  const connect = useCallback(async (url: string, token: string) => {
    if (wsManager) {
      console.log('Disconnecting existing WebSocket manager');
      wsManager.disconnect();
      setWsManager(null);
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('Creating new WebSocket manager');
    const manager = new MattermostWebSocketManager({
      url,
      token,
      onConnect: () => {
        setConnectionStatus('connected');
        setReconnectInfo(prev => ({ ...prev, isReconnecting: false, attempts: 0 }));
      },
      onDisconnect: () => {
        setConnectionStatus('disconnected');
        const info = manager.getReconnectInfo();
        setReconnectInfo({
          isReconnecting: info.isReconnecting,
          attempts: info.attempts,
          maxAttempts: info.maxAttempts,
        });
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        // Provide more user-friendly error handling
        if (error instanceof Error) {
          if (error.message.includes('CORS')) {
            console.warn('CORS issue detected. Consider using polling mode or configuring CORS on the server.');
          }
        }
      },
      onMessage: (event) => {
        // Dispatch to event listeners
        const listeners = eventListeners.get(event.event);
        if (listeners) {
          listeners.forEach(callback => {
            try {
              callback(event.data);
            } catch (error) {
              console.error('Error in WebSocket event listener:', error);
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
              console.error('Error in WebSocket event listener:', error);
            }
          });
        }
      },
    });

    setWsManager(manager);
    setConnectionStatus('connecting');
    
    try {
      await manager.connect();
    } catch (error) {
      setConnectionStatus('disconnected');
      throw error;
    }
  }, [wsManager, eventListeners]);

  const disconnect = useCallback(() => {
    if (wsManager) {
      wsManager.disconnect();
      setWsManager(null);
    }
    setConnectionStatus('disconnected');
    setReconnectInfo({ isReconnecting: false, attempts: 0, maxAttempts: 3 });
  }, [wsManager]);

  const sendTyping = useCallback((channelId: string, parentId?: string) => {
    if (wsManager && connectionStatus === 'connected') {
      wsManager.sendTyping(channelId, parentId);
    }
  }, [wsManager, connectionStatus]);

  const subscribeToChannel = useCallback((channelId: string) => {
    if (wsManager && connectionStatus === 'connected') {
      wsManager.subscribeToChannel(channelId);
    }
  }, [wsManager, connectionStatus]);

  const unsubscribeFromChannel = useCallback((channelId: string) => {
    if (wsManager && connectionStatus === 'connected') {
      wsManager.unsubscribeFromChannel(channelId);
    }
  }, [wsManager, connectionStatus]);

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
    if (!wsManager) return;

    const interval = setInterval(() => {
      const status = wsManager.getConnectionStatus();
      setConnectionStatus(status);
      
      const info = wsManager.getReconnectInfo();
      setReconnectInfo({
        isReconnecting: info.isReconnecting,
        attempts: info.attempts,
        maxAttempts: info.maxAttempts,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [wsManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsManager) {
        wsManager.disconnect();
      }
    };
  }, [wsManager]);

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