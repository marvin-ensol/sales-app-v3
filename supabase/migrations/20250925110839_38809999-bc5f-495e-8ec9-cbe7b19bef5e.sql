-- Update get_task_categories function without parameters to include locks_lower_categories
CREATE OR REPLACE FUNCTION public.get_task_categories()
 RETURNS TABLE(id bigint, label text, color text, hs_queue_id text, order_column integer, locks_lower_categories boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT tc.id, tc.label, tc.color, tc.hs_queue_id, tc.order_column, tc.locks_lower_categories
  FROM task_categories tc
  ORDER BY tc.order_column;
END;
$function$;