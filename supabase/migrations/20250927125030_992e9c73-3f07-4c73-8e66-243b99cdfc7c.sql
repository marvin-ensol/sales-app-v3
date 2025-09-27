-- Create task_automations table
CREATE TABLE public.task_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_category_id bigint NOT NULL,
  name text NOT NULL,
  hs_list_id text,
  hs_list_object text DEFAULT 'contacts'::text,
  automation_enabled boolean NOT NULL DEFAULT false,
  sequence_enabled boolean,
  sequence_exit_enabled boolean,
  first_task_creation boolean,
  auto_complete_on_exit_enabled boolean DEFAULT false,
  schedule_enabled boolean DEFAULT false,
  schedule_configuration json,
  tasks_configuration jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_task_category 
    FOREIGN KEY (task_category_id) 
    REFERENCES public.task_categories(id) 
    ON DELETE CASCADE
);

-- Add RLS policies for task_automations
ALTER TABLE public.task_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on task_automations" 
ON public.task_automations 
FOR ALL 
USING (true);

-- Add automation_id column to hs_list_memberships
ALTER TABLE public.hs_list_memberships 
ADD COLUMN automation_id uuid REFERENCES public.task_automations(id) ON DELETE SET NULL;

-- Create trigger for updated_at on task_automations
CREATE TRIGGER update_task_automations_updated_at
  BEFORE UPDATE ON public.task_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing automation data from task_categories to task_automations
INSERT INTO public.task_automations (
  task_category_id,
  name,
  hs_list_id,
  hs_list_object,
  automation_enabled,
  sequence_enabled,
  sequence_exit_enabled,
  first_task_creation,
  auto_complete_on_exit_enabled,
  schedule_enabled,
  schedule_configuration,
  tasks_configuration
)
SELECT 
  id,
  CONCAT(label, ' Automation') as name,
  hs_list_id,
  hs_list_object,
  automation_enabled,
  sequence_enabled,
  sequence_exit_enabled,
  first_task_creation,
  auto_complete_on_exit_enabled,
  schedule_enabled,
  schedule_configuration,
  tasks_configuration
FROM public.task_categories
WHERE automation_enabled = true OR display_automation_card = true;

-- Update hs_list_memberships to reference the new automation records
UPDATE public.hs_list_memberships 
SET automation_id = ta.id
FROM public.task_automations ta
JOIN public.task_categories tc ON ta.task_category_id = tc.id
WHERE hs_list_memberships.hs_queue_id = tc.hs_queue_id
AND ta.hs_list_id IS NOT NULL;