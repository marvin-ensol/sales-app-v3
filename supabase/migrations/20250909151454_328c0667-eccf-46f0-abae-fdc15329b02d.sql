-- Rename columns in hs_contacts table to match HubSpot API naming
ALTER TABLE public.hs_contacts 
RENAME COLUMN hs_createdate TO createdate;

ALTER TABLE public.hs_contacts 
RENAME COLUMN hs_lastmodifieddate TO lastmodifieddate;