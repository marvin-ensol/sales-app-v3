-- Create sync_control table to manage sync operations
CREATE TABLE public.sync_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_paused boolean NOT NULL DEFAULT false,
  custom_sync_timestamp timestamptz NULL,
  paused_by text NULL,
  paused_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_control ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on sync_control" 
ON public.sync_control 
FOR ALL 
USING (true);

-- Insert initial record
INSERT INTO sync_control (is_paused) VALUES (false);

-- Create trigger for updated_at
CREATE TRIGGER update_sync_control_updated_at
BEFORE UPDATE ON public.sync_control
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();