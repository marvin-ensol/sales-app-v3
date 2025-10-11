-- Phase 1: Make hs_contact_id nullable in task_automation_runs
ALTER TABLE task_automation_runs 
  ALTER COLUMN hs_contact_id DROP NOT NULL;

COMMENT ON COLUMN task_automation_runs.hs_contact_id IS 'Contact ID from hs_contacts. Nullable to allow runs to be created even if contact sync is delayed. Will be resolved at execution time if NULL.';