-- Create hs_owners table for storing HubSpot owner and team information
CREATE TABLE public.hs_owners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  full_name text,
  email text,
  team_id text,
  team_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hs_owners ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is background data)
CREATE POLICY "Allow all operations on hs_owners" 
ON public.hs_owners 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hs_owners_updated_at
BEFORE UPDATE ON public.hs_owners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;