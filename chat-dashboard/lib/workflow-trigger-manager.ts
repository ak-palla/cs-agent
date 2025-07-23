import { createClient } from '@/lib/supabase/client';

export type PlatformType = 'mattermost' | 'trello' | 'flock';

export interface WorkflowTrigger {
  id?: string;
  name: string;
  description?: string;
  platform: PlatformType;
  event_type: string;
  conditions: TriggerConditions;
  ai_agent_config: AIAgentConfig;
  enabled: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TriggerConditions {
  // User-based conditions
  user_id?: string;
  user_mention?: string;
  
  // Channel-based conditions
  channel_id?: string;
  channel_name?: string;
  
  // Content-based conditions
  contains_text?: string;
  keyword?: string;
  message_type?: string;
  
  // Time-based conditions
  time_range?: {
    start: string;
    end: string;
  };
  
  // Logical operators
  and?: TriggerConditions[];
  or?: TriggerConditions[];
  not?: TriggerConditions;
}

export interface AIAgentConfig {
  agent_type: 'openai' | 'claude' | 'gemini' | 'custom';
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: 'text' | 'json';
  actions?: AIAgentAction[];
}

export interface AIAgentAction {
  type: 'send_message' | 'create_card' | 'notify_user' | 'update_status' | 'custom_webhook';
  config: any;
}

/**
 * WorkflowTriggerManager - Manages AI workflow triggers and execution
 */
export class WorkflowTriggerManager {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a new workflow trigger
   */
  async createTrigger(trigger: Omit<WorkflowTrigger, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowTrigger | null> {
    try {
      const { data, error } = await this.supabase
        .from('workflow_triggers')
        .insert({
          name: trigger.name,
          description: trigger.description,
          platform: trigger.platform,
          event_type: trigger.event_type,
          conditions: trigger.conditions,
          ai_agent_config: trigger.ai_agent_config,
          enabled: trigger.enabled,
          created_by: trigger.created_by
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating workflow trigger:', error);
        return null;
      }

      console.log(`✅ Workflow trigger created: ${trigger.name}`);
      return data;
    } catch (error) {
      console.error('Error in createTrigger:', error);
      return null;
    }
  }

  /**
   * Get all workflow triggers with optional filtering
   */
  async getTriggers(platform?: PlatformType, enabled?: boolean): Promise<WorkflowTrigger[]> {
    try {
      let query = this.supabase
        .from('workflow_triggers')
        .select('*')
        .order('created_at', { ascending: false });

      if (platform) {
        query = query.eq('platform', platform);
      }

      if (enabled !== undefined) {
        query = query.eq('enabled', enabled);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching workflow triggers:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getTriggers:', error);
      return [];
    }
  }

  /**
   * Update a workflow trigger
   */
  async updateTrigger(id: string, updates: Partial<WorkflowTrigger>): Promise<WorkflowTrigger | null> {
    try {
      const { data, error } = await this.supabase
        .from('workflow_triggers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating workflow trigger:', error);
        return null;
      }

      console.log(`✅ Workflow trigger updated: ${id}`);
      return data;
    } catch (error) {
      console.error('Error in updateTrigger:', error);
      return null;
    }
  }

  /**
   * Delete a workflow trigger
   */
  async deleteTrigger(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('workflow_triggers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting workflow trigger:', error);
        return false;
      }

      console.log(`✅ Workflow trigger deleted: ${id}`);
      return true;
    } catch (error) {
      console.error('Error in deleteTrigger:', error);
      return false;
    }
  }

  /**
   * Toggle trigger enabled/disabled status
   */
  async toggleTrigger(id: string): Promise<WorkflowTrigger | null> {
    try {
      // First get the current trigger
      const { data: currentTrigger, error: fetchError } = await this.supabase
        .from('workflow_triggers')
        .select('enabled')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching trigger:', fetchError);
        return null;
      }

      // Toggle the enabled status
      const newEnabled = !currentTrigger.enabled;
      
      return await this.updateTrigger(id, { enabled: newEnabled });
    } catch (error) {
      console.error('Error in toggleTrigger:', error);
      return null;
    }
  }

  /**
   * Get workflow execution statistics
   */
  async getExecutionStats(triggerId?: string): Promise<any> {
    try {
      let query = this.supabase
        .from('workflow_executions')
        .select('status, execution_time_ms, created_at');

      if (triggerId) {
        query = query.eq('trigger_id', triggerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching execution stats:', error);
        return null;
      }

      // Process statistics
      const stats = {
        total: data?.length || 0,
        by_status: {} as Record<string, number>,
        avg_execution_time: 0,
        success_rate: 0
      };

      if (data && data.length > 0) {
        // Count by status
        data.forEach(execution => {
          stats.by_status[execution.status] = (stats.by_status[execution.status] || 0) + 1;
        });

        // Calculate average execution time
        const executionTimes = data
          .filter(e => e.execution_time_ms)
          .map(e => e.execution_time_ms);
        
        if (executionTimes.length > 0) {
          stats.avg_execution_time = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
        }

        // Calculate success rate
        const completed = stats.by_status['completed'] || 0;
        stats.success_rate = stats.total > 0 ? (completed / stats.total) * 100 : 0;
      }

      return stats;
    } catch (error) {
      console.error('Error in getExecutionStats:', error);
      return null;
    }
  }

  /**
   * Create sample workflow triggers for demonstration
   */
  async createSampleTriggers(): Promise<void> {
    const sampleTriggers: Omit<WorkflowTrigger, 'id' | 'created_at' | 'updated_at'>[] = [
      {
        name: 'Support Mention Alert',
        description: 'Notify support team when @support is mentioned',
        platform: 'mattermost',
        event_type: 'message_created',
        conditions: {
          user_mention: 'support'
        },
        ai_agent_config: {
          agent_type: 'openai',
          model: 'gpt-3.5-turbo',
          prompt: 'A user mentioned @support. Analyze the message and create a support ticket summary.',
          actions: [
            {
              type: 'notify_user',
              config: {
                channel: 'support-alerts',
                message: 'New support request detected'
              }
            }
          ]
        },
        enabled: true
      },
      {
        name: 'Bug Report Card Creator',
        description: 'Create Trello card when bug is reported',
        platform: 'mattermost',
        event_type: 'message_created',
        conditions: {
          contains_text: 'bug report'
        },
        ai_agent_config: {
          agent_type: 'openai',
          model: 'gpt-3.5-turbo',
          prompt: 'Extract bug details from this message and create a structured bug report.',
          actions: [
            {
              type: 'create_card',
              config: {
                board_id: 'bug-reports',
                list_id: 'new-bugs'
              }
            }
          ]
        },
        enabled: true
      },
      {
        name: 'Task Completion Tracker',
        description: 'Track when cards are moved to Done',
        platform: 'trello',
        event_type: 'updateCard',
        conditions: {
          and: [
            { contains_text: 'listAfter' },
            { contains_text: 'Done' }
          ]
        },
        ai_agent_config: {
          agent_type: 'openai',
          model: 'gpt-3.5-turbo',
          prompt: 'Analyze the completed task and generate insights about productivity.',
          actions: [
            {
              type: 'send_message',
              config: {
                channel: 'project-updates',
                message: 'Task completed analysis'
              }
            }
          ]
        },
        enabled: true
      }
    ];

    for (const trigger of sampleTriggers) {
      await this.createTrigger(trigger);
    }

    console.log(`✅ Created ${sampleTriggers.length} sample workflow triggers`);
  }
}

// Export singleton instance
export const workflowTriggerManager = new WorkflowTriggerManager();