-- Update the "Autres" category to have NULL queue ID (true fallback category)
UPDATE task_categories 
SET hs_queue_id = NULL 
WHERE label = 'Autres' AND hs_queue_id = 'other';

-- Update the enriched_tasks view to handle proper fallback logic
CREATE OR REPLACE VIEW public.enriched_tasks AS 
SELECT t.hs_object_id AS id,
    t.hs_task_subject AS title,
    t.hs_task_body AS description,
    COALESCE(((c.firstname || ' '::text) || c.lastname), 'Unknown Contact'::text) AS contact,
    t.associated_contact_id AS contact_id,
    c.mobilephone AS contact_phone,
        CASE
            WHEN (t.hs_task_status = 'COMPLETED'::text) THEN 'completed'::text
            ELSE 'not_started'::text
        END AS status,
        CASE
            WHEN (t.hs_timestamp IS NOT NULL) THEN to_char((t.hs_timestamp AT TIME ZONE 'Europe/Paris'::text), 'DD/MM/YYYY à HH24:MI'::text)
            ELSE 'Pas de date'::text
        END AS due_date,
        CASE
            WHEN (t.hs_task_priority = 'HIGH'::text) THEN 'high'::text
            WHEN (t.hs_task_priority = 'MEDIUM'::text) THEN 'medium'::text
            ELSE 'low'::text
        END AS priority,
    COALESCE(((u.first_name || ' '::text) || u.last_name), 'Unassigned'::text) AS owner,
    t.hs_object_id AS hubspot_id,
        CASE
            WHEN (t.hs_queue_membership_ids ~~ '%22933271%'::text) THEN 'rappels'::text
            WHEN (t.hs_queue_membership_ids ~~ '%22859489%'::text) THEN 'new'::text
            WHEN (t.hs_queue_membership_ids ~~ '%22859490%'::text) THEN 'attempted'::text
            WHEN (t.hs_queue_membership_ids ~~ '%22934016%'::text) THEN 'simulations'::text
            WHEN (t.hs_queue_membership_ids ~~ '%22934015%'::text) THEN 'communications'::text
            WHEN (t.hs_queue_membership_ids ~~ '%22697278%'::text) THEN 'upsell'::text
            WHEN (t.hs_queue_membership_ids ~~ '%22839689%'::text) THEN 'securisation'::text
            -- Fallback for tasks with null/empty queue IDs or unmatched queue IDs
            ELSE 'other'::text
        END AS queue,
    ARRAY[t.hs_queue_membership_ids] AS queue_ids,
        CASE
            WHEN ((t.hubspot_owner_id IS NULL) OR (t.hubspot_owner_id = ''::text)) THEN true
            ELSE false
        END AS is_unassigned,
        CASE
            WHEN (t.hs_task_status = 'COMPLETED'::text) THEN t.hs_task_completion_date
            ELSE NULL::timestamp with time zone
        END AS completion_date,
    t.created_at,
    t.updated_at,
    t.hs_task_completion_date,
    t.hs_timestamp AS raw_due_date,
    t.hubspot_owner_id,
    t.associated_deal_id
   FROM ((hs_tasks t
     LEFT JOIN hs_contacts c ON ((t.associated_contact_id = c.hs_object_id)))
     LEFT JOIN hs_users u ON ((t.hubspot_owner_id = u.owner_id)))
  WHERE (t.archived = false);