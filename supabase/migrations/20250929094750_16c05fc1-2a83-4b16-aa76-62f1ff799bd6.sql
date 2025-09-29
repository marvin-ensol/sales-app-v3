-- Update get_owner_tasks function to exclude skipped tasks
CREATE OR REPLACE FUNCTION public.get_owner_tasks(owner_id_param text)
 RETURNS TABLE(id text, title text, description text, contact text, contact_id text, contact_phone text, status text, due_date text, priority text, owner text, hubspot_id text, queue text, queue_ids text[], is_unassigned boolean, completion_date timestamp with time zone, hs_timestamp timestamp with time zone, number_in_sequence numeric, created_by_automation_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    paris_now timestamptz;
    paris_today date;
    new_queue_id text;
    fallback_category_id text;
BEGIN
    -- Get current time in Paris timezone
    SELECT (NOW() AT TIME ZONE 'Europe/Paris')::timestamptz INTO paris_now;
    SELECT (NOW() AT TIME ZONE 'Europe/Paris')::date INTO paris_today;
    
    -- Get the queue ID for "New" category
    SELECT task_categories.id::text INTO new_queue_id 
    FROM task_categories 
    WHERE hs_queue_id = '22859489' 
    LIMIT 1;
    
    -- Get the fallback category ID (where hs_queue_id IS NULL)
    SELECT task_categories.id::text INTO fallback_category_id
    FROM task_categories 
    WHERE hs_queue_id IS NULL 
    LIMIT 1;
    
    RETURN QUERY
    WITH task_category_mapping AS (
        SELECT 
            ht.*,
            CASE 
                WHEN tc.id IS NOT NULL THEN tc.id::text
                ELSE COALESCE(fallback_category_id, 'other')
            END AS mapped_queue
        FROM hs_tasks ht
        LEFT JOIN task_categories tc ON ht.hs_queue_membership_ids = tc.hs_queue_id
        WHERE ht.archived = false
        AND COALESCE(ht.is_skipped, false) = false  -- Exclude skipped tasks
    ),
    enriched_data AS (
        SELECT 
            tcm.hs_object_id as id,
            COALESCE(tcm.hs_task_subject, 'Untitled Task') as title,
            tcm.hs_task_body as description,
            COALESCE(c.firstname || ' ' || c.lastname, 'Unknown Contact') as contact,
            tcm.associated_contact_id as contact_id,
            c.mobilephone as contact_phone,
            CASE 
                WHEN tcm.hs_task_status = 'COMPLETED' THEN 'completed'
                WHEN tcm.hs_task_status = 'WAITING' THEN 'waiting'
                WHEN tcm.hs_task_status = 'NOT_STARTED' THEN 'not_started'
                ELSE 'not_started'
            END as status,
            CASE 
                WHEN tcm.hs_timestamp IS NOT NULL THEN to_char(tcm.hs_timestamp AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY à HH24:MI')
                ELSE 'No due date'
            END as due_date,
            CASE 
                WHEN tcm.hs_task_priority = 'HIGH' THEN 'high'
                WHEN tcm.hs_task_priority = 'MEDIUM' THEN 'medium'
                WHEN tcm.hs_task_priority = 'LOW' THEN 'low'
                ELSE 'medium'
            END as priority,
            COALESCE(u.full_name, 'Unassigned') as owner,
            tcm.hs_object_id as hubspot_id,
            tcm.mapped_queue as queue,
            CASE 
                WHEN tcm.hs_queue_membership_ids IS NOT NULL THEN ARRAY[tcm.hs_queue_membership_ids]
                ELSE ARRAY[]::text[]
            END as queue_ids,
            (tcm.hubspot_owner_id IS NULL OR tcm.hubspot_owner_id = '') as is_unassigned,
            tcm.hs_task_completion_date as completion_date,
            tcm.created_at,
            tcm.hs_timestamp,
            tcm.hs_timestamp as raw_due_date,
            tcm.hubspot_owner_id,
            tcm.number_in_sequence,
            tcm.created_by_automation_id
        FROM task_category_mapping tcm
        LEFT JOIN hs_contacts c ON tcm.associated_contact_id = c.hs_object_id
        LEFT JOIN hs_users u ON tcm.hubspot_owner_id = u.owner_id
    )
    SELECT 
        ed.id,
        ed.title,
        ed.description,
        ed.contact,
        ed.contact_id,
        ed.contact_phone,
        ed.status,
        ed.due_date,
        ed.priority,
        ed.owner,
        ed.hubspot_id,
        ed.queue,
        ed.queue_ids,
        ed.is_unassigned,
        ed.completion_date,
        ed.hs_timestamp,
        ed.number_in_sequence,
        ed.created_by_automation_id
    FROM enriched_data ed
    WHERE ed.status != 'deleted' AND (
        -- Owner's assigned tasks (not started or waiting)
        (ed.hubspot_owner_id = owner_id_param AND (ed.status = 'not_started' OR ed.status = 'waiting'))
        OR
        -- Owner's completed tasks for today only
        (ed.hubspot_owner_id = owner_id_param AND ed.status = 'completed' AND DATE(ed.completion_date AT TIME ZONE 'Europe/Paris') = paris_today)
        OR
        -- Unassigned new tasks (only one per contact, oldest first)
        (ed.is_unassigned = true AND ed.queue = COALESCE(new_queue_id, '1') AND (ed.status = 'not_started' OR ed.status = 'waiting') AND ed.id IN (
            SELECT DISTINCT ON (ed2.contact_id) ed2.id
            FROM enriched_data ed2
            WHERE ed2.is_unassigned = true 
            AND ed2.queue = COALESCE(new_queue_id, '1')
            AND (ed2.status = 'not_started' OR ed2.status = 'waiting')
            AND ed2.status != 'deleted'
            ORDER BY ed2.contact_id, ed2.created_at ASC
        ))
        OR
        -- Owner's overdue tasks only
        (ed.hubspot_owner_id = owner_id_param AND (ed.status = 'not_started' OR ed.status = 'waiting') AND ed.raw_due_date < paris_now)
    )
    ORDER BY 
        CASE WHEN ed.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN ed.queue = COALESCE(new_queue_id, '1') AND ed.is_unassigned THEN ed.created_at END ASC,
        ed.raw_due_date ASC;
END;
$function$;