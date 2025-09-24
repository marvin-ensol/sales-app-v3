-- One-time cleanup of old sync data (keeping only 5 days)
-- This migration calls the cleanup function to remove old records

-- Enable the pg_cron extension for scheduling (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the cleanup edge function
CREATE OR REPLACE FUNCTION cleanup_old_sync_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cutoff_date timestamptz;
    task_sync_deleted_count int;
    sync_exec_deleted_count int;
BEGIN
    -- Calculate cutoff date (5 days ago)
    cutoff_date := NOW() - INTERVAL '5 days';
    
    RAISE NOTICE 'Cleaning up sync data older than: %', cutoff_date;
    
    -- Delete from task_sync_attempts first (child records)
    DELETE FROM task_sync_attempts 
    WHERE created_at < cutoff_date;
    
    GET DIAGNOSTICS task_sync_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % task_sync_attempts records', task_sync_deleted_count;
    
    -- Delete from sync_executions (parent records)
    DELETE FROM sync_executions 
    WHERE created_at < cutoff_date;
    
    GET DIAGNOSTICS sync_exec_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % sync_executions records', sync_exec_deleted_count;
    
    RAISE NOTICE 'Cleanup complete. Total records deleted: %', 
                 task_sync_deleted_count + sync_exec_deleted_count;
END;
$$;

-- Schedule daily cleanup at 2 AM UTC
SELECT cron.schedule(
    'cleanup-old-sync-data',
    '0 2 * * *',
    'SELECT cleanup_old_sync_data();'
);

-- Run the initial cleanup now
SELECT cleanup_old_sync_data();