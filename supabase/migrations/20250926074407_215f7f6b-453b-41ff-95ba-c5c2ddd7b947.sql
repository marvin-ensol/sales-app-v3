-- Create lists table to store HubSpot contact lists
CREATE TABLE public.lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'contacts',
  data JSONB NOT NULL,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add sequence_list_id column to task_categories
ALTER TABLE public.task_categories 
ADD COLUMN sequence_list_id TEXT;

-- Enable RLS on lists table
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for lists table
CREATE POLICY "Allow all operations on lists" 
ON public.lists 
FOR ALL 
USING (true);

-- Add updated_at trigger for lists table
CREATE TRIGGER update_lists_updated_at
BEFORE UPDATE ON public.lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();