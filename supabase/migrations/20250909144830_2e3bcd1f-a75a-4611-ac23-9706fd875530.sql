-- Create hs_contacts table
CREATE TABLE public.hs_contacts (
  hs_object_id TEXT NOT NULL PRIMARY KEY,
  firstname TEXT,
  lastname TEXT,
  hs_createdate TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add associated_contact_id column to hs_tasks
ALTER TABLE public.hs_tasks 
ADD COLUMN associated_contact_id TEXT;

-- Enable RLS on hs_contacts
ALTER TABLE public.hs_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for hs_contacts (allowing all operations for now)
CREATE POLICY "Allow all operations on hs_contacts" 
ON public.hs_contacts 
FOR ALL 
USING (true);

-- Add foreign key constraint
ALTER TABLE public.hs_tasks 
ADD CONSTRAINT fk_hs_tasks_associated_contact 
FOREIGN KEY (associated_contact_id) 
REFERENCES public.hs_contacts(hs_object_id);

-- Add trigger for hs_contacts updated_at
CREATE TRIGGER update_hs_contacts_updated_at
BEFORE UPDATE ON public.hs_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();