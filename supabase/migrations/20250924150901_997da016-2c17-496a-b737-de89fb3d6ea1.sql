-- Manually update the task that failed to be processed by the webhook
UPDATE public.hs_tasks 
SET hs_task_status = 'DELETED', updated_at = now() 
WHERE hs_object_id = '295180330171';