-- Create a single clean 30-second incremental sync cron job
SELECT cron.schedule(
  'incremental-sync-every-30s',
  '*/30 * * * * *', -- every 30 seconds
  $$
  SELECT
    net.http_post(
        url:='https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/schedule-incremental-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0"}'::jsonb,
        body:=concat('{"trigger_time": "', now(), '", "trigger_source": "cron-30s"}')::jsonb
    ) as request_id;
  $$
);

-- Reset sync metadata to force a fresh sync (set to 24+ hours ago)
UPDATE sync_metadata 
SET 
  last_sync_timestamp = NOW() - INTERVAL '25 hours',
  last_sync_success = false,
  sync_type = 'incremental',
  error_message = 'Reset for clean sync testing',
  updated_at = NOW();