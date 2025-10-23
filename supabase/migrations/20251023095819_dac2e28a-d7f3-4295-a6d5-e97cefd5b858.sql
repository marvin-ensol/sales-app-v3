-- Drop the function with CASCADE to remove all dependent triggers
DROP FUNCTION IF EXISTS public.handle_list_membership_automation() CASCADE;

-- Clean up task_automation_runs table - remove list entry records
DELETE FROM public.task_automation_runs WHERE type = 'create_on_entry';

-- Remove the hs_membership_id column from task_automation_runs
ALTER TABLE public.task_automation_runs DROP COLUMN IF EXISTS hs_membership_id;

-- Drop the hs_list_memberships table entirely
DROP TABLE IF EXISTS public.hs_list_memberships;