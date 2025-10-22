-- Unschedule the incremental sync cron job to disable regular polling
SELECT cron.unschedule('incremental-sync-every-minute');

-- Verify the job has been unscheduled (optional check query for logs)
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%sync%';