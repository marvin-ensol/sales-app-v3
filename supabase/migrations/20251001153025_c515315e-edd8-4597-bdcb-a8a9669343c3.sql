-- Drop existing enums if they exist (cascade to drop dependent objects)
DROP TYPE IF EXISTS public.automation_run_type CASCADE;
DROP TYPE IF EXISTS public.trigger_object_type CASCADE;

-- Create enums for task_automation_runs
CREATE TYPE public.automation_run_type AS ENUM ('create_on_entry', 'create_from_sequence', 'complete_on_exit');
CREATE TYPE public.trigger_object_type AS ENUM ('list', 'task');

-- Drop table if exists
DROP TABLE IF EXISTS public.task_automation_runs CASCADE;

-- Create task_automation_runs table
CREATE TABLE public.task_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.task_automations(id) ON DELETE CASCADE,
  type public.automation_run_type NOT NULL,
  hs_trigger_object public.trigger_object_type NOT NULL,
  hs_trigger_object_id TEXT NOT NULL,
  hs_created_task_id TEXT,
  planned_execution_timestamp TIMESTAMPTZ,
  created_task BOOLEAN DEFAULT false,
  failure_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.task_automation_runs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for full access (matching existing patterns)
CREATE POLICY "Allow all operations on task_automation_runs"
  ON public.task_automation_runs
  FOR ALL
  USING (true);

-- Create indexes for common queries
CREATE INDEX idx_task_automation_runs_automation_id ON public.task_automation_runs(automation_id);
CREATE INDEX idx_task_automation_runs_planned_execution ON public.task_automation_runs(planned_execution_timestamp);

-- Add trigger for updated_at
CREATE TRIGGER update_task_automation_runs_updated_at
  BEFORE UPDATE ON public.task_automation_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();