-- Add display_sequence_card column to task_categories table
-- This will control whether a sequence card appears on the sequences page
ALTER TABLE public.task_categories 
ADD COLUMN display_sequence_card boolean NOT NULL DEFAULT false;