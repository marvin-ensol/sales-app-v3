-- Remove duplicate Simulations entry (keep the newer one)
DELETE FROM task_categories WHERE id = 2;

-- Update the task_categories table to ensure proper data
UPDATE task_categories SET hs_queue_id = 'other' WHERE hs_queue_id IS NULL;