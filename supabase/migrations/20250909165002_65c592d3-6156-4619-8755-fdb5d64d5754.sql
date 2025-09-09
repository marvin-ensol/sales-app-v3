-- Fix security issues from linter

-- 1. Add RLS policies for task_categories table
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to task_categories" 
ON task_categories 
FOR SELECT 
USING (true);

-- 2. Fix security definer view by recreating as regular view
DROP VIEW IF EXISTS enriched_tasks;

CREATE VIEW enriched_tasks AS
SELECT 
    t.hs_object_id as id,
    t.hs_task_subject as title,
    t.hs_task_body as description,
    COALESCE(c.firstname || ' ' || c.lastname, 'Unknown Contact') as contact,
    t.associated_contact_id as contact_id,
    c.mobilephone as contact_phone,
    CASE 
        WHEN t.hs_task_status = 'COMPLETED' THEN 'completed'
        ELSE 'not_started'
    END as status,
    COALESCE(
        (t.hs_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::text,
        CURRENT_DATE::text
    ) as due_date,
    CASE 
        WHEN t.hs_task_priority = 'HIGH' THEN 'high'
        WHEN t.hs_task_priority = 'MEDIUM' THEN 'medium'
        ELSE 'low'
    END as priority,
    COALESCE(u.full_name, 'Unassigned') as owner,
    t.hs_object_id as hubspot_id,
    CASE 
        WHEN t.hs_queue_membership_ids LIKE '%859803242%' THEN 'rappels'
        WHEN t.hs_queue_membership_ids LIKE '%859787764%' THEN 'new'
        WHEN t.hs_queue_membership_ids LIKE '%859796481%' THEN 'simulations'
        WHEN t.hs_queue_membership_ids LIKE '%859787765%' THEN 'communications'
        WHEN t.hs_queue_membership_ids LIKE '%859787766%' THEN 'attempted'
        ELSE 'other'
    END as queue,
    COALESCE(string_to_array(t.hs_queue_membership_ids, ';'), ARRAY[]::text[]) as queue_ids,
    CASE WHEN t.hubspot_owner_id IS NULL THEN true ELSE false END as is_unassigned,
    t.hs_task_completion_date as completion_date,
    t.hubspot_owner_id,
    -- Additional fields for filtering
    t.hs_timestamp as raw_due_date,
    t.hs_task_completion_date,
    t.created_at,
    t.updated_at
FROM hs_tasks t
LEFT JOIN hs_contacts c ON t.associated_contact_id = c.hs_object_id
LEFT JOIN hs_users u ON t.hubspot_owner_id = u.owner_id AND u.archived = false
WHERE t.archived = false;

-- 3. Fix function search path issues by adding SET search_path
CREATE OR REPLACE FUNCTION get_valid_owner_ids()
RETURNS text[] 
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    valid_teams text[] := ARRAY['4037617', '4037614', '144671866', '31633418'];
    valid_owners text[];
BEGIN
    SELECT ARRAY_AGG(DISTINCT owner_id)
    INTO valid_owners
    FROM hs_users 
    WHERE archived = false 
    AND (team_id = ANY(valid_teams) OR team_id IS NULL);
    
    RETURN COALESCE(valid_owners, ARRAY[]::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION get_owner_tasks(owner_id_param text)
RETURNS TABLE(
    id text,
    title text,
    description text,
    contact text,
    contact_id text,
    contact_phone text,
    status text,
    due_date text,
    priority text,
    owner text,
    hubspot_id text,
    queue text,
    queue_ids text[],
    is_unassigned boolean,
    completion_date timestamptz
) 
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    valid_owners text[];
    paris_now timestamptz;
    paris_today date;
BEGIN
    -- Get valid owner IDs
    SELECT get_valid_owner_ids() INTO valid_owners;
    
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
        et.completion_date
    FROM enriched_tasks et
    WHERE (
        -- Owner's assigned tasks
        (et.hubspot_owner_id = owner_id_param AND et.hubspot_owner_id = ANY(valid_owners))
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
        -- Completed tasks for today
        (et.status = 'completed' AND DATE(et.completion_date AT TIME ZONE 'Europe/Paris') = paris_today)
        OR
        -- Rappels & RDV tasks
        (et.queue = 'rappels' AND et.hubspot_owner_id = owner_id_param)
        OR
        -- Overdue tasks
        (et.status = 'not_started' AND et.raw_due_date < paris_now)
    )
    ORDER BY 
        CASE WHEN et.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN et.queue = 'new' AND et.is_unassigned THEN et.created_at END ASC,
        et.raw_due_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION get_all_tasks()
RETURNS TABLE(
    id text,
    title text,
    description text,
    contact text,
    contact_id text,
    contact_phone text,
    status text,
    due_date text,
    priority text,
    owner text,
    hubspot_id text,
    queue text,
    queue_ids text[],
    is_unassigned boolean,
    completion_date timestamptz
) 
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    valid_owners text[];
    paris_now timestamptz;
    paris_today date;
BEGIN
    -- Get valid owner IDs
    SELECT get_valid_owner_ids() INTO valid_owners;
    
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
        et.completion_date
    FROM enriched_tasks et
    WHERE (
        -- Valid owner assigned tasks
        (et.hubspot_owner_id = ANY(valid_owners) OR et.is_unassigned = true)
    )
    ORDER BY 
        CASE WHEN et.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN et.queue = 'new' AND et.is_unassigned THEN et.created_at END ASC,
        et.raw_due_date ASC;
END;
$$;