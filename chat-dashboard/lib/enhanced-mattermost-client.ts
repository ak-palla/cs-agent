/**
 * Enhanced Mattermost Client using official @mattermost/client library
 * Provides comprehensive logging and activity capture capabilities
 */

import { Client4, WebSocketClient } from '@mattermost/client';
import { mattermostLogger, websocketLogger, apiLogger } from './logger';

// Setup WebSocket for Node.js environment if needed
if (typeof globalThis !== 'undefined' && !globalThis.WebSocket && typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebSocket = require('ws');
    globalThis.WebSocket = WebSocket;
    websocketLogger.debug('WebSocket polyfill loaded for Node.js environment');
  } catch (error) {
    websocketLogger.warn('Failed to load WebSocket polyfill for Node.js', { error });
  }
}

export interface MattermostConfig {
  serverUrl: string;
  accessToken: string;
  onMessage?: (event: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
  onReconnect?: () => void;
}

export interface ActivityData {
  platform: 'mattermost';
  event_type: string;
  user_id?: string;
  channel_id?: string;
  data: Record<string, any>;
  timestamp?: string;
}

export class EnhancedMattermostClient {
  private client4: Client4;
  private wsClient: WebSocketClient;
  private config: MattermostConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private sessionId: string;

  constructor(config: MattermostConfig) {
    this.config = config;
    this.sessionId = Math.random().toString(36).substring(2, 15);
    
    mattermostLogger.info('Initializing Enhanced Mattermost Client', {
      serverUrl: config.serverUrl,
      sessionId: this.sessionId
    });

    // Initialize REST API client
    this.client4 = new Client4();
    this.client4.setUrl(config.serverUrl);
    this.client4.setToken(config.accessToken);

    // Initialize WebSocket client
    this.wsClient = new WebSocketClient();
    
    this.setupWebSocketEventHandlers();
  }

  private setupWebSocketEventHandlers(): void {
    websocketLogger.debug('Setting up WebSocket event handlers', {}, undefined, this.sessionId);

    this.wsClient.addMessageListener((msg) => {
      websocketLogger.websocketEvent(msg.event, msg.data, msg.data?.user_id);
      
      // Log all WebSocket events for debugging
      websocketLogger.debug('WebSocket message received', {
        event: msg.event,
        seq: msg.seq,
        data: msg.data
      }, msg.data?.user_id, this.sessionId);

      // Process the message for activity logging
      this.handleWebSocketMessage(msg);

      // Call custom message handler if provided
      if (this.config.onMessage) {
        try {
          this.config.onMessage(msg);
        } catch (error) {
          websocketLogger.error('Error in custom message handler', { error }, undefined, this.sessionId);
        }
      }
    });

    this.wsClient.addFirstConnectListener(() => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      websocketLogger.info('WebSocket connected successfully', {}, undefined, this.sessionId);
      
      if (this.config.onConnect) {
        this.config.onConnect();
      }
    });

    this.wsClient.addReconnectListener(() => {
      this.reconnectAttempts++;
      websocketLogger.info('WebSocket reconnected', {
        attempts: this.reconnectAttempts
      }, undefined, this.sessionId);
      
      if (this.config.onReconnect) {
        this.config.onReconnect();
      }
    });

    this.wsClient.addCloseListener((connectFailCount) => {
      this.isConnected = false;
      websocketLogger.warn('WebSocket connection closed', {
        connectFailCount,
        reconnectAttempts: this.reconnectAttempts
      }, undefined, this.sessionId);
      
      if (this.config.onDisconnect) {
        this.config.onDisconnect();
      }
    });

    this.wsClient.addErrorListener((event) => {
      websocketLogger.error('WebSocket error occurred', {
        error: event,
        isConnected: this.isConnected,
        reconnectAttempts: this.reconnectAttempts
      }, undefined, this.sessionId);
      
      if (this.config.onError) {
        this.config.onError(event);
      }
    });
  }

  private async handleWebSocketMessage(msg: any): Promise<void> {
    try {
      // Skip high-frequency events that don't need activity logging
      const skipEvents = ['ping', 'pong', 'typing', 'user_typing', 'status_change'];
      if (skipEvents.includes(msg.event)) {
        return;
      }

      const activityData: ActivityData = {
        platform: 'mattermost',
        event_type: this.mapEventType(msg.event),
        user_id: msg.data?.user_id || msg.broadcast?.user_id,
        channel_id: msg.data?.channel_id || msg.broadcast?.channel_id,
        data: {
          websocket_event: msg.event,
          websocket_data: msg.data,
          broadcast: msg.broadcast,
          seq: msg.seq,
          team_id: msg.data?.team_id || msg.broadcast?.team_id,
          timestamp: new Date().toISOString(),
          session_id: this.sessionId
        },
        timestamp: new Date().toISOString()
      };

      // Store activity via API route
      await this.storeActivity(activityData);

      mattermostLogger.info('Activity processed and stored', {
        event: msg.event,
        eventType: activityData.event_type,
        userId: activityData.user_id,
        channelId: activityData.channel_id
      }, activityData.user_id, this.sessionId);

    } catch (error) {
      mattermostLogger.error('Error handling WebSocket message', {
        error,
        event: msg.event,
        messageId: msg.seq
      }, undefined, this.sessionId);
    }
  }

