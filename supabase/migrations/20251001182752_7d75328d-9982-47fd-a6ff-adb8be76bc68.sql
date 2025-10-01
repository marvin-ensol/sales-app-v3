-- Create enum for task owner settings
CREATE TYPE public.task_owner_setting AS ENUM (
  'no_owner',
  'contact_owner',
  'previous_task_owner'
);

-- Add task_owner_setting column to task_automation_runs
ALTER TABLE public.task_automation_runs 
ADD COLUMN task_owner_setting public.task_owner_setting;