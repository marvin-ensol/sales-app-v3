-- Rename display_sequence_card to display_automation_card in task_categories table
ALTER TABLE public.task_categories 
RENAME COLUMN display_sequence_card TO display_automation_card;

-- Add an enabled column for the ON/OFF toggle functionality
ALTER TABLE public.task_categories 
ADD COLUMN automation_enabled boolean NOT NULL DEFAULT true;