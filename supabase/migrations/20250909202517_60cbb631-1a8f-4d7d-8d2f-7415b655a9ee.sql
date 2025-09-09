-- Drop the existing view to recreate it properly
DROP VIEW IF EXISTS public.hs_tasks_readable;

-- Create a readable view for hs_tasks with owner names and category labels
-- Using standard view (not security definer) to respect RLS policies
CREATE VIEW public.hs_tasks_readable AS
SELECT 
    ht.*,
    hu.full_name as owner_full_name,
    hu.email as owner_email,
    hu.first_name as owner_first_name,
    hu.last_name as owner_last_name,
    tc.label as category_label,
    tc.color as category_color
FROM hs_tasks ht
LEFT JOIN hs_users hu ON ht.hubspot_owner_id = hu.owner_id
LEFT JOIN task_categories tc ON ht.hs_queue_membership_ids = tc.hs_queue_id
ORDER BY ht.created_at DESC;