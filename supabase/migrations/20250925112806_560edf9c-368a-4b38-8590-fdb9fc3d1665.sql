-- Drop and recreate get_all_tasks function to include hs_timestamp
DROP FUNCTION IF EXISTS public.get_all_tasks();

CREATE OR REPLACE FUNCTION public.get_all_tasks()
 RETURNS TABLE(id text, title text, description text, contact text, contact_id text, contact_phone text, status text, due_date text, priority text, owner text, hubspot_id text, queue text, queue_ids text[], is_unassigned boolean, completion_date timestamp with time zone, hs_timestamp timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    paris_now timestamptz;
    paris_today date;
BEGIN
    -- Get current time in Paris timezone
    SELECT (NOW() AT TIME ZONE 'Europe/Paris')::timestamptz INTO paris_now;
    SELECT (NOW() AT TIME ZONE 'Europe/Paris')::date INTO paris_today;
    
    RETURN QUERY
    SELECT 
        et.id,
        et.title,
        et.description,
        et.contact,
        et.contact_id,
        et.contact_phone,
        et.status,
        et.due_date,
        et.priority,
        et.owner,
        et.hubspot_id,
        et.queue,
        et.queue_ids,
        et.is_unassigned,
        et.completion_date,
        ht.hs_timestamp
    FROM enriched_tasks et
    LEFT JOIN hs_tasks ht ON et.hubspot_id = ht.hs_object_id
    ORDER BY 
        CASE WHEN et.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN et.queue = 'new' AND et.is_unassigned THEN et.created_at END ASC,
        et.raw_due_date ASC;
END;
$function$;