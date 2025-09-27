-- Add hs_list_object column to task_categories
ALTER TABLE public.task_categories 
ADD COLUMN hs_list_object TEXT DEFAULT 'contacts';

-- Update existing records to set hs_list_object = 'contacts' where sequence_list_id is not null
UPDATE public.task_categories 
SET hs_list_object = 'contacts' 
WHERE sequence_list_id IS NOT NULL;

-- Rename sequence_list_id to hs_list_id
ALTER TABLE public.task_categories 
RENAME COLUMN sequence_list_id TO hs_list_id;