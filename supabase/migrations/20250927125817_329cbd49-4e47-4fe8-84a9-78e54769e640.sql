-- Clean up old automation columns from task_categories table
-- These columns are now handled by the task_automations table

ALTER TABLE public.task_categories 
  DROP COLUMN IF EXISTS hs_list_id,
  DROP COLUMN IF EXISTS hs_list_object,
  DROP COLUMN IF EXISTS automation_enabled,
  DROP COLUMN IF EXISTS display_automation_card,
  DROP COLUMN IF EXISTS sequence_enabled,
  DROP COLUMN IF EXISTS sequence_exit_enabled,
  DROP COLUMN IF EXISTS first_task_creation,
  DROP COLUMN IF EXISTS auto_complete_on_exit_enabled,
  DROP COLUMN IF EXISTS schedule_enabled,
  DROP COLUMN IF EXISTS schedule_configuration,
  DROP COLUMN IF EXISTS tasks_configuration;