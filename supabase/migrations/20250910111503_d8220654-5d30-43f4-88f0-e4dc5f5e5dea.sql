-- Add task_details column to sync_executions for tracking task IDs
ALTER TABLE sync_executions 
ADD COLUMN task_details JSONB DEFAULT '{
  "fetched_task_ids": [],
  "processed_task_ids": [],
  "updated_task_ids": [],
  "failed_task_ids": [],
  "failed_details": []
}'::jsonb;