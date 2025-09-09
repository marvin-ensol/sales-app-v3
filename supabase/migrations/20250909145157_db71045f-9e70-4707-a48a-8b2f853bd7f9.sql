-- Add hs_lastmodifieddate column to hs_contacts table
ALTER TABLE public.hs_contacts 
ADD COLUMN hs_lastmodifieddate TIMESTAMP WITH TIME ZONE;