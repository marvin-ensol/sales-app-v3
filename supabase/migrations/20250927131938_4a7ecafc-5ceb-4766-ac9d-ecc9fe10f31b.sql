-- Phase 1: Database Migration for Task Automations Separation

-- 1. Add foreign key constraint between task_automations and task_categories if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_task_automations_category'
    ) THEN
        ALTER TABLE task_automations 
        ADD CONSTRAINT fk_task_automations_category 
        FOREIGN KEY (task_category_id) REFERENCES task_categories(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_automations_category_id ON task_automations(task_category_id);
CREATE INDEX IF NOT EXISTS idx_hs_list_memberships_automation_id ON hs_list_memberships(automation_id);

-- 3. Update hs_list_memberships to reference automations via automation_id
-- For existing records that don't have automation_id set, try to match via hs_queue_id
UPDATE hs_list_memberships 
SET automation_id = ta.id
FROM task_automations ta
JOIN task_categories tc ON ta.task_category_id = tc.id
WHERE hs_list_memberships.hs_queue_id = tc.hs_queue_id
  AND hs_list_memberships.automation_id IS NULL;