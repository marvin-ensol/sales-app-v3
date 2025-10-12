-- Update the clear_skipped_on_uncomplete function to also clear automation-related fields
CREATE OR REPLACE FUNCTION public.clear_skipped_on_uncomplete()
RETURNS TRIGGER AS $$
BEGIN
  -- If completion count goes from 1 to 0 (task uncompleted), clear is_skipped and automation fields
  IF OLD.hs_task_completion_count = 1 AND NEW.hs_task_completion_count = 0 THEN
    NEW.is_skipped := NULL;
    NEW.marked_completed_by_automation := NULL;
    NEW.marked_completed_by_automation_id := NULL;
    RAISE NOTICE 'Task % uncompleted, clearing is_skipped and automation fields', NEW.hs_object_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;