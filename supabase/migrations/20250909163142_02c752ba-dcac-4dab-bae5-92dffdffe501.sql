-- Add new contact properties columns to hs_contacts table
ALTER TABLE public.hs_contacts 
ADD COLUMN IF NOT EXISTS mobilephone text,
ADD COLUMN IF NOT EXISTS ensol_source_group text,
ADD COLUMN IF NOT EXISTS hs_lead_status text,
ADD COLUMN IF NOT EXISTS lifecyclestage text;