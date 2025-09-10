-- Fix security definer function by setting search_path
CREATE OR REPLACE FUNCTION public.add_execution_log(
  execution_id_param TEXT,
  log_level TEXT,
  message TEXT,
  details JSONB DEFAULT NULL
)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sync_executions 
  SET 
    execution_log = execution_log || jsonb_build_object(
      'timestamp', extract(epoch from now()) * 1000,
      'level', log_level,
      'message', message,
      'details', details
    ),
    updated_at = now()
  WHERE execution_id = execution_id_param;
END;
$$;