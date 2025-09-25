-- Update the get_task_categories function to accept team filtering
CREATE OR REPLACE FUNCTION public.get_task_categories(team_id_param text DEFAULT NULL)
RETURNS TABLE(id bigint, label text, color text, hs_queue_id text, order_column integer)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT tc.id, tc.label, tc.color, tc.hs_queue_id, tc.order_column
  FROM task_categories tc
  WHERE 
    -- If no team_id provided, return all categories (backward compatibility)
    team_id_param IS NULL
    OR
    -- If team_id provided, filter by visibility
    (
      -- Categories with empty visible_team_ids are visible to everyone
      (tc.visible_team_ids = '[]'::jsonb OR tc.visible_team_ids IS NULL)
      OR
      -- Categories where the team_id is in the visible_team_ids array
      (tc.visible_team_ids ? team_id_param)
    )
  ORDER BY tc.order_column;
END;
$function$