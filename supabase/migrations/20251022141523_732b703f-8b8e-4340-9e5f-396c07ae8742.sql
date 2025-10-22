-- Change events table id from UUID to sequential bigint
-- First, drop the existing primary key constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_pkey;

-- Drop the existing id column
ALTER TABLE public.events DROP COLUMN id;

-- Add new id column as BIGSERIAL (auto-incrementing bigint starting from 1)
ALTER TABLE public.events ADD COLUMN id BIGSERIAL PRIMARY KEY;
