-- Remove the existing check constraint on action_type to allow "deleted" 
ALTER TABLE task_sync_attempts DROP CONSTRAINT IF EXISTS task_sync_attempts_action_type_check;

-- Add a new check constraint that includes "deleted" as a valid action_type
ALTER TABLE task_sync_attempts ADD CONSTRAINT task_sync_attempts_action_type_check 
CHECK (action_type IN ('created', 'updated', 'skipped', 'failed', 'unknown', 'completed', 'deleted'));