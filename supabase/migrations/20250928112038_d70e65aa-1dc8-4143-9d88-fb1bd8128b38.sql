-- Update enriched_tasks view to properly map all HubSpot task statuses
-- HubSpot statuses: COMPLETED, NOT_STARTED, WAITING, DELETED
-- Our mapped statuses: completed, not_started, waiting, deleted

DROP VIEW IF EXISTS enriched_tasks;

CREATE VIEW enriched_tasks AS
WITH task_queue_mapping AS (
  SELECT 
    ht.hs_object_id,
    CASE 
      WHEN string_to_array(ht.hs_queue_membership_ids, ';') && ARRAY['46725893'] THEN 'rappels'
      WHEN string_to_array(ht.hs_queue_membership_ids, ';') && ARRAY['46725892'] THEN 'new'
      WHEN string_to_array(ht.hs_queue_membership_ids, ';') && ARRAY['46725894'] THEN 'simulations'
      WHEN string_to_array(ht.hs_queue_membership_ids, ';') && ARRAY['46725895'] THEN 'communications'
      WHEN string_to_array(ht.hs_queue_membership_ids, ';') && ARRAY['46725896'] THEN 'attempted'
      ELSE 'other'
    END as queue,
    COALESCE(string_to_array(ht.hs_queue_membership_ids, ';'), ARRAY[]::text[]) as queue_ids
  FROM hs_tasks ht
),
owner_info AS (
  SELECT 
    ht.hs_object_id,
    COALESCE(u.full_name, 'Unassigned') as owner,
    ht.hubspot_owner_id,
    CASE WHEN ht.hubspot_owner_id IS NULL OR ht.hubspot_owner_id = '' THEN true ELSE false END as is_unassigned
  FROM hs_tasks ht
  LEFT JOIN hs_users u ON ht.hubspot_owner_id = u.owner_id
),
contact_info AS (
  SELECT 
    ht.hs_object_id,
    COALESCE(hc.firstname || ' ' || hc.lastname, 'Unknown Contact') as contact,
    ht.associated_contact_id as contact_id,
    hc.mobilephone as contact_phone
  FROM hs_tasks ht
  LEFT JOIN hs_contacts hc ON ht.associated_contact_id = hc.hs_object_id
)
SELECT 
  ht.hs_object_id as id,
  COALESCE(ht.hs_task_subject, 'No Subject') as title,
  ht.hs_task_body as description,
  ci.contact,
  ci.contact_id,
  ci.contact_phone,
  CASE 
    WHEN UPPER(ht.hs_task_status) = 'COMPLETED' THEN 'completed'
    WHEN UPPER(ht.hs_task_status) = 'NOT_STARTED' THEN 'not_started'
    WHEN UPPER(ht.hs_task_status) = 'WAITING' THEN 'waiting'
    WHEN UPPER(ht.hs_task_status) = 'DELETED' THEN 'deleted'
    ELSE 'not_started'
  END as status,
  to_char(ht.hs_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris', 'DD/MM à HH24:MI') as due_date,
  ht.hs_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris' as raw_due_date,
  CASE 
    WHEN ht.hs_task_priority = 'HIGH' THEN 'high'
    WHEN ht.hs_task_priority = 'MEDIUM' THEN 'medium'
    WHEN ht.hs_task_priority = 'LOW' THEN 'low'
    ELSE 'medium'
  END as priority,
  oi.owner,
  ht.hs_object_id as hubspot_id,
  tqm.queue,
  tqm.queue_ids,
  oi.is_unassigned,
  ht.hs_task_completion_date as completion_date,
  ht.hs_task_completion_date as hs_task_completion_date,
  ht.created_at,
  ht.updated_at,
  oi.hubspot_owner_id,
  ht.associated_deal_id
FROM hs_tasks ht
JOIN task_queue_mapping tqm ON ht.hs_object_id = tqm.hs_object_id
JOIN owner_info oi ON ht.hs_object_id = oi.hs_object_id
JOIN contact_info ci ON ht.hs_object_id = ci.hs_object_id
WHERE ht.archived = false;

-- Update get_owner_tasks function to exclude deleted tasks and handle all statuses
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
    WHERE et.status != 'deleted' AND (
        -- Owner's assigned tasks (not started or waiting)
        (et.hubspot_owner_id = owner_id_param AND (et.status = 'not_started' OR et.status = 'waiting'))
        OR
        -- Owner's completed tasks for today only
        (et.hubspot_owner_id = owner_id_param AND et.status = 'completed' AND DATE(et.completion_date AT TIME ZONE 'Europe/Paris') = paris_today)
        OR
        -- Unassigned new tasks (only one per contact, oldest first)
        (et.is_unassigned = true AND et.queue = 'new' AND (et.status = 'not_started' OR et.status = 'waiting') AND et.id IN (
            SELECT DISTINCT ON (et2.contact_id) et2.id
            FROM enriched_tasks et2
            WHERE et2.is_unassigned = true 
            AND et2.queue = 'new'
            AND (et2.status = 'not_started' OR et2.status = 'waiting')
            AND et2.status != 'deleted'
            ORDER BY et2.contact_id, et2.created_at ASC
        ))
        OR
        -- Owner's overdue tasks only
        (et.hubspot_owner_id = owner_id_param AND (et.status = 'not_started' OR et.status = 'waiting') AND et.raw_due_date < paris_now)
    )
    ORDER BY 
        CASE WHEN et.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN et.queue = 'new' AND et.is_unassigned THEN et.created_at END ASC,
        et.raw_due_date ASC;
END;
$function$;

-- Update get_all_tasks function to exclude deleted tasks and handle all statuses
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
    WHERE et.status != 'deleted'
    ORDER BY 
        CASE WHEN et.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN et.queue = 'new' AND et.is_unassigned THEN et.created_at END ASC,
        et.raw_due_date ASC;
END;
$function$;