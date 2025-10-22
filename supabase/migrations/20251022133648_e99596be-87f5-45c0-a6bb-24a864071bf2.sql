-- Create the events table to progressively replace task_automation_runs
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  event TEXT NOT NULL,
  hs_engagement_id TEXT,
  hs_contact_id TEXT,
  logs JSONB DEFAULT '[]'::jsonb,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all operations on events"
ON public.events
FOR ALL
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_events_type ON public.events(type);
CREATE INDEX idx_events_event ON public.events(event);
CREATE INDEX idx_events_hs_contact_id ON public.events(hs_contact_id);
CREATE INDEX idx_events_hs_engagement_id ON public.events(hs_engagement_id);
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);