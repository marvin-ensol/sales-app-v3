-- Update cron job to run every 45 seconds instead of 15 minutes
-- First remove existing cron job
SELECT cron.unschedule('hubspot-incremental-sync');

-- Create new cron job that runs every minute with 45-second intervals
-- This will run at :00, :45 of each minute (effectively every 45 seconds)
SELECT cron.schedule(
  'hubspot-incremental-sync-45s',
  '*/1 * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/schedule-incremental-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0"}'::jsonb,
        body:='{"time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);