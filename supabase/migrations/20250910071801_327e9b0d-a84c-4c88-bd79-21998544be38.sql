-- Create sync_executions table for detailed tracking
CREATE TABLE public.sync_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id TEXT NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'incremental',
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, timeout
  tasks_fetched INTEGER DEFAULT 0,
  tasks_processed INTEGER DEFAULT 0,
  tasks_updated INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  hubspot_api_calls INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  execution_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_sync_attempts table for task-level tracking
CREATE TABLE public.task_sync_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id TEXT NOT NULL,
  task_hubspot_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed, skipped
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  hubspot_response JSONB,
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_sync_executions_started_at ON public.sync_executions(started_at DESC);
CREATE INDEX idx_sync_executions_status ON public.sync_executions(status);
CREATE INDEX idx_sync_executions_trigger_source ON public.sync_executions(trigger_source);
CREATE INDEX idx_task_sync_attempts_execution_id ON public.task_sync_attempts(execution_id);
CREATE INDEX idx_task_sync_attempts_task_hubspot_id ON public.task_sync_attempts(task_hubspot_id);
CREATE INDEX idx_task_sync_attempts_status ON public.task_sync_attempts(status);

-- Enable RLS
ALTER TABLE public.sync_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_sync_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow all operations on sync_executions" 
ON public.sync_executions 
FOR ALL 
USING (true);

CREATE POLICY "Allow all operations on task_sync_attempts" 
ON public.task_sync_attempts 
FOR ALL 
USING (true);

-- Create function to add execution log entry
CREATE OR REPLACE FUNCTION public.add_execution_log(
  execution_id_param TEXT,
  log_level TEXT,
  message TEXT,
  details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;