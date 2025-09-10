-- Clean up stuck sync executions and delete ALL cron jobs for clean slate
-- First, mark all currently running sync executions as failed
UPDATE sync_executions 
SET 
  status = 'failed',
  error_message = 'Execution timed out - cleaned up during concurrency fix',
  completed_at = now(),
  duration_ms = EXTRACT(epoch FROM (now() - started_at)) * 1000
WHERE status = 'running';

-- Delete ALL cron jobs to start from a clean slate
-- This ensures no old jobs are lingering
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname IS NOT NULL;

-- Create the single new cron job that runs every minute
SELECT cron.schedule(
  'incremental-sync-every-minute',
  '* * * * *', -- every minute
  $$
  SELECT net.http_post(
    url := 'https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/schedule-incremental-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0"}'::jsonb,
    body := '{"source": "cron-every-minute"}'::jsonb
  ) AS request_id;
  $$
);