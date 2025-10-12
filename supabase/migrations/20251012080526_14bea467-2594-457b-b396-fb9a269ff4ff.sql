-- Create trigger to auto-clear is_skipped when task is uncompleted
CREATE OR REPLACE FUNCTION public.clear_skipped_on_uncomplete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If completion count goes from 1 to 0 (task uncompleted), clear is_skipped
  IF OLD.hs_task_completion_count = 1 AND NEW.hs_task_completion_count = 0 THEN
    NEW.is_skipped := NULL;
    RAISE NOTICE 'Task % uncompleted, clearing is_skipped', NEW.hs_object_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires BEFORE UPDATE on hs_tasks
DROP TRIGGER IF EXISTS clear_skipped_on_uncomplete_trigger ON hs_tasks;
CREATE TRIGGER clear_skipped_on_uncomplete_trigger
  BEFORE UPDATE ON hs_tasks
  FOR EACH ROW
  EXECUTE FUNCTION clear_skipped_on_uncomplete();