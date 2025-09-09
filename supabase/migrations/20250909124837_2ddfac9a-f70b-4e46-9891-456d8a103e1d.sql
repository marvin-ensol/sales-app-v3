-- Create hs_tasks table to store HubSpot task data
CREATE TABLE public.hs_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hs_object_id TEXT NOT NULL UNIQUE,
  hs_body_preview TEXT,
  hs_body_preview_html TEXT,
  hs_created_by_user_id TEXT,
  hs_createdate TIMESTAMP WITH TIME ZONE,
  hs_lastmodifieddate TIMESTAMP WITH TIME ZONE,
  hs_pipeline TEXT,
  hs_pipeline_stage TEXT,
  hs_queue_membership_ids TEXT,
  hs_task_body TEXT,
  hs_task_completion_count INTEGER DEFAULT 0,
  hs_task_completion_date TIMESTAMP WITH TIME ZONE,
  hs_task_family TEXT,
  hs_task_for_object_type TEXT,
  hs_task_is_all_day BOOLEAN DEFAULT false,
  hs_task_is_overdue BOOLEAN DEFAULT false,
  hs_task_last_contact_outreach TIMESTAMP WITH TIME ZONE,
  hs_task_priority TEXT,
  hs_task_status TEXT,
  hs_task_subject TEXT,
  hs_task_type TEXT,
  hs_timestamp TIMESTAMP WITH TIME ZONE,
  hs_updated_by_user_id TEXT,
  hs_duration TEXT,
  hubspot_owner_assigneddate TIMESTAMP WITH TIME ZONE,
  hubspot_owner_id TEXT,
  hubspot_team_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived BOOLEAN DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.hs_tasks ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (adjust as needed based on your security requirements)
CREATE POLICY "Allow all operations on hs_tasks" 
ON public.hs_tasks 
FOR ALL 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_hs_tasks_object_id ON public.hs_tasks(hs_object_id);
CREATE INDEX idx_hs_tasks_owner_id ON public.hs_tasks(hubspot_owner_id);
CREATE INDEX idx_hs_tasks_status ON public.hs_tasks(hs_task_status);
CREATE INDEX idx_hs_tasks_priority ON public.hs_tasks(hs_task_priority);
CREATE INDEX idx_hs_tasks_type ON public.hs_tasks(hs_task_type);
CREATE INDEX idx_hs_tasks_timestamp ON public.hs_tasks(hs_timestamp);
CREATE INDEX idx_hs_tasks_created_at ON public.hs_tasks(created_at);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hs_tasks_updated_at
BEFORE UPDATE ON public.hs_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();