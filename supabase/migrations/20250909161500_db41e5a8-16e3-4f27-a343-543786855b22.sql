-- Create function to get task categories since table is not in types
CREATE OR REPLACE FUNCTION get_task_categories()
RETURNS TABLE (
  id bigint,
  label text,
  color text,
  hs_queue_id text
) AS $$
BEGIN
  RETURN QUERY
  SELECT tc.id, tc.label, tc.color, tc.hs_queue_id
  FROM task_categories tc
  ORDER BY tc.id;
END;
$$ LANGUAGE plpgsql;