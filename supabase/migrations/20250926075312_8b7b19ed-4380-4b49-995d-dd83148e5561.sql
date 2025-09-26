-- Add unique constraint on type column for lists table
ALTER TABLE public.lists ADD CONSTRAINT lists_type_unique UNIQUE (type);