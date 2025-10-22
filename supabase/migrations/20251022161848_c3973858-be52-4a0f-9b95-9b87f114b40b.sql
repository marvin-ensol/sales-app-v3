-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_enriched_events(text, text, text, integer);

-- Create enhanced function with pagination support
CREATE OR REPLACE FUNCTION public.get_enriched_events(
  event_filter text DEFAULT NULL,
  contact_filter text DEFAULT NULL,
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
    AND (contact_filter IS NULL OR e.hs_contact_id = contact_filter);

  -- Then return the paginated results with total count
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
  GROUP BY e.id, e.created_at, e.event, e.type, e.hs_contact_id, 
           c.firstname, c.lastname, e.hs_owner_id, u.first_name, u.last_name,
           e.hs_engagement_id, e.hubspot_url, e.logs
  ORDER BY 
    CASE WHEN sort_order = 'DESC' THEN e.created_at END DESC,
    CASE WHEN sort_order = 'ASC' THEN e.created_at END ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;