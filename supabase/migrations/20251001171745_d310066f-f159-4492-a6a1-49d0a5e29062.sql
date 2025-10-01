-- Add position_in_sequence column to task_automation_runs if it doesn't exist
ALTER TABLE task_automation_runs 
ADD COLUMN IF NOT EXISTS position_in_sequence numeric;

-- Create function to handle task completion automation
CREATE OR REPLACE FUNCTION public.handle_task_completion_automation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  automation_record RECORD;
  category_record RECORD;
  supabase_url TEXT;
  function_url TEXT;
  http_request_id BIGINT;
BEGIN
  -- Only proceed if hs_task_completion_count changed from not 1 to 1
  IF OLD.hs_task_completion_count = 1 OR NEW.hs_task_completion_count != 1 THEN
    RETURN NEW;
  END IF;

  -- Check if hs_queue_membership_ids is not null
  IF NEW.hs_queue_membership_ids IS NULL THEN
    RAISE NOTICE 'Task % has no queue membership', NEW.hs_object_id;
    RETURN NEW;
  END IF;

  -- Check if number_in_sequence is null (shouldn't trigger if not in a sequence)
  IF NEW.number_in_sequence IS NULL THEN
    RAISE NOTICE 'Task % has no sequence number', NEW.hs_object_id;
    RETURN NEW;
  END IF;

  -- Find matching category for this queue
  SELECT id, hs_queue_id
  INTO category_record
  FROM task_categories
  WHERE hs_queue_id = NEW.hs_queue_membership_ids
  LIMIT 1;

  -- If no matching category found, exit early
  IF NOT FOUND THEN
    RAISE NOTICE 'No category found for queue %', NEW.hs_queue_membership_ids;
    RETURN NEW;
  END IF;

  -- Find matching automation for this category
  SELECT 
    ta.id,
    ta.automation_enabled,
    ta.sequence_enabled,
    ta.total_tasks,
    ta.schedule_enabled,
    ta.schedule_configuration,
    ta.timezone,
    ta.tasks_configuration
  INTO automation_record
  FROM task_automations ta
  WHERE ta.task_category_id = category_record.id
    AND ta.automation_enabled = true
    AND ta.sequence_enabled = true
  LIMIT 1;

  -- If no matching automation found, exit early
  IF NOT FOUND THEN
    RAISE NOTICE 'No enabled sequence automation found for category %', category_record.id;
    RETURN NEW;
  END IF;

  -- Check if sequence has reached the end
  IF NEW.number_in_sequence >= automation_record.total_tasks THEN
    RAISE NOTICE 'Sequence has reached the end (position % of %)', NEW.number_in_sequence, automation_record.total_tasks;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Triggering sequence automation % for task % at position %', 
    automation_record.id, NEW.hs_object_id, NEW.number_in_sequence;

  -- Get Supabase configuration
  supabase_url := 'https://zenlavaixlvabzsnvzro.supabase.co';
  function_url := supabase_url || '/functions/v1/process-automation-trigger';
  
  -- Call the edge function asynchronously using pg_net
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'trigger_type', 'task_completion',
      'task_id', NEW.hs_object_id,
      'automation_id', automation_record.id,
      'current_position', NEW.number_in_sequence,
      'associated_contact_id', NEW.associated_contact_id,
      'hs_queue_id', category_record.hs_queue_id,
      'schedule_enabled', automation_record.schedule_enabled,
      'schedule_configuration', automation_record.schedule_configuration,
      'timezone', automation_record.timezone
    )
  ) INTO http_request_id;

  RAISE NOTICE 'Edge function called with request ID: %', http_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_task_completion_automation: %', SQLERRM;
    RETURN NEW; -- Don't fail the update even if automation fails
END;
$function$;

-- Create trigger on hs_tasks for task completion
DROP TRIGGER IF EXISTS trigger_task_completion_automation ON hs_tasks;
CREATE TRIGGER trigger_task_completion_automation
  AFTER UPDATE ON hs_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion_automation();