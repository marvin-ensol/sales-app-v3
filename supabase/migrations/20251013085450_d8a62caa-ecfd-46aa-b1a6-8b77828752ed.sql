-- Trigger retry-stuck-automation-runs with override mode to process 203 pending runs
SELECT net.http_post(
  url:='https://zenlavaixlvabzsnvzro.supabase.co/functions/v1/retry-stuck-automation-runs',
  headers:='{"Content-Type": "application/json"}'::jsonb,
  body:='{"override": true}'::jsonb
) as request_id;