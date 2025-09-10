-- Drop the sync_metadata table as it's redundant with sync_executions
-- All sync tracking is now consolidated in sync_executions table

DROP TABLE IF EXISTS public.sync_metadata;