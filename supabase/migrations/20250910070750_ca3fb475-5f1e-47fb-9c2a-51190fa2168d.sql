-- Delete ALL existing cron jobs by their exact job IDs and names
-- This ensures we completely clean the slate

-- Unschedule all sync-related jobs by exact name
SELECT cron.unschedule('background-task-sync-every-20-seconds');
SELECT cron.unschedule('hubspot-incremental-sync-45s'); 
SELECT cron.unschedule('incremental-hubspot-sync');
SELECT cron.unschedule('incremental-sync-30s');
SELECT cron.unschedule('invoke-incremental-sync-every-30-seconds');
SELECT cron.unschedule('sync-hubspot-owners-teams');

-- Also delete by job IDs to ensure they're completely gone
DELETE FROM cron.job WHERE jobid IN (1, 2, 3, 4, 5, 7);

-- Verify all sync-related cron jobs are deleted
-- (This query will show remaining jobs for verification)