-- Make execution_id nullable in task_sync_attempts since webhook deletions won't be tied to sync executions
ALTER TABLE task_sync_attempts ALTER COLUMN execution_id DROP NOT NULL;

-- Add a check constraint to ensure action_type includes the new "deleted" option
-- (Note: We can't directly ALTER an enum-like constraint, but since action_type is text, no additional constraint needed)