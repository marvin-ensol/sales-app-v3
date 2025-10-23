-- Update get_enriched_events function to check both task_updates and task_creation paths for filtering

CREATE OR REPLACE FUNCTION public.get_enriched_events(
  event_filter text[] DEFAULT NULL::text[], 
  contact_filter text DEFAULT NULL::text, 
  event_ids bigint[] DEFAULT NULL::bigint[], 
  contact_ids text[] DEFAULT NULL::text[], 
  owner_ids text[] DEFAULT NULL::text[], 
  update_status_filter text DEFAULT NULL::text, 
  sort_order text DEFAULT 'DESC'::text, 
  limit_count integer DEFAULT 25, 
  offset_count integer DEFAULT 0
)
RETURNS TABLE(
  id bigint, 
  created_at timestamp with time zone, 
  event text, 
  type text, 
  hs_contact_id text, 
  contact_firstname text, 
  contact_lastname text, 
  hs_owner_id text, 
  owner_firstname text, 
  owner_lastname text, 
  hs_engagement_id text, 
  hubspot_url text, 
  automation_id text, 
  hs_list_id text, 
  hs_queue_id text, 
  logs jsonb, 
  error_count bigint, 
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_count bigint;
BEGIN
  -- Get total count based on filters
  SELECT COUNT(DISTINCT e.id)
  INTO v_total_count
  FROM events e
  LEFT JOIN hs_contacts c ON e.hs_contact_id = c.hs_object_id
  WHERE 
    (event_filter IS NULL OR e.event = ANY(event_filter))
    AND (contact_filter IS NULL OR e.hs_contact_id = contact_filter)
    AND (event_ids IS NULL OR e.id = ANY(event_ids))
    AND (contact_ids IS NULL OR e.hs_contact_id = ANY(contact_ids))
    AND (owner_ids IS NULL OR e.hs_owner_id = ANY(owner_ids))
    AND (
      update_status_filter IS NULL OR
      -- Check for successful updates in both task_updates and task_creation paths
      (update_status_filter = 'tasks_updated' AND (
        (e.logs->'task_updates'->'summary'->>'total_update_successful' IS NOT NULL AND
         (e.logs->'task_updates'->'summary'->>'total_update_successful')::int > 0)
        OR
        (e.logs->'task_creation'->'summary'->>'total_update_successful' IS NOT NULL AND
         (e.logs->'task_creation'->'summary'->>'total_update_successful')::int > 0)
      )) OR
      -- Check for failed updates in both task_updates and task_creation paths
      (update_status_filter = 'tasks_update_failed' AND (
        (e.logs->'task_updates'->'summary'->>'total_update_unsuccessful' IS NOT NULL AND
         (e.logs->'task_updates'->'summary'->>'total_update_unsuccessful')::int > 0)
        OR
        (e.logs->'task_creation'->'summary'->>'total_update_unsuccessful' IS NOT NULL AND
         (e.logs->'task_creation'->'summary'->>'total_update_unsuccessful')::int > 0)
      ))
    );

  -- Return paginated results with enriched data
  RETURN QUERY
  SELECT 
    e.id,
    e.created_at,
    e.event,
    e.type,
    e.hs_contact_id,
    c.firstname as contact_firstname,
    c.lastname as contact_lastname,
    e.hs_owner_id,
    u.first_name as owner_firstname,
    u.last_name as owner_lastname,
    e.hs_engagement_id,
    CASE 
      WHEN e.hs_engagement_id IS NOT NULL THEN 
        'https://app.hubspot.com/contacts/47935530/record/0-3/' || e.hs_engagement_id
      WHEN e.hs_contact_id IS NOT NULL THEN 
        'https://app.hubspot.com/contacts/47935530/contact/' || e.hs_contact_id
      ELSE NULL
    END as hubspot_url,
    e.automation_id::text as automation_id,
    e.hs_list_id,
    e.hs_queue_id,
    e.logs,
    COUNT(DISTINCT el.id) as error_count,
    v_total_count as total_count
  FROM events e
  LEFT JOIN hs_contacts c ON e.hs_contact_id = c.hs_object_id
  LEFT JOIN hs_users u ON e.hs_owner_id = u.owner_id
  LEFT JOIN error_logs el ON e.id = el.event_id
  WHERE 
    (event_filter IS NULL OR e.event = ANY(event_filter))
    AND (contact_filter IS NULL OR e.hs_contact_id = contact_filter)
    AND (event_ids IS NULL OR e.id = ANY(event_ids))
    AND (contact_ids IS NULL OR e.hs_contact_id = ANY(contact_ids))
    AND (owner_ids IS NULL OR e.hs_owner_id = ANY(owner_ids))
    AND (
      update_status_filter IS NULL OR
      -- Check for successful updates in both task_updates and task_creation paths
      (update_status_filter = 'tasks_updated' AND (
        (e.logs->'task_updates'->'summary'->>'total_update_successful' IS NOT NULL AND
         (e.logs->'task_updates'->'summary'->>'total_update_successful')::int > 0)
        OR
        (e.logs->'task_creation'->'summary'->>'total_update_successful' IS NOT NULL AND
         (e.logs->'task_creation'->'summary'->>'total_update_successful')::int > 0)
      )) OR
      -- Check for failed updates in both task_updates and task_creation paths
      (update_status_filter = 'tasks_update_failed' AND (
        (e.logs->'task_updates'->'summary'->>'total_update_unsuccessful' IS NOT NULL AND
         (e.logs->'task_updates'->'summary'->>'total_update_unsuccessful')::int > 0)
        OR
        (e.logs->'task_creation'->'summary'->>'total_update_unsuccessful' IS NOT NULL AND
         (e.logs->'task_creation'->'summary'->>'total_update_unsuccessful')::int > 0)
      ))
    )
  GROUP BY e.id, e.created_at, e.event, e.type, e.hs_contact_id, 
           c.firstname, c.lastname, e.hs_owner_id, u.first_name, u.last_name,
           e.hs_engagement_id, e.automation_id, e.hs_list_id, e.hs_queue_id, e.logs
  ORDER BY 
    CASE WHEN sort_order = 'ASC' THEN e.created_at END ASC,
    CASE WHEN sort_order = 'DESC' THEN e.created_at END DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$function$;