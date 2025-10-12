-- Modify handle_list_membership_automation trigger to skip automations with first_task_creation = true
-- Those will be handled in batch by sync-hubspot-list-memberships instead

CREATE OR REPLACE FUNCTION public.handle_list_membership_automation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  automation_record RECORD;
  supabase_url TEXT;
  function_url TEXT;
  http_request_id BIGINT;
BEGIN
  -- Get Supabase configuration
  supabase_url := 'https://zenlavaixlvabzsnvzro.supabase.co';
  
  -- Find matching automation for this list
  SELECT 
    ta.id,
    ta.automation_enabled,
    ta.first_task_creation,
    ta.schedule_enabled,
    ta.schedule_configuration,
    ta.timezone,
    ta.hs_list_id
  INTO automation_record
  FROM task_automations ta
  WHERE ta.hs_list_id = NEW.hs_list_id
    AND ta.automation_enabled = true
  LIMIT 1;

  -- If no matching automation found, exit early
  IF NOT FOUND THEN
    RAISE NOTICE 'No enabled automation found for list %', NEW.hs_list_id;
    RETURN NEW;
  END IF;

  -- SKIP if first_task_creation = true (will be handled in batch by sync function)
  IF automation_record.first_task_creation = true THEN
    RAISE NOTICE 'Skipping per-row trigger for list % - will be handled in batch', NEW.hs_list_id;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Triggering automation % for list membership %', automation_record.id, NEW.id;

  -- Call the edge function asynchronously using pg_net
  function_url := supabase_url || '/functions/v1/process-automation-trigger';
  
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'trigger_type', 'list_entry',
      'membership_id', NEW.id,
      'automation_id', automation_record.id,
      'hs_list_id', NEW.hs_list_id,
      'hs_object_id', NEW.hs_object_id,
      'schedule_enabled', automation_record.schedule_enabled,
      'schedule_configuration', automation_record.schedule_configuration,
      'timezone', automation_record.timezone
    )
  ) INTO http_request_id;

  RAISE NOTICE 'Edge function called with request ID: %', http_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_list_membership_automation: %', SQLERRM;
    RETURN NEW;
END;
$function$;