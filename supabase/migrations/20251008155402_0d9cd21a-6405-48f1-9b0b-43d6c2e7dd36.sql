-- Step 1: Validate and prepare data

-- Add unique constraint on task_categories.hs_queue_id (allow NULL values to remain non-unique)
CREATE UNIQUE INDEX IF NOT EXISTS task_categories_hs_queue_id_unique 
ON task_categories(hs_queue_id) 
WHERE hs_queue_id IS NOT NULL;

-- Null-out orphan queue references in hs_tasks
UPDATE hs_tasks 
SET hs_queue_membership_ids = NULL 
WHERE hs_queue_membership_ids IS NOT NULL 
  AND hs_queue_membership_ids NOT IN (
    SELECT hs_queue_id 
    FROM task_categories 
    WHERE hs_queue_id IS NOT NULL
  );

-- Step 2: Create the required foreign keys

-- Add FK: hs_tasks_hs_queue_membership_ids_fkey
ALTER TABLE hs_tasks
ADD CONSTRAINT hs_tasks_hs_queue_membership_ids_fkey
FOREIGN KEY (hs_queue_membership_ids)
REFERENCES task_categories(hs_queue_id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Add FK: fk_task_automations_category (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_task_automations_category'
  ) THEN
    ALTER TABLE task_automations
    ADD CONSTRAINT fk_task_automations_category
    FOREIGN KEY (task_category_id)
    REFERENCES task_categories(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_hs_tasks_queue 
ON hs_tasks(hs_queue_membership_ids);

CREATE INDEX IF NOT EXISTS idx_task_automations_category 
ON task_automations(task_category_id);