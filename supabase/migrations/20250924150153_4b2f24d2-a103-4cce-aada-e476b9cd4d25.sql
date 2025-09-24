-- Add associated_company_id column to hs_tasks table
ALTER TABLE public.hs_tasks 
ADD COLUMN associated_company_id text;