  private mapEventType(websocketEvent: string): string {
    const eventMap: { [key: string]: string } = {
      'posted': 'message_created',
      'post_edited': 'message_updated',
      'post_deleted': 'message_deleted',
      'channel_created': 'channel_created',
      'channel_updated': 'channel_updated',
      'channel_deleted': 'channel_deleted',
      'direct_added': 'direct_message_created',
      'user_added': 'user_joined_channel',
      'user_removed': 'user_left_channel',
      'user_updated': 'user_updated',
      'member_role_updated': 'member_role_changed',
      'reaction_added': 'reaction_added',
      'reaction_removed': 'reaction_removed',
      'preferences_changed': 'preferences_updated',
      'ephemeral_message': 'ephemeral_message',
      'channel_viewed': 'channel_viewed',
      'new_user': 'user_created',
      'hello': 'websocket_connected'
    };

    return eventMap[websocketEvent] || websocketEvent;
  }

  private async storeActivity(activityData: ActivityData): Promise<void> {
    try {
      const startTime = Date.now();
      
      const response = await fetch('/api/admin/activities/store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activityData)
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        apiLogger.apiCall('POST', '/api/admin/activities/store', response.status, duration, activityData.user_id);
        mattermostLogger.debug('Activity stored successfully', {
          event: activityData.event_type,
          responseStatus: response.status,
          duration
        }, activityData.user_id, this.sessionId);
      } else {
        const errorText = await response.text();
        apiLogger.error('Failed to store activity', {
          status: response.status,
          error: errorText,
          duration
        }, activityData.user_id, this.sessionId);
      }
    } catch (error) {
      apiLogger.error('Error storing activity', {
        error: error instanceof Error ? error.message : error,
        activityType: activityData.event_type
      }, activityData.user_id, this.sessionId);
    }
  }

  async connect(): Promise<void> {
    try {
      mattermostLogger.info('Initiating connection to Mattermost server', {
        serverUrl: this.config.serverUrl
      }, undefined, this.sessionId);

      // Test REST API connectivity first
      const startTime = Date.now();
      
      // Suppress non-critical 404 errors from custom profile attributes
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        try {
          const response = await originalFetch(input, init);
          if (response.status === 404 && input.toString().includes('custom_profile_attributes')) {
            // Silently ignore custom profile attributes 404s
            return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return response;
        } catch (error) {
          return originalFetch(input, init);
        }
      };

      const user = await this.client4.getMe();
      
      // Restore original fetch
      globalThis.fetch = originalFetch;
      
      const apiDuration = Date.now() - startTime;
      
      apiLogger.apiCall('GET', '/api/v4/users/me', 200, apiDuration, user.id);
      mattermostLogger.info('REST API connection successful', {
        userId: user.id,
        username: user.username,
        duration: apiDuration
      }, user.id, this.sessionId);

      // Initialize WebSocket connection
      const wsUrl = `${this.config.serverUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/api/v4/websocket`;
      websocketLogger.info('Initializing WebSocket connection', {
        wsUrl: wsUrl.replace(this.config.accessToken, '***TOKEN***')
      }, user.id, this.sessionId);

      await this.wsClient.initialize(wsUrl, this.config.accessToken);
      
      mattermostLogger.info('Mattermost client connected successfully', {
        restApi: true,
        websocket: true,
        userId: user.id
      }, user.id, this.sessionId);

    } catch (error) {
      mattermostLogger.error('Failed to connect to Mattermost', {
        error: error instanceof Error ? error.message : error,
        serverUrl: this.config.serverUrl
      }, undefined, this.sessionId);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      mattermostLogger.info('Disconnecting from Mattermost server', {}, undefined, this.sessionId);
      
      if (this.wsClient) {
        this.wsClient.close();
      }
      
      this.isConnected = false;
      mattermostLogger.info('Disconnected successfully', {}, undefined, this.sessionId);
    } catch (error) {
      mattermostLogger.error('Error during disconnect', {
        error: error instanceof Error ? error.message : error
      }, undefined, this.sessionId);
    }
  }

  // REST API methods with logging
  async getUser(userId: string): Promise<any> {
    const startTime = Date.now();
    try {
      const user = await this.client4.getUser(userId);
      const duration = Date.now() - startTime;
      apiLogger.apiCall('GET', `/api/v4/users/${userId}`, 200, duration, userId);
      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      apiLogger.error('Failed to get user', {
        userId,
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  async getChannels(teamId: string): Promise<any[]> {
    const startTime = Date.now();
    try {
      const channels = await this.client4.getChannelsForTeam(teamId);
      const duration = Date.now() - startTime;
      apiLogger.apiCall('GET', `/api/v4/teams/${teamId}/channels`, 200, duration);
      return channels;
    } catch (error) {
      const duration = Date.now() - startTime;
      apiLogger.error('Failed to get channels', {
        teamId,
        error: error instanceof Error ? error.message : error,
        duration
      });
      throw error;
    }
  }

  // Getters for status information
  get connected(): boolean {
    return this.isConnected;
  }

  get client(): Client4 {
    return this.client4;
  }

  get websocketClient(): WebSocketClient {
    return this.wsClient;
  }
}

export default EnhancedMattermostClient;