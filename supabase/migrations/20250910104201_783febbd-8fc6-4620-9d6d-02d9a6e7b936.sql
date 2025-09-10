-- Clean up stuck sync executions
UPDATE sync_executions 
SET 
  status = 'failed',
  error_message = 'Execution timed out and was automatically cleaned up',
  completed_at = now(),
  updated_at = now()
WHERE status = 'running' 
  AND started_at < (now() - interval '5 minutes');