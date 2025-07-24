import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { databaseLogger, mattermostLogger } from './logger';

export type PlatformType = 'mattermost' | 'trello' | 'flock';

export interface ActivityData {
  platform: PlatformType;
  event_type: string;
  user_id?: string;
  channel_id?: string;
  data: Record<string, any>;
  timestamp?: string;
}

export interface StandardizedActivity {
  id?: string;
  platform: PlatformType;
  event_type: string;
  user_id?: string;
  channel_id?: string;
  data: Record<string, any>;
  timestamp: string;
  processed: boolean;
}

/**
 * ServerActivityProcessor - Server-side version for API routes and webhooks
 */
export class ServerActivityProcessor {
  private async getSupabaseClient() {
    return await createClient();
  }

  private getServiceClient() {
    return createServiceClient();
  }

  /**
   * Store a platform activity in Supabase
   */
  async storeActivity(activityData: ActivityData): Promise<StandardizedActivity | null> {
    const startTime = Date.now();
    try {
      const supabase = this.getServiceClient(); // Use service client for system operations
      const standardizedActivity = this.standardizeActivity(activityData);
      
      mattermostLogger.debug('Storing activity', {
        platform: activityData.platform,
        eventType: activityData.event_type,
        userId: activityData.user_id,
        channelId: activityData.channel_id
      });

      const { data, error } = await supabase
        .from('activities')
        .insert(standardizedActivity)
        .select()
        .single();

      const duration = Date.now() - startTime;

      if (error) {
        databaseLogger.databaseOperation('INSERT', 'activities', false, duration, error);
        mattermostLogger.error('Error storing activity', { 
          error: error.message,
          code: error.code,
          activityType: activityData.event_type 
        });
        return null;
      }

      databaseLogger.databaseOperation('INSERT', 'activities', true, duration);
      mattermostLogger.info('Activity stored successfully', {
        activityId: data.id,
        eventType: data.event_type,
        platform: data.platform,
        duration
      });
      
      // Trigger workflow evaluation for this activity
      await this.evaluateWorkflowTriggers(data);
      
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      databaseLogger.databaseOperation('INSERT', 'activities', false, duration, error);
      mattermostLogger.error('Exception in storeActivity', { 
        error: error instanceof Error ? error.message : error,
        activityType: activityData.event_type 
      });
      return null;
    }
  }

  /**
   * Standardize activity data from different platforms into unified format
   */
  private standardizeActivity(activityData: ActivityData): Omit<StandardizedActivity, 'id'> {
    return {
      platform: activityData.platform,
      event_type: activityData.event_type,
      user_id: activityData.user_id,
      channel_id: activityData.channel_id,
      data: activityData.data,
      timestamp: activityData.timestamp || new Date().toISOString(),
      processed: false
    };
  }

  /**
   * Evaluate workflow triggers for a given activity
   */
  private async evaluateWorkflowTriggers(activity: StandardizedActivity): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get all enabled triggers for this platform and event type
      const { data: triggers, error } = await supabase
        .from('workflow_triggers')
        .select('*')
        .eq('platform', activity.platform)
        .eq('event_type', activity.event_type)
        .eq('enabled', true);

      if (error) {
        console.error('Error fetching workflow triggers:', error);
        return;
      }

