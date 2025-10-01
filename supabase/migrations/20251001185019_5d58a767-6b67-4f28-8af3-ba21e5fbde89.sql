-- Update the handle_task_completion_automation function to include hubspot_owner_id
CREATE OR REPLACE FUNCTION public.handle_task_completion_automation()
 RETURNS trigger
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
  current_position_value numeric;
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

  -- Treat null number_in_sequence as position 1
  current_position_value := COALESCE(NEW.number_in_sequence, 1);

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
  IF current_position_value >= automation_record.total_tasks THEN
    RAISE NOTICE 'Sequence has reached the end (position % of %)', current_position_value, automation_record.total_tasks;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Triggering sequence automation % for task % at position %', 
    automation_record.id, NEW.hs_object_id, current_position_value;

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
      'current_position', current_position_value,
      'associated_contact_id', NEW.associated_contact_id,
      'hs_queue_id', category_record.hs_queue_id,
      'completion_date', NEW.hs_task_completion_date,
      'schedule_enabled', automation_record.schedule_enabled,
      'schedule_configuration', automation_record.schedule_configuration,
      'timezone', automation_record.timezone,
      'hubspot_owner_id', NEW.hubspot_owner_id
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