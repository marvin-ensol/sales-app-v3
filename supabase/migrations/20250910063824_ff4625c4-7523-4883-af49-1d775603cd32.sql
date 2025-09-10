-- Phase 1: Simplify sync_metadata table to single global row
-- Drop the existing table
DROP TABLE IF EXISTS sync_metadata;

-- Create new simplified sync_metadata table
CREATE TABLE public.sync_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL DEFAULT 'full',
  last_sync_timestamp timestamp with time zone NOT NULL DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone,
  last_sync_success boolean NOT NULL DEFAULT false,
  sync_duration integer DEFAULT 0,
  tasks_added integer DEFAULT 0,
  tasks_updated integer DEFAULT 0,
  tasks_deleted integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on sync_metadata" 
ON public.sync_metadata 
FOR ALL 
USING (true);

-- Insert the initial global row
INSERT INTO public.sync_metadata (sync_type, last_sync_success) VALUES ('full', false);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sync_metadata_updated_at
BEFORE UPDATE ON public.sync_metadata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();