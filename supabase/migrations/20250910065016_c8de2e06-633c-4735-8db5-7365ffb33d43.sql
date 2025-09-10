-- Remove any existing incremental sync cron jobs
SELECT cron.unschedule('invoke-incremental-sync-every-minute');
SELECT cron.unschedule('invoke-incremental-sync-every-15-minutes');

-- Create new cron job to run incremental sync every 30 seconds
SELECT cron.schedule(
  'invoke-incremental-sync-every-30-seconds',
  '*/30 * * * * *', -- every 30 seconds
  $$
  select
    net.http_post(
        url:='https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/schedule-incremental-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0"}'::jsonb,
        body:='{"timestamp": "auto-cron"}'::jsonb
    ) as request_id;
  $$
);