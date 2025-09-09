-- Drop and recreate enriched_tasks view with correct queue ID mappings

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
    CASE 
        WHEN t.hs_timestamp IS NOT NULL THEN 
            to_char(t.hs_timestamp AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY à HH24:MI')
        ELSE 'Pas de date'
    END as due_date,
    CASE 
        WHEN t.hs_task_priority = 'HIGH' THEN 'high'
        WHEN t.hs_task_priority = 'MEDIUM' THEN 'medium'
        ELSE 'low'
    END as priority,
    COALESCE(u.first_name || ' ' || u.last_name, 'Unassigned') as owner,
    t.hs_object_id as hubspot_id,
    CASE 
        WHEN t.hs_queue_membership_ids LIKE '%22933271%' THEN 'rappels'
        WHEN t.hs_queue_membership_ids LIKE '%22859489%' THEN 'new'
        WHEN t.hs_queue_membership_ids LIKE '%22859490%' THEN 'attempted'
        WHEN t.hs_queue_membership_ids LIKE '%22934016%' THEN 'simulations'
        WHEN t.hs_queue_membership_ids LIKE '%22934015%' THEN 'communications'
        ELSE 'other'
    END as queue,
    ARRAY[t.hs_queue_membership_ids] as queue_ids,
    CASE 
        WHEN t.hubspot_owner_id IS NULL OR t.hubspot_owner_id = '' THEN true
        ELSE false
    END as is_unassigned,
    CASE 
        WHEN t.hs_task_status = 'COMPLETED' THEN t.hs_task_completion_date
        ELSE NULL
    END as completion_date,
    t.created_at,
    t.updated_at,
    t.hs_task_completion_date,
    t.hs_timestamp as raw_due_date,
    t.hubspot_owner_id,
    t.associated_deal_id

FROM hs_tasks t
LEFT JOIN hs_contacts c ON t.associated_contact_id = c.hs_object_id
LEFT JOIN hs_users u ON t.hubspot_owner_id = u.owner_id
WHERE t.archived = false;