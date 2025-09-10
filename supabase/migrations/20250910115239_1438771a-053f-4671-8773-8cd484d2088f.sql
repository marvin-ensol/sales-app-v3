-- Drop the redundant id column and make execution_id the primary key
ALTER TABLE public.sync_executions DROP CONSTRAINT sync_executions_pkey;
ALTER TABLE public.sync_executions DROP COLUMN id;
ALTER TABLE public.sync_executions ADD PRIMARY KEY (execution_id);

-- Update task_sync_attempts to reference execution_id properly (if needed)
-- The table already uses execution_id as text, so no changes needed there