      // Evaluate each trigger's conditions
      for (const trigger of triggers || []) {
        if (await this.evaluateConditions(activity, trigger.conditions)) {
          await this.executeWorkflow(trigger, activity);
        }
      }
    } catch (error) {
      console.error('Error evaluating workflow triggers:', error);
    }
  }

  /**
   * Evaluate if an activity matches trigger conditions
   */
  private async evaluateConditions(activity: StandardizedActivity, conditions: any): Promise<boolean> {
    try {
      if (!conditions || Object.keys(conditions).length === 0) {
        return true; // No conditions means always trigger
      }

      // Simple condition evaluation - can be extended for complex logic
      for (const [key, value] of Object.entries(conditions)) {
        switch (key) {
          case 'user_id':
            if (activity.user_id !== value) return false;
            break;
          case 'channel_id':
            if (activity.channel_id !== value) return false;
            break;
          case 'contains_text':
            const text = JSON.stringify(activity.data).toLowerCase();
            if (!text.includes(String(value).toLowerCase())) return false;
            break;
          case 'user_mention':
            const mentions = activity.data?.mentions || [];
            if (!mentions.includes(value)) return false;
            break;
          case 'keyword':
            const content = (activity.data?.message || activity.data?.text || '').toLowerCase();
            if (!content.includes(String(value).toLowerCase())) return false;
            break;
          default:
            // Check if the condition key exists in activity.data
            if (activity.data[key] !== value) return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error evaluating conditions:', error);
      return false;
    }
  }

  /**
   * Execute AI workflow for a triggered activity
   */
  private async executeWorkflow(trigger: any, activity: StandardizedActivity): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Create workflow execution record
      const { data: execution, error: executionError } = await supabase
        .from('workflow_executions')
        .insert({
          trigger_id: trigger.id,
          activity_id: activity.id,
          status: 'pending'
        })
        .select()
        .single();

      if (executionError) {
        console.error('Error creating workflow execution:', executionError);
        return;
      }

      console.log(`🤖 Executing workflow: ${trigger.name} for activity ${activity.id}`);

      // Update execution status to running
      await supabase
        .from('workflow_executions')
        .update({ status: 'running' })
        .eq('id', execution.id);

      const startTime = Date.now();

      try {
        // Execute AI agent based on configuration
        const result = await this.executeAIAgent(trigger.ai_agent_config, activity);
        const executionTime = Date.now() - startTime;

        // Update execution with success result
        await supabase
          .from('workflow_executions')
          .update({
            status: 'completed',
            result: result,
            execution_time_ms: executionTime,
            completed_at: new Date().toISOString()
          })
          .eq('id', execution.id);

        console.log(`✅ Workflow completed: ${trigger.name} (${executionTime}ms)`);

      } catch (aiError) {
        const executionTime = Date.now() - startTime;
        
        // Update execution with error
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            error_message: aiError instanceof Error ? aiError.message : String(aiError),
            execution_time_ms: executionTime,
            completed_at: new Date().toISOString()
          })
          .eq('id', execution.id);

        console.error(`❌ Workflow failed: ${trigger.name}`, aiError);
      }

    } catch (error) {
      console.error('Error executing workflow:', error);
    }
  }

  /**
   * Execute AI agent based on configuration
   */
  private async executeAIAgent(config: any, activity: StandardizedActivity): Promise<any> {
    // Placeholder for AI agent execution
    // This would integrate with your preferred AI service (OpenAI, Claude, etc.)
    
    const agentType = config.agent_type || 'default';
    const prompt = config.prompt || 'Process this activity';
    
    console.log(`🤖 Executing AI agent: ${agentType}`);
    console.log(`📝 Prompt: ${prompt}`);
    console.log(`📊 Activity data:`, activity);

    // Simulate AI processing
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          agent_type: agentType,
          processed_at: new Date().toISOString(),
          activity_summary: `Processed ${activity.platform} ${activity.event_type} event`,
          recommendations: ['Sample recommendation based on activity'],
          confidence: 0.85
        });
      }, 1000);
    });
  }

  /**
   * Get recent activities with pagination
   */
  async getRecentActivities(
    platform?: PlatformType,
    limit: number = 50,
    offset: number = 0
  ): Promise<StandardizedActivity[]> {
    try {
      const supabase = this.getServiceClient(); // Use service client for system queries
      
      let query = supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching activities:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecentActivities:', error);
      return [];
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<any> {
    try {
      const supabase = this.getServiceClient(); // Use service client for system queries
      
      const now = new Date();
      let startTime: Date;

      switch (timeframe) {
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const { data, error } = await supabase
        .from('activities')
        .select('platform, event_type, timestamp')
        .gte('timestamp', startTime.toISOString());

      if (error) {
        console.error('Error fetching activity stats:', error);
        return null;
      }

      // Process statistics
      const stats = {
        total: data?.length || 0,
        by_platform: {} as Record<string, number>,
        by_event_type: {} as Record<string, number>,
        timeframe
      };

      data?.forEach(activity => {
        // Count by platform
        stats.by_platform[activity.platform] = (stats.by_platform[activity.platform] || 0) + 1;
        
        // Count by event type
        stats.by_event_type[activity.event_type] = (stats.by_event_type[activity.event_type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error in getActivityStats:', error);
      return null;
    }
  }

  /**
   * Get workflow execution statistics
   */
  async getExecutionStats(): Promise<any> {
    try {
      const supabase = this.getServiceClient(); // Use service client for system queries
      
      const { data, error } = await supabase
        .from('workflow_executions')
        .select('status');

      if (error) {
        console.error('Error fetching execution stats:', error);
        return {
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0
        };
      }

      const stats = {
        total: data?.length || 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0
      };

      data?.forEach(execution => {
        stats[execution.status as keyof typeof stats]++;
      });

      return stats;
    } catch (error) {
      console.error('Error in getExecutionStats:', error);
      return {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0
      };
    }
  }
}

// Export singleton instance
export const serverActivityProcessor = new ServerActivityProcessor();