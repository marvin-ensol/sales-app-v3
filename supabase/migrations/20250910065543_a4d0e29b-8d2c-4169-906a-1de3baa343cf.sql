-- Clean up any existing cron jobs for sync
SELECT cron.unschedule('invoke-incremental-sync-every-30s');
SELECT cron.unschedule('invoke-incremental-sync-every-minute'); 
SELECT cron.unschedule('invoke-incremental-sync-every-15s');
SELECT cron.unschedule('schedule-incremental-sync-every-30s');

-- Reset sync metadata to a proper starting state
UPDATE sync_metadata 
SET 
  last_sync_timestamp = NOW() - INTERVAL '1 hour',  -- Go back 1 hour to catch recent updates
  last_sync_success = true,
  sync_type = 'incremental',
  sync_duration = 0,
  tasks_added = 0,
  tasks_updated = 0, 
  tasks_deleted = 0,
  error_message = NULL,
  updated_at = NOW()
WHERE id = (SELECT id FROM sync_metadata ORDER BY created_at DESC LIMIT 1);

-- Create a single clean cron job for incremental sync every 30 seconds
SELECT cron.schedule(
  'incremental-sync-30s',
  '*/30 * * * * *',  -- Every 30 seconds
  $$
  SELECT
    net.http_post(
        url:='https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/schedule-incremental-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbmxhdmFpeGx2YWJ6c252enJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjcwMDMsImV4cCI6MjA2NTQwMzAwM30.oCiIkxWRGGV1TTndh6gQV5X4zENe36E11iIPDbzqmh0"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);