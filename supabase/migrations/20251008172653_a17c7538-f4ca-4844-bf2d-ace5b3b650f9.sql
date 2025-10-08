-- Create triggers to fire automation on list membership entry and enforce idempotency
BEGIN;

-- 1) AFTER INSERT trigger: fires when a membership row is inserted
DROP TRIGGER IF EXISTS trg_hs_list_memberships_after_insert ON public.hs_list_memberships;
CREATE TRIGGER trg_hs_list_memberships_after_insert
AFTER INSERT ON public.hs_list_memberships
FOR EACH ROW
EXECUTE FUNCTION public.handle_list_membership_automation();

-- 2) AFTER UPDATE trigger: fires only when hs_list_entry_date transitions from NULL -> NOT NULL
DROP TRIGGER IF EXISTS trg_hs_list_memberships_entry_date_set ON public.hs_list_memberships;
CREATE TRIGGER trg_hs_list_memberships_entry_date_set
AFTER UPDATE OF hs_list_entry_date ON public.hs_list_memberships
FOR EACH ROW
WHEN (OLD.hs_list_entry_date IS NULL AND NEW.hs_list_entry_date IS NOT NULL)
EXECUTE FUNCTION public.handle_list_membership_automation();

-- 3) Idempotency: prevent duplicate create_on_entry runs for the same (automation_id, hs_membership_id)
-- Note: enum cast ensures correct comparison against automation_run_type
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_automation_runs_automation_membership_create_on_entry
ON public.task_automation_runs (automation_id, hs_membership_id)
WHERE type = 'create_on_entry'::automation_run_type;

COMMIT;