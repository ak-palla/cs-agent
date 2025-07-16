interface MattermostWebSocketEvent {
  event: string;
  data: any;
  broadcast: {
    omit_users?: { [key: string]: boolean };
    user_id?: string;
    channel_id?: string;
    team_id?: string;
  };
  seq: number;
}

interface WebSocketConfig {
  url: string;
  token: string;
  onMessage?: (event: MattermostWebSocketEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class MattermostWebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private messageQueue: string[] = [];
  private seq = 1;
  private connectionResolver: ((value: void | PromiseLike<void>) => void) | null = null;
  private websocketDisabled = false; // Flag to permanently disable WebSocket
  private instanceId = Math.random().toString(36).substr(2, 9); // Unique instance ID

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectDelay: parseInt(process.env.NEXT_PUBLIC_RECONNECT_DELAY || '3000'),
      maxReconnectAttempts: parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS || '3'),
      ...config,
    };
    
    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_WEBSOCKET === 'true';
    if (debugEnabled) {
      console.log(`WebSocket Manager ${this.instanceId} created with config:`, {
        reconnectDelay: this.config.reconnectDelay,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        websocketEnabled: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true'
      });
    }
  }

  connect(): Promise<void> {
    // If WebSocket is permanently disabled, reject immediately
    if (this.websocketDisabled) {
      return Promise.reject(new Error('WebSocket permanently disabled due to CORS issues'));
    }

    return new Promise((resolve, reject) => {
      this.connectionResolver = resolve;
      
      // Add connection timeout
      const timeoutMs = parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_TIMEOUT || '10000');
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.error(`WebSocket connection timeout after ${timeoutMs}ms`);
          this.websocketDisabled = true; // Disable on timeout
          this.ws.close();
          reject(new Error(`WebSocket connection timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      
      try {
        // Convert HTTP URL to WebSocket URL
        let wsUrl = this.config.url;
        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
          wsUrl = wsUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        }
        if (!wsUrl.endsWith('/api/v4/websocket')) {
          wsUrl = wsUrl.replace(/\/$/, '') + '/api/v4/websocket';
        }

        console.log(`[${this.instanceId}] Connecting to WebSocket:`, wsUrl);
        
        // Test WebSocket URL accessibility first
        try {
          const urlTest = new URL(wsUrl);
          console.log('WebSocket URL components:', {
            protocol: urlTest.protocol,
            host: urlTest.host,
            pathname: urlTest.pathname
          });
        } catch (urlError) {
          console.error('Invalid WebSocket URL:', wsUrl, urlError);
          clearTimeout(connectionTimeout);
          this.websocketDisabled = true;
          throw new Error(`Invalid WebSocket URL: ${wsUrl}`);
        }
        
        console.log('Creating WebSocket instance...');
        try {
          // Add authentication token as query parameter for better CORS handling
          const authUrl = `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.config.token)}`;
          this.ws = new WebSocket(authUrl);
          console.log('WebSocket instance created, readyState:', this.ws.readyState);
        } catch (wsCreationError) {
          console.error('Failed to create WebSocket instance:', wsCreationError);
          clearTimeout(connectionTimeout);
          this.websocketDisabled = true;
          reject(new Error(`Failed to create WebSocket: ${wsCreationError.message}`));
          return;
        }

        this.ws.onopen = () => {
          console.log('WebSocket connected, waiting for server status...');
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Don't authenticate immediately, wait for server to send status
          // Process queued messages
          this.processMessageQueue();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message:', message);
            
            // Mattermost sends various message types, ensure we handle them properly
            if (message.event || message.status) {
              this.handleMessage(message);
            } else {
              console.log('Unknown message format:', message);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error, 'Raw data:', event.data);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            url: wsUrl
          });
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          this.config.onDisconnect?.();
          
          // Check for CORS-related close codes
          if (event.code === 1006 && !event.wasClean) {
            console.error('WebSocket connection failed - likely CORS issue. Permanently disabling WebSocket.');
            this.websocketDisabled = true; // Permanently disable WebSocket
            this.reconnectAttempts = this.config.maxReconnectAttempts!; // Stop retrying
            if (this.connectionResolver) {
              reject(new Error('WebSocket connection failed - CORS configuration needed on Mattermost server for localhost development'));
              this.connectionResolver = null;
            }
            return;
          }
          
          if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
            this.scheduleReconnect();
          } else if (this.connectionResolver) {
            reject(new Error(`WebSocket connection closed: ${event.code} ${event.reason}`));
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error details:', {
            error,
            url: wsUrl,
            readyState: this.ws?.readyState,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            origin: window.location.origin
          });
          clearTimeout(connectionTimeout);
          this.config.onError?.(error);
          
          // Provide more specific error messages based on common issues
          let errorMessage = `WebSocket connection failed to ${wsUrl}`;
          
          // Check for CORS issues
          if (window.location.protocol === 'http:' && wsUrl.startsWith('wss:')) {
            errorMessage += ' - Mixed content issue: Cannot use secure WebSocket (wss) from insecure origin (http)';
          } else if (window.location.origin.includes('localhost')) {
            errorMessage += ' - CORS configuration needed on Mattermost server for localhost development';
          }
          
          // Don't reject here if we already disabled WebSocket
          if (!this.websocketDisabled && this.connectionResolver) {
            this.websocketDisabled = true; // Disable on any error
            reject(new Error(errorMessage));
            this.connectionResolver = null;
          }
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  private authenticate() {
    // Skip authentication via message if token is already in URL
    const authMessage = {
      seq: this.seq++,
      action: 'authentication_challenge',
      data: {
        token: this.config.token,
      },
    };
    
    console.log('Sending authentication challenge:', authMessage);
    this.sendMessage(JSON.stringify(authMessage));
  }

  private handleMessage(message: any) {
    console.log('Received WebSocket message:', message);
    
    // Handle initial connection response
    if (message.status === 'OK' && !message.event) {
      console.log('WebSocket connected successfully, sending authentication...');
      this.authenticate();
      this.config.onConnect?.();
      return;
    }

    // Handle authentication response
    if (message.event === 'hello') {
      console.log('WebSocket authentication successful');
      if (this.connectionResolver) {
        this.connectionResolver();
        this.connectionResolver = null;
      }
      return;
    }

    // Handle authentication status response
    if (message.status) {
      if (message.status === 'OK') {
        console.log('Authentication successful');
      } else {
        console.error('Authentication failed:', message);
      }
      return;
    }

    // Handle regular events
    if (message.event) {
      const mattermostEvent: MattermostWebSocketEvent = {
        event: message.event,
        data: message.data,
        broadcast: message.broadcast || {},
        seq: message.seq || 0,
      };
      
      // Pass message to the callback
      this.config.onMessage?.(mattermostEvent);
    }
  }

  private scheduleReconnect() {
    // Don't reconnect if WebSocket is permanently disabled
    if (this.websocketDisabled) {
      console.log(`[${this.instanceId}] WebSocket reconnect skipped - permanently disabled`);
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[${this.instanceId}] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      console.log(`[${this.instanceId}] Reconnect attempt ${this.reconnectAttempts}`);
      this.connect().catch(() => {
        // If connection fails, it will schedule another reconnect (unless disabled)
      });
    }, delay);
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      }
    }
  }

  sendMessage(message: string) {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }

  // Send typing indicator
  sendTyping(channelId: string, parentId?: string) {
    const typingMessage = {
      seq: this.seq++,
      action: 'user_typing',
      data: {
        channel_id: channelId,
        parent_id: parentId,
      },
    };
    
    this.sendMessage(JSON.stringify(typingMessage));
  }

  // Subscribe to channel events
  subscribeToChannel(channelId: string) {
    const subscribeMessage = {
      seq: this.seq++,
      action: 'subscribe',
      data: {
        channel_id: channelId,
      },
    };
    
    this.sendMessage(JSON.stringify(subscribeMessage));
  }

  // Unsubscribe from channel events
  unsubscribeFromChannel(channelId: string) {
    const unsubscribeMessage = {
      seq: this.seq++,
      action: 'unsubscribe',
      data: {
        channel_id: channelId,
      },
    };
    
    this.sendMessage(JSON.stringify(unsubscribeMessage));
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }

  disconnect() {
    console.log(`[${this.instanceId}] Disconnecting WebSocket manager`);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.websocketDisabled = true; // Disable this instance permanently
  }

  // Check if WebSocket is permanently disabled
  isWebSocketDisabled(): boolean {
    return this.websocketDisabled;
  }

  // Get reconnection info
  getReconnectInfo() {
    return {
      attempts: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts!,
      isReconnecting: this.reconnectTimer !== null,
    };
  }

  // Static method to test WebSocket connectivity
  static async testWebSocketConnection(url: string, token: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Convert HTTP URL to WebSocket URL
        let wsUrl = url;
        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
          wsUrl = wsUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        }
        if (!wsUrl.endsWith('/api/v4/websocket')) {
          wsUrl = wsUrl.replace(/\/$/, '') + '/api/v4/websocket';
        }

        // Add token as query parameter
        const authUrl = `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        
        const testWs = new WebSocket(authUrl);
        let resolved = false;

        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            testWs.close();
          }
        };

        testWs.onopen = () => {
          if (!resolved) {
            resolved = true;
            testWs.close();
            resolve(true);
          }
        };

        testWs.onerror = () => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        };

        testWs.onclose = () => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            testWs.close();
            resolve(false);
          }
        }, 5000);

      } catch {
        resolve(false);
      }
    });
  }
}

export default MattermostWebSocketManager;