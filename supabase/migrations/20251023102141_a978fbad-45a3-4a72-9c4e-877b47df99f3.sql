-- Add automation_id column to events table for tracking which automation triggered the event
ALTER TABLE public.events 
ADD COLUMN automation_id uuid REFERENCES public.task_automations(id) ON DELETE SET NULL;

-- Create index for efficient filtering by automation
CREATE INDEX idx_events_automation_id ON public.events(automation_id);

COMMENT ON COLUMN public.events.automation_id IS 'References the task automation that triggered this event (for list_entry, list_exit events)';