-- Create composite index for legacy task conflict detection
-- This index optimizes the query in process-automation-trigger that checks for
-- conflicting pre-existing tasks before creating new automation runs

CREATE INDEX IF NOT EXISTS idx_hs_tasks_conflict_check 
ON hs_tasks (hs_queue_membership_ids, associated_contact_id, number_in_sequence)
WHERE hs_task_completion_count = 0 
  AND hs_task_status != 'DELETED' 
  AND number_in_sequence IS NOT NULL;