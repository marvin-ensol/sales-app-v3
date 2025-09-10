-- Remove tasks_processed column and add tasks_created column
ALTER TABLE sync_executions DROP COLUMN tasks_processed;
ALTER TABLE sync_executions ADD COLUMN tasks_created integer DEFAULT 0 NOT NULL;