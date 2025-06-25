
-- Add the hs_timestamp column to store the raw HubSpot timestamp
ALTER TABLE public.tasks ADD COLUMN hs_timestamp TEXT;

-- Add an index for performance when filtering by timestamp
CREATE INDEX idx_tasks_hs_timestamp ON public.tasks(hs_timestamp);
