-- Add hubspot_owner_id column to hs_contacts table
ALTER TABLE hs_contacts 
ADD COLUMN hubspot_owner_id text;

-- Create index for better query performance
CREATE INDEX idx_hs_contacts_owner_id ON hs_contacts(hubspot_owner_id);

COMMENT ON COLUMN hs_contacts.hubspot_owner_id IS 'HubSpot owner ID assigned to this contact';