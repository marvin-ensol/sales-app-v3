-- Add display column for planned execution timestamp with timezone
ALTER TABLE public.task_automation_runs 
ADD COLUMN planned_execution_timestamp_display text NULL;