-- Update enriched_tasks view to include associated_deal_id
CREATE OR REPLACE VIEW enriched_tasks AS
SELECT 
    t.hs_object_id AS id,
    t.hs_task_subject AS title,
    t.hs_task_body AS description,
    COALESCE((c.firstname || ' ') || c.lastname, 'Unknown Contact') AS contact,
    t.associated_contact_id AS contact_id,
    c.mobilephone AS contact_phone,
    CASE 
        WHEN t.hs_task_status = 'COMPLETED' THEN 'completed'
        ELSE 'not_started'
    END AS status,
    COALESCE((t.hs_timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::text, CURRENT_DATE::text) AS due_date,
    CASE 
        WHEN t.hs_task_priority = 'HIGH' THEN 'high'
        WHEN t.hs_task_priority = 'MEDIUM' THEN 'medium'
        ELSE 'low'
    END AS priority,
    COALESCE(u.full_name, 'Unassigned') AS owner,
    t.hs_object_id AS hubspot_id,
    CASE 
        WHEN t.hs_queue_membership_ids LIKE '%859803242%' THEN 'rappels'
        WHEN t.hs_queue_membership_ids LIKE '%859787764%' THEN 'new'
        WHEN t.hs_queue_membership_ids LIKE '%859796481%' THEN 'simulations'
        WHEN t.hs_queue_membership_ids LIKE '%859787765%' THEN 'communications'
        WHEN t.hs_queue_membership_ids LIKE '%859787766%' THEN 'attempted'
        ELSE 'other'
    END AS queue,
    COALESCE(string_to_array(t.hs_queue_membership_ids, ';'), ARRAY[]::text[]) AS queue_ids,
    CASE 
        WHEN t.hubspot_owner_id IS NULL THEN true
        ELSE false
    END AS is_unassigned,
    t.hs_task_completion_date AS completion_date,
    t.hubspot_owner_id,
    t.hs_timestamp AS raw_due_date,
    t.hs_task_completion_date,
    t.created_at,
    t.updated_at,
    t.associated_deal_id
FROM hs_tasks t
LEFT JOIN hs_contacts c ON t.associated_contact_id = c.hs_object_id
LEFT JOIN hs_users u ON t.hubspot_owner_id = u.owner_id AND u.archived = false
WHERE t.archived = false;