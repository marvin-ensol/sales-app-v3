-- Add 'complete_on_engagement' to automation_run_type enum
ALTER TYPE public.automation_run_type ADD VALUE IF NOT EXISTS 'complete_on_engagement';

-- Add 'sequence_exit' to automation_run_type enum (if not already added)
ALTER TYPE public.automation_run_type ADD VALUE IF NOT EXISTS 'sequence_exit';

-- Add 'engagement' to trigger_object_type enum
ALTER TYPE public.trigger_object_type ADD VALUE IF NOT EXISTS 'engagement';

-- Create enum for marked_completed_source
DO $$ BEGIN
  CREATE TYPE public.marked_completed_source AS ENUM ('list_exit', 'phone_call');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add auto_complete_on_engagement column to task_automations
ALTER TABLE public.task_automations 
ADD COLUMN IF NOT EXISTS auto_complete_on_engagement BOOLEAN DEFAULT false;

-- Add marked_completed_source column to hs_tasks
ALTER TABLE public.hs_tasks 
ADD COLUMN IF NOT EXISTS marked_completed_source public.marked_completed_source DEFAULT NULL;

-- Create index for faster queries on marked_completed_source
CREATE INDEX IF NOT EXISTS idx_hs_tasks_marked_completed_source 
ON public.hs_tasks(marked_completed_source) 
WHERE marked_completed_source IS NOT NULL;