-- Set up cron job to sync HubSpot owners and teams every 6 hours
-- Runs at 00:00, 06:00, 12:00, 18:00 UTC (close to Paris times)
SELECT cron.schedule(
  'sync-hubspot-owners-teams',
  '0 0,6,12,18 * * *', -- Every 6 hours at the specified times
  $$
  SELECT
    net.http_post(
        url:='https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/sync-hubspot-owners',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);