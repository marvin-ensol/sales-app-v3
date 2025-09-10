-- Clean up stuck sync executions from previous deployment issues
UPDATE public.sync_executions 
SET 
  status = 'failed',
  completed_at = now(),
  error_message = 'Execution interrupted during deployment fix - database constraint issues resolved',
  updated_at = now()
WHERE status = 'running' 
  AND started_at < now() - interval '10 minutes';