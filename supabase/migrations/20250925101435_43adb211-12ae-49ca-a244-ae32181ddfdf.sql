-- Add visible_team_ids column to task_categories table
ALTER TABLE task_categories 
ADD COLUMN visible_team_ids jsonb DEFAULT '[]'::jsonb;

-- Set default for existing categories (all teams visible by getting all distinct team IDs)
UPDATE task_categories 
SET visible_team_ids = (
  SELECT jsonb_agg(DISTINCT team_id)
  FROM hs_users 
  WHERE team_id IS NOT NULL 
  AND archived = false
)
WHERE visible_team_ids = '[]'::jsonb OR visible_team_ids IS NULL;