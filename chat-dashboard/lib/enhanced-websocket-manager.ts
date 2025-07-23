import { MattermostWebSocketManager } from './websocket-manager';
import { activityProcessor } from './activity-processor';

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

interface EnhancedWebSocketConfig {
  url: string;
  token: string;
  onMessage?: (event: MattermostWebSocketEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  storeActivities?: boolean; // Enable/disable activity storage
}

/**
 * Enhanced WebSocket Manager that extends the basic manager with activity logging
 */
export class EnhancedWebSocketManager extends MattermostWebSocketManager {
  private storeActivities: boolean;
  private originalOnMessage?: (event: MattermostWebSocketEvent) => void;

  constructor(config: EnhancedWebSocketConfig) {
    // Store the original onMessage callback
    const originalOnMessage = config.onMessage;
    
    // Create enhanced onMessage that logs activities
    const enhancedOnMessage = async (event: MattermostWebSocketEvent) => {
      // Store activity if enabled
      if (config.storeActivities !== false) {
        await this.logWebSocketActivity(event);
      }
      
      // Call the original callback
      originalOnMessage?.(event);
    };

    // Call parent constructor with enhanced config
    super({
      ...config,
      onMessage: enhancedOnMessage
    });

    this.storeActivities = config.storeActivities !== false;
    this.originalOnMessage = originalOnMessage;
  }

  /**
   * Log WebSocket activity to Supabase
   */
  private async logWebSocketActivity(event: MattermostWebSocketEvent): Promise<void> {
    try {
      // Skip certain high-frequency events that don't need logging
      const skipEvents = ['ping', 'pong', 'typing', 'user_typing'];
      if (skipEvents.includes(event.event)) {
        return;
      }

      const eventType = this.mapEventType(event.event);
      const userId = event.data?.user_id || event.broadcast?.user_id;
      const channelId = event.data?.channel_id || event.broadcast?.channel_id;
      const teamId = event.data?.team_id || event.broadcast?.team_id;

      // Store the WebSocket event as an activity
      await activityProcessor.storeActivity({
        platform: 'mattermost',
        event_type: eventType,
        user_id: userId,
        channel_id: channelId,
        data: {
          websocket_event: event.event,
          websocket_data: event.data,
          broadcast: event.broadcast,
          seq: event.seq,
          team_id: teamId,
          timestamp: new Date().toISOString(),
          // Extract specific data fields based on event type
          ...this.extractEventSpecificData(event)
        }
      });

      console.log(`📡 WebSocket activity logged: ${eventType} (${event.event})`);

    } catch (error) {
      console.error('❌ Error logging WebSocket activity:', error);
    }
  }

  /**
   * Map Mattermost WebSocket event types to standardized activity types
   */
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
      'status_change': 'user_status_changed',
      'hello': 'websocket_connected',
      'preferences_changed': 'preferences_updated',
      'ephemeral_message': 'ephemeral_message',
      'channel_viewed': 'channel_viewed',
      'new_user': 'user_created'
    };

    return eventMap[websocketEvent] || websocketEvent;
  }

  /**
   * Extract event-specific data for better activity context
   */
  private extractEventSpecificData(event: MattermostWebSocketEvent): any {
    const eventData: any = {};

    switch (event.event) {
      case 'posted':
      case 'post_edited':
      case 'post_deleted':
        eventData.post_id = event.data?.post?.id;
        eventData.message = event.data?.post?.message;
        eventData.file_ids = event.data?.post?.file_ids;
        eventData.root_id = event.data?.post?.root_id;
        eventData.parent_id = event.data?.post?.parent_id;
        break;

      case 'channel_created':
      case 'channel_updated':
      case 'channel_deleted':
        eventData.channel_name = event.data?.channel?.name;
        eventData.channel_display_name = event.data?.channel?.display_name;
        eventData.channel_type = event.data?.channel?.type;
        break;

      case 'user_added':
      case 'user_removed':
        eventData.added_user_id = event.data?.user_id;
        eventData.added_by_user_id = event.data?.added_by_user_id;
        break;

      case 'reaction_added':
      case 'reaction_removed':
        eventData.reaction = event.data?.reaction;
        eventData.post_id = event.data?.post_id;
        break;

      case 'status_change':
        eventData.status = event.data?.status;
        eventData.user_id = event.data?.user_id;
        break;

      case 'preferences_changed':
        eventData.preferences = event.data?.preferences;
        break;

      default:
        // For unknown events, store all data
        eventData.raw_data = event.data;
    }

    return eventData;
  }

  /**
   * Enable or disable activity storage at runtime
   */
  setActivityStorage(enabled: boolean): void {
    this.storeActivities = enabled;
    console.log(`📡 WebSocket activity storage ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get activity storage status
   */
  isActivityStorageEnabled(): boolean {
    return this.storeActivities;
  }
}

// Static methods from parent class
export const EnhancedWebSocketManagerStatic = {
  testWebSocketConnection: MattermostWebSocketManager.testWebSocketConnection
};

export default EnhancedWebSocketManager;