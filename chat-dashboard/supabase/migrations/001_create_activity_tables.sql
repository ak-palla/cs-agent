-- Create enum types for platform and status values
CREATE TYPE platform_type AS ENUM ('mattermost', 'trello', 'flock');
CREATE TYPE admin_role_type AS ENUM ('admin', 'support', 'viewer');
CREATE TYPE execution_status_type AS ENUM ('pending', 'running', 'completed', 'failed');

-- Platform activities table - stores all activities from integrated platforms
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform platform_type NOT NULL,
    event_type TEXT NOT NULL,
    user_id TEXT,
    channel_id TEXT,
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI workflow triggers table - defines conditions and AI agent configurations
CREATE TABLE workflow_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    platform platform_type NOT NULL,
    event_type TEXT NOT NULL,
    conditions JSONB DEFAULT '{}', -- JSON conditions/filters for trigger matching
    ai_agent_config JSONB DEFAULT '{}', -- AI agent settings and configuration
    enabled BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow executions log - tracks AI workflow executions and results
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID REFERENCES workflow_triggers(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    status execution_status_type DEFAULT 'pending',
    result JSONB DEFAULT '{}',
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Admin users and permissions - manages dashboard access and roles
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role admin_role_type DEFAULT 'viewer',
    permissions JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_activities_platform_timestamp ON activities(platform, timestamp DESC);
CREATE INDEX idx_activities_event_type ON activities(event_type);
CREATE INDEX idx_activities_processed ON activities(processed);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_channel_id ON activities(channel_id);

CREATE INDEX idx_workflow_triggers_platform ON workflow_triggers(platform);
CREATE INDEX idx_workflow_triggers_event_type ON workflow_triggers(event_type);
CREATE INDEX idx_workflow_triggers_enabled ON workflow_triggers(enabled);

CREATE INDEX idx_workflow_executions_trigger_id ON workflow_executions(trigger_id);
CREATE INDEX idx_workflow_executions_activity_id ON workflow_executions(activity_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_created_at ON workflow_executions(created_at DESC);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_triggers_updated_at BEFORE UPDATE ON workflow_triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for activities table
CREATE POLICY "Activities are viewable by admin users" ON activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'support', 'viewer')
        )
    );

CREATE POLICY "Activities can be inserted by system" ON activities
    FOR INSERT WITH CHECK (true); -- Allow system to insert activities

-- Create RLS policies for workflow_triggers table
CREATE POLICY "Workflow triggers are manageable by admin users" ON workflow_triggers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'support')
        )
    );

-- Create RLS policies for workflow_executions table
CREATE POLICY "Workflow executions are viewable by admin users" ON workflow_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'support', 'viewer')
        )
    );

CREATE POLICY "Workflow executions can be inserted by system" ON workflow_executions
    FOR INSERT WITH CHECK (true); -- Allow system to insert executions

-- Create RLS policies for admin_users table
CREATE POLICY "Admin users can view themselves and admins can view all" ON admin_users
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can manage admin users" ON admin_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Insert initial admin user (replace with actual admin user ID)
-- This should be updated after the first admin user is created
-- INSERT INTO admin_users (user_id, role, permissions, created_by) 
-- VALUES ('admin-user-uuid-here', 'admin', '{"full_access": true}', 'admin-user-uuid-here');