-- Migration to deduplicate activities and prevent future duplicates
-- This addresses the issue where the same message is stored multiple times

-- Step 1: Clean up existing duplicate activities
-- Keep only the earliest record for each unique message
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        platform, 
        user_id, 
        channel_id, 
        event_type,
        data->>'message_id'
      ORDER BY created_at ASC
    ) as row_num
  FROM activities 
  WHERE event_type = 'message_posted' 
    AND data->>'message_id' IS NOT NULL
),
to_delete AS (
  SELECT id 
  FROM duplicates 
  WHERE row_num > 1
)
DELETE FROM activities 
WHERE id IN (SELECT id FROM to_delete);

-- Step 2: Add message_id column for better indexing and constraints
ALTER TABLE activities 
ADD COLUMN message_id TEXT GENERATED ALWAYS AS (data->>'message_id') STORED;

-- Step 3: Create index on message_id for faster lookups
CREATE INDEX idx_activities_message_id ON activities(message_id) 
WHERE message_id IS NOT NULL;

-- Step 4: Create unique constraint to prevent future duplicates
-- This ensures the same message cannot be stored twice
CREATE UNIQUE INDEX idx_activities_unique_message 
ON activities (platform, event_type, message_id) 
WHERE message_id IS NOT NULL AND event_type = 'message_posted';

-- Step 5: Create unique constraint for non-message activities
-- This prevents duplicating other types of activities
CREATE UNIQUE INDEX idx_activities_unique_general
ON activities (platform, event_type, user_id, channel_id, (data::text), timestamp)
WHERE message_id IS NULL;

-- Step 6: Add a function to handle insert conflicts gracefully
CREATE OR REPLACE FUNCTION insert_activity_safe(
  p_platform platform_type,
  p_event_type TEXT,
  p_user_id TEXT,
  p_channel_id TEXT,
  p_data JSONB,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  activity_id UUID;
  message_id TEXT;
BEGIN
  -- Extract message_id if present
  message_id := p_data->>'message_id';
  
  -- Try to insert the activity
  INSERT INTO activities (platform, event_type, user_id, channel_id, data, timestamp)
  VALUES (p_platform, p_event_type, p_user_id, p_channel_id, p_data, p_timestamp)
  ON CONFLICT DO NOTHING
  RETURNING id INTO activity_id;
  
  -- If no conflict occurred, return the new ID
  IF activity_id IS NOT NULL THEN
    RETURN activity_id;
  END IF;
  
  -- If there was a conflict, find and return the existing record
  IF message_id IS NOT NULL AND p_event_type = 'message_posted' THEN
    SELECT id INTO activity_id
    FROM activities 
    WHERE platform = p_platform 
      AND event_type = p_event_type 
      AND message_id = message_id;
  ELSE
    SELECT id INTO activity_id
    FROM activities 
    WHERE platform = p_platform 
      AND event_type = p_event_type 
      AND COALESCE(user_id, '') = COALESCE(p_user_id, '')
      AND COALESCE(channel_id, '') = COALESCE(p_channel_id, '')
      AND data::text = p_data::text
      AND timestamp = p_timestamp;
  END IF;
  
  RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Update the existing trigger function to use the safe insert
-- This is a backup mechanism in case the application doesn't use the safe function
CREATE OR REPLACE FUNCTION prevent_duplicate_activities()
RETURNS TRIGGER AS $$
BEGIN
  -- For message_posted events, check if message already exists
  IF NEW.event_type = 'message_posted' AND NEW.data->>'message_id' IS NOT NULL THEN
    -- Check if this message_id already exists
    IF EXISTS (
      SELECT 1 FROM activities 
      WHERE platform = NEW.platform 
        AND event_type = NEW.event_type 
        AND data->>'message_id' = NEW.data->>'message_id'
    ) THEN
      -- Skip insertion for duplicate message
      RETURN NULL;
    END IF;
  END IF;
  
  -- Allow the insertion
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_activities ON activities;
CREATE TRIGGER trigger_prevent_duplicate_activities
  BEFORE INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_activities();

-- Step 8: Create a view for clean activity reporting
CREATE OR REPLACE VIEW clean_activities AS
SELECT 
  id,
  platform,
  event_type,
  user_id,
  channel_id,
  data,
  message_id,
  timestamp,
  processed,
  created_at,
  updated_at
FROM activities
ORDER BY created_at DESC;

-- Step 9: Add helpful statistics function
CREATE OR REPLACE FUNCTION get_activity_stats()
RETURNS TABLE(
  total_activities BIGINT,
  unique_messages BIGINT,
  duplicate_ratio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_activities,
    COUNT(DISTINCT message_id) FILTER (WHERE message_id IS NOT NULL) as unique_messages,
    CASE 
      WHEN COUNT(DISTINCT message_id) FILTER (WHERE message_id IS NOT NULL) > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE message_id IS NOT NULL)::NUMERIC / 
         COUNT(DISTINCT message_id) FILTER (WHERE message_id IS NOT NULL)::NUMERIC - 1) * 100, 
        2
      )
      ELSE 0
    END as duplicate_ratio
  FROM activities;
END;
$$ LANGUAGE plpgsql;

-- Log the cleanup results
DO $$
DECLARE
  stats RECORD;
BEGIN
  SELECT * INTO stats FROM get_activity_stats();
  RAISE NOTICE 'Activity deduplication complete. Total activities: %, Unique messages: %, Duplicate ratio: %%%', 
    stats.total_activities, stats.unique_messages, stats.duplicate_ratio;
END $$;