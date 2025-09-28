-- Fix security linter issues by removing SECURITY DEFINER from enriched_tasks view
-- The view doesn't need SECURITY DEFINER since it's just a view, not a function

-- Recreate the enriched_tasks view without SECURITY DEFINER
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