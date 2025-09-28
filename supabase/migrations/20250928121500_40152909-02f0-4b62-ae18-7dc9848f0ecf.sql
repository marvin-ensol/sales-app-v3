-- One-off update to set created_by_automation_id for specific tasks
UPDATE hs_tasks 
SET created_by_automation_id = '60bf2b5a-b2ec-4bc5-a5cb-7766e2be94f0'
WHERE number_in_sequence IS NOT NULL 
  AND hs_queue_membership_ids = '22859490';