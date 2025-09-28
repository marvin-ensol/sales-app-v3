-- First, populate user_id with the HubSpot user ID (which should be in owner_id currently)
UPDATE hs_users SET user_id = owner_id WHERE user_id IS NULL;

-- Make user_id NOT NULL since it will be the primary key
ALTER TABLE hs_users ALTER COLUMN user_id SET NOT NULL;

-- Drop the existing primary key constraint on id (correct constraint name)
ALTER TABLE hs_users DROP CONSTRAINT hs_owners_pkey;

-- Drop the unique constraint on owner_id since user_id will replace it
ALTER TABLE hs_users DROP CONSTRAINT hs_owners_owner_id_key;

-- Drop the id column entirely
ALTER TABLE hs_users DROP COLUMN id;

-- Set user_id as the new primary key
ALTER TABLE hs_users ADD PRIMARY KEY (user_id);