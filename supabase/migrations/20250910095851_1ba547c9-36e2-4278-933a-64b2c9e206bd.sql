-- Fix cron job to run every minute instead of every 30 minutes
-- First, unschedule the existing job if it exists
SELECT cron.unschedule('incremental-sync-every-30s');

-- Create new cron job that runs every minute
SELECT cron.schedule(
  'incremental-sync-every-minute',
  '* * * * *', -- every minute (correct syntax)
  $$
  SELECT net.http_post(
    url := 'https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/schedule-incremental-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MDc3NDUsImV4cCI6MjA1MjA4Mzc0NX0.MdEw7vN-Gn8Xr9Pf_XwHqYaVh5z2xkpOiZXFJ9C4yTI"}'::jsonb,
    body := '{"source": "cron-every-minute"}'::jsonb
  ) AS request_id;
  $$
);