-- Update get_enriched_events function to include hs_list_id and hs_queue_id and support array filters
DROP FUNCTION IF EXISTS public.get_enriched_events(text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_enriched_events(
  event_filter text DEFAULT NULL,
  contact_filter text DEFAULT NULL,
  event_ids bigint[] DEFAULT NULL,
  contact_ids text[] DEFAULT NULL,
  update_status_filter text DEFAULT NULL,
  sort_order text DEFAULT 'DESC',
  limit_count integer DEFAULT 25,
  offset_count integer DEFAULT 0
)
RETURNS TABLE(
  id bigint,
  created_at timestamptz,
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
  automation_id uuid,
  hs_list_id text,
  hs_queue_id text,
  logs jsonb,
  error_count bigint,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- First, get the total count with filters applied
  SELECT COUNT(DISTINCT e.id)
  INTO v_total_count
  FROM events e
  LEFT JOIN hs_contacts c ON e.hs_contact_id = c.hs_object_id
  WHERE 
    (event_filter IS NULL OR e.event = event_filter)
    AND (contact_filter IS NULL OR e.hs_contact_id = contact_filter)
    AND (event_ids IS NULL OR e.id = ANY(event_ids))
    AND (contact_ids IS NULL OR e.hs_contact_id = ANY(contact_ids))
    AND (
      update_status_filter IS NULL 
      OR (
        update_status_filter = 'tasks_updated' 
        AND (e.logs->'task_updates'->'summary'->>'total_update_successful')::int > 0
      )
      OR (
        update_status_filter = 'tasks_update_failed' 
        AND (e.logs->'task_updates'->'summary'->>'total_update_unsuccessful')::int > 0
      )
    );

  -- Then return the paginated results including hs_list_id and hs_queue_id
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
    e.hubspot_url,
    e.automation_id,
    e.hs_list_id,
    e.hs_queue_id,
    e.logs,
    COUNT(el.id) as error_count,
    v_total_count as total_count
  FROM events e
  LEFT JOIN hs_contacts c ON e.hs_contact_id = c.hs_object_id
  LEFT JOIN hs_users u ON e.hs_owner_id = u.owner_id
  LEFT JOIN error_logs el ON e.id = el.event_id
  WHERE 
    (event_filter IS NULL OR e.event = event_filter)
    AND (contact_filter IS NULL OR e.hs_contact_id = contact_filter)
    AND (event_ids IS NULL OR e.id = ANY(event_ids))
    AND (contact_ids IS NULL OR e.hs_contact_id = ANY(contact_ids))
    AND (
      update_status_filter IS NULL 
      OR (
        update_status_filter = 'tasks_updated' 
        AND (e.logs->'task_updates'->'summary'->>'total_update_successful')::int > 0
      )
      OR (
        update_status_filter = 'tasks_update_failed' 
        AND (e.logs->'task_updates'->'summary'->>'total_update_unsuccessful')::int > 0
      )
    )
  GROUP BY e.id, e.created_at, e.event, e.type, e.hs_contact_id, 
           c.firstname, c.lastname, e.hs_owner_id, u.first_name, u.last_name,
           e.hs_engagement_id, e.hubspot_url, e.automation_id, e.hs_list_id, e.hs_queue_id, e.logs
  ORDER BY 
    CASE WHEN sort_order = 'DESC' THEN e.created_at END DESC,
    CASE WHEN sort_order = 'ASC' THEN e.created_at END ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;