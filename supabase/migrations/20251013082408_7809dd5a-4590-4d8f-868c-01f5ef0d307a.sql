-- Reschedule stuck automation runs from 08:15 to 08:30
UPDATE task_automation_runs
SET 
  planned_execution_timestamp = '2025-10-13 08:30:00+00',
  planned_execution_timestamp_display = '2025-10-13 10:30 Europe/Paris',
  updated_at = NOW()
WHERE planned_execution_timestamp = '2025-10-13 08:15:00+00'
  AND hs_action_successful = FALSE
  AND (exit_contact_list_block IS NULL OR exit_contact_list_block = FALSE)
  AND type IN ('create_on_entry', 'create_from_sequence');