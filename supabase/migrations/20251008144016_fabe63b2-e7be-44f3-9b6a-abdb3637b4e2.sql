-- Add cancel_on_exit to automation_run_type enum
ALTER TYPE public.automation_run_type ADD VALUE IF NOT EXISTS 'cancel_on_exit';

-- Add actioned_run_ids column to task_automation_runs
ALTER TABLE public.task_automation_runs 
ADD COLUMN IF NOT EXISTS actioned_run_ids jsonb DEFAULT NULL;