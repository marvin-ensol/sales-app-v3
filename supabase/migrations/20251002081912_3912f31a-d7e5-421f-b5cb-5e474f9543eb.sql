-- Rename created_task to hs_action_successful in task_automation_runs
ALTER TABLE public.task_automation_runs 
RENAME COLUMN created_task TO hs_action_successful;

-- Update comment to clarify new purpose
COMMENT ON COLUMN public.task_automation_runs.hs_action_successful IS 
'TRUE when HubSpot API action (create or update) returns 200 response';