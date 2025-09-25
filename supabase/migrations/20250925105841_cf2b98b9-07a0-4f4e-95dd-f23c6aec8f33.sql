-- Add locks_lower_categories column to task_categories table
ALTER TABLE public.task_categories 
ADD COLUMN locks_lower_categories boolean DEFAULT false;

-- Update the existing "new" category to have the locking behavior by default
-- This maintains backward compatibility with the current hard-coded behavior
UPDATE public.task_categories 
SET locks_lower_categories = true 
WHERE hs_queue_id = '22859489'; -- NEW queue ID from constants