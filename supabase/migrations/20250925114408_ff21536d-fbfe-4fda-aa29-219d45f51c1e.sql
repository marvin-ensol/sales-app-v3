-- Update get_owner_tasks function to include hs_timestamp like get_all_tasks does
CREATE OR REPLACE FUNCTION public.get_owner_tasks(owner_id_param text)
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
    WHERE (
        -- Owner's assigned tasks (not started)
        (et.hubspot_owner_id = owner_id_param AND et.status = 'not_started')
        OR
        -- Owner's completed tasks for today only
        (et.hubspot_owner_id = owner_id_param AND et.status = 'completed' AND DATE(et.completion_date AT TIME ZONE 'Europe/Paris') = paris_today)
        OR
        -- Unassigned new tasks (only one per contact, oldest first)
        (et.is_unassigned = true AND et.queue = 'new' AND et.id IN (
            SELECT DISTINCT ON (et2.contact_id) et2.id
            FROM enriched_tasks et2
            WHERE et2.is_unassigned = true 
            AND et2.queue = 'new'
            AND et2.status = 'not_started'
            ORDER BY et2.contact_id, et2.created_at ASC
        ))
        OR
        -- Owner's overdue tasks only
        (et.hubspot_owner_id = owner_id_param AND et.status = 'not_started' AND et.raw_due_date < paris_now)
    )
    ORDER BY 
        CASE WHEN et.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN et.queue = 'new' AND et.is_unassigned THEN et.created_at END ASC,
        et.raw_due_date ASC;
END;
$function$