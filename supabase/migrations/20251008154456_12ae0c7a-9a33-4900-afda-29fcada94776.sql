-- Drop duplicate foreign keys to resolve Supabase embed ambiguity

-- Drop duplicate FK on task_automations (keep fk_task_automations_category)
ALTER TABLE task_automations 
DROP CONSTRAINT IF EXISTS fk_task_category;

-- Drop duplicate FK on task_automation_runs (keep task_automation_runs_automation_id_fkey)
ALTER TABLE task_automation_runs 
DROP CONSTRAINT IF EXISTS fk_automation_runs_automation;