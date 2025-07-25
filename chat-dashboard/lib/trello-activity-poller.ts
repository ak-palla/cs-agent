/**
 * Trello Activity Poller
 * 
 * Provides polling-based activity monitoring for Trello boards
 * as an alternative to webhooks for localhost development
 */

import { ActivityData } from './activity-processor';

export interface PollingConfig {
  interval: number; // milliseconds
  enabled: boolean;
  boardIds: string[];
}

export interface ActivitySyncState {
  boardId: string;
  lastSyncTimestamp: string;
  isPolling: boolean;
  lastError?: string;
}

export class TrelloActivityPoller {
  private config: PollingConfig;
  private syncStates: Map<string, ActivitySyncState>;
  private pollingIntervals: Map<string, NodeJS.Timeout>;
  private isAuthenticated: boolean;

  constructor(config: Partial<PollingConfig> = {}) {
    this.config = {
      interval: 30000, // 30 seconds default
      enabled: true,
      boardIds: [],
      ...config
    };
    this.syncStates = new Map();
    this.pollingIntervals = new Map();
    this.isAuthenticated = false;
  }

  /**
   * Start polling for a specific board
   */
  async startPolling(boardId: string): Promise<void> {
    if (!this.config.enabled) {
      console.log('📊 Polling disabled for Trello activities');
      return;
    }

    // Initialize sync state if not exists
    if (!this.syncStates.has(boardId)) {
      this.syncStates.set(boardId, {
        boardId,
        lastSyncTimestamp: new Date().toISOString(),
        isPolling: false
      });
    }

    const syncState = this.syncStates.get(boardId)!;
    
    if (syncState.isPolling) {
      console.log(`📊 Already polling board ${boardId}`);
      return;
    }

    console.log(`📊 Starting activity polling for board ${boardId}`);
    syncState.isPolling = true;

    // Perform initial sync
    await this.syncBoardActivities(boardId);

    // Set up recurring polling
    const intervalId = setInterval(async () => {
      await this.syncBoardActivities(boardId);
    }, this.config.interval);

    this.pollingIntervals.set(boardId, intervalId);
  }

  /**
   * Stop polling for a specific board
   */
  stopPolling(boardId: string): void {
    const intervalId = this.pollingIntervals.get(boardId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(boardId);
    }

    const syncState = this.syncStates.get(boardId);
    if (syncState) {
      syncState.isPolling = false;
    }

    console.log(`📊 Stopped activity polling for board ${boardId}`);
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    this.pollingIntervals.forEach((intervalId, boardId) => {
      this.stopPolling(boardId);
    });
    console.log('📊 Stopped all Trello activity polling');
  }

  /**
   * Manually sync activities for a board
   */
  async syncBoardActivities(boardId: string): Promise<void> {
    try {
      console.log(`🔄 Syncing activities for board ${boardId}`);

      const syncState = this.syncStates.get(boardId);
      if (!syncState) {
        console.error(`❌ No sync state found for board ${boardId}`);
        return;
      }

      // Build query parameters for API call
      const params = new URLSearchParams({
        since: syncState.lastSyncTimestamp,
        limit: '50' // Reasonable limit to avoid overwhelming
      });

      // Fetch actions via API route (which handles OAuth properly)
      const response = await fetch(`/api/trello/boards/${boardId}/actions?${params.toString()}`, {
        credentials: 'include' // Include cookies for authentication
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch actions: ${response.status}`);
      }

      const actionsData = await response.json();
      const actions = actionsData.data || [];

      console.log(`📦 Found ${actions.length} new actions for board ${boardId}`);

      // Process each action as activity
      for (const action of actions) {
        const activityData: ActivityData = {
          platform: 'trello',
          event_type: action.type,
          user_id: action.idMemberCreator,
          channel_id: boardId, // Use board ID as channel
          data: {
            action_id: action.id,
            action_type: action.type,
            action_date: action.date,
            member_creator: action.memberCreator,
            action_data: action.data,
            board_id: boardId,
            // Enhanced data for better display
            card_name: (action.data?.card?.name || ''),
            card_id: (action.data?.card?.id || ''),
            list_name: (action.data?.list?.name || action.data?.listAfter?.name || action.data?.listBefore?.name || ''),
            board_name: (action.data?.board?.name || ''),
            text: (action.data?.text || ''), // For comments
            member_name: (action.memberCreator?.fullName || action.memberCreator?.username || '')
          },
          timestamp: action.date
        };

        // Store activity via server-side API
        try {
          const storeResponse = await fetch('/api/activities/store', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(activityData)
          });

          if (!storeResponse.ok) {
            const errorData = await storeResponse.json();
            console.error('❌ Failed to store activity:', errorData);
          } else {
            const result = await storeResponse.json();
            console.log('✅ Activity stored:', result.data?.id);
          }
        } catch (storeError) {
          console.error('❌ Error storing activity:', storeError);
        }
      }

      // Update sync timestamp
      syncState.lastSyncTimestamp = new Date().toISOString();
      syncState.lastError = undefined;

      console.log(`✅ Successfully synced ${actions.length} activities for board ${boardId}`);

    } catch (error) {
      console.error(`❌ Error syncing activities for board ${boardId}:`, error);
      
      const syncState = this.syncStates.get(boardId);
      if (syncState) {
        syncState.lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }
  }

  /**
   * Get sync state for a board
   */
  getSyncState(boardId: string): ActivitySyncState | undefined {
    return this.syncStates.get(boardId);
  }

  /**
   * Get all sync states
   */
  getAllSyncStates(): ActivitySyncState[] {
    return Array.from(this.syncStates.values());
  }

  /**
   * Update polling interval
   */
  setPollingInterval(interval: number): void {
    this.config.interval = interval;
    console.log(`📊 Updated polling interval to ${interval}ms`);
  }

  /**
   * Enable/disable polling globally
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stopAllPolling();
    }
    console.log(`📊 Polling ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): PollingConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const trelloActivityPoller = new TrelloActivityPoller();