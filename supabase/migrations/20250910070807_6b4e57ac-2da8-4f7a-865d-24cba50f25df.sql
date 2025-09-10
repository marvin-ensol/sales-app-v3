-- Use only the cron.unschedule function to remove all jobs
-- This is the proper way to clean up cron jobs

SELECT cron.unschedule('background-task-sync-every-20-seconds');
SELECT cron.unschedule('hubspot-incremental-sync-45s'); 
SELECT cron.unschedule('incremental-hubspot-sync');
SELECT cron.unschedule('incremental-sync-30s');
SELECT cron.unschedule('invoke-incremental-sync-every-30-seconds');
SELECT cron.unschedule('sync-hubspot-owners-teams');