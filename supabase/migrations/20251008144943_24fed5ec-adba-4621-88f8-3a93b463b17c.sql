-- Fix hs_contacts table security: restrict access to authenticated users only
-- This prevents public access to customer contact information

-- Drop the overly permissive policy that allows public access
DROP POLICY IF EXISTS "Allow all operations on hs_contacts" ON public.hs_contacts;

-- Create secure policies that restrict access to authenticated users only
CREATE POLICY "Authenticated users can view contacts"
  ON public.hs_contacts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contacts"
  ON public.hs_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON public.hs_contacts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contacts"
  ON public.hs_contacts
  FOR DELETE
  TO authenticated
  USING (true);