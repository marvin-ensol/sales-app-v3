-- Add action_type column to task_sync_attempts table
ALTER TABLE public.task_sync_attempts 
ADD COLUMN action_type text NOT NULL DEFAULT 'unknown';

-- Add a check constraint to ensure valid action types
ALTER TABLE public.task_sync_attempts 
ADD CONSTRAINT task_sync_attempts_action_type_check 
CHECK (action_type IN ('created', 'updated', 'skipped', 'failed', 'unknown'));