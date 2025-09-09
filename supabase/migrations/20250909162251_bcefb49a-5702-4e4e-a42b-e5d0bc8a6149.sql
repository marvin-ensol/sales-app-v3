-- Fix the function search path security warning
CREATE OR REPLACE FUNCTION public.get_task_categories()
 RETURNS TABLE(id bigint, label text, color text, hs_queue_id text, order_column integer)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT tc.id, tc.label, tc.color, tc.hs_queue_id, tc.order_column
  FROM task_categories tc
  ORDER BY tc.order_column;
END;
$function$