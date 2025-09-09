-- Rename hs_owners table to hs_users
ALTER TABLE public.hs_owners RENAME TO hs_users;

-- Update the RLS policy name to reflect the new table name
DROP POLICY "Allow all operations on hs_owners" ON public.hs_users;
CREATE POLICY "Allow all operations on hs_users" 
ON public.hs_users 
FOR ALL 
USING (true);