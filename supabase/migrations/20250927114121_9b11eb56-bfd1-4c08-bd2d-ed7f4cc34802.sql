-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the list memberships sync to run every 2 minutes
SELECT cron.schedule(
  'sync-list-memberships-every-2-minutes',
  '*/2 * * * *', -- every 2 minutes
  $$
  SELECT net.http_post(
    url:='https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/sync-hubspot-list-memberships',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0"}'::jsonb,
    body:='{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);