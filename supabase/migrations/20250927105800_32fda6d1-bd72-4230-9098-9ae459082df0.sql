-- Create hs_list_memberships table
CREATE TABLE public.hs_list_memberships (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    object TEXT,
    hs_object_id TEXT,
    hs_queue_id TEXT,
    list_entry_date TIMESTAMP WITH TIME ZONE,
    list_exit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.hs_list_memberships ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (following existing pattern)
CREATE POLICY "Allow all operations on hs_list_memberships" 
ON public.hs_list_memberships 
FOR ALL 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hs_list_memberships_updated_at
    BEFORE UPDATE ON public.hs_list_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();