-- Add unique constraint to task_categories.hs_queue_id
-- This is required before we can create a foreign key referencing it
ALTER TABLE task_categories
ADD CONSTRAINT unique_hs_queue_id UNIQUE (hs_queue_id);

-- Add foreign key constraint from hs_tasks to task_categories
-- This allows Supabase nested queries to work properly
ALTER TABLE hs_tasks 
ADD CONSTRAINT fk_hs_tasks_category 
FOREIGN KEY (hs_queue_membership_ids) 
REFERENCES task_categories(hs_queue_id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_hs_tasks_queue_membership 
ON hs_tasks(hs_queue_membership_ids);