-- Reschedule stuck 08:30 runs to the current minute (Option B)
WITH updated AS (
  UPDATE public.task_automation_runs
  SET 
    planned_execution_timestamp = date_trunc('minute', now()),
    planned_execution_timestamp_display = to_char(date_trunc('minute', now() at time zone 'Europe/Paris'), 'YYYY-MM-DD HH24:MI "Europe/Paris"'),
    updated_at = now()
  WHERE planned_execution_timestamp = '2025-10-13 08:30:00+00'
    AND coalesce(hs_action_successful, false) = false
    AND (exit_contact_list_block IS NULL OR exit_contact_list_block = false)
    AND type IN ('create_on_entry','create_from_sequence')
  RETURNING id
)
SELECT count(*)::int as updated_count FROM updated;