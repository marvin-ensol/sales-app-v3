-- Add performance indexes for team task summary queries (without CONCURRENTLY for transaction compatibility)
CREATE INDEX IF NOT EXISTS idx_hs_tasks_owner_status_timestamp 
ON hs_tasks (hubspot_owner_id, hs_task_status, hs_timestamp) 
WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_hs_tasks_owner_completion 
ON hs_tasks (hubspot_owner_id, hs_task_completion_date) 
WHERE archived = false AND hs_task_status = 'COMPLETED';

CREATE INDEX IF NOT EXISTS idx_hs_tasks_queue_membership 
ON hs_tasks (hs_queue_membership_ids) 
WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_hs_users_team_archived 
ON hs_users (team_id, archived) 
WHERE archived = false;