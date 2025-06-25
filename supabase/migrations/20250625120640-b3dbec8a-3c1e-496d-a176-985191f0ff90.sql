
-- Create tasks table to cache HubSpot tasks
CREATE TABLE public.tasks (
  id TEXT PRIMARY KEY, -- HubSpot task ID
  title TEXT NOT NULL,
  description TEXT,
  contact TEXT NOT NULL,
  contact_id TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'completed')),
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  owner TEXT NOT NULL,
  hubspot_id TEXT NOT NULL,
  queue TEXT NOT NULL CHECK (queue IN ('rappels', 'new', 'attempted', 'other')),
  queue_ids TEXT[] NOT NULL DEFAULT '{}',
  is_unassigned BOOLEAN NOT NULL DEFAULT false,
  completion_date TIMESTAMPTZ,
  hs_lastmodifieddate TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sync metadata table to track last sync per owner
CREATE TABLE public.sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL UNIQUE,
  last_sync_timestamp TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00'::timestamptz,
  last_sync_success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_tasks_owner ON public.tasks(owner);
CREATE INDEX idx_tasks_queue ON public.tasks(queue);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_lastmodified ON public.tasks(hs_lastmodifieddate);
CREATE INDEX idx_tasks_owner_queue_status ON public.tasks(owner, queue, status);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON public.tasks 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sync_metadata_updated_at 
    BEFORE UPDATE ON public.sync_metadata 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security (we'll add policies later if needed)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (we can restrict later if needed)
CREATE POLICY "Allow all operations on tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Allow all operations on sync_metadata" ON public.sync_metadata FOR ALL USING (true);

-- Enable realtime for tasks table so frontend gets instant updates
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
