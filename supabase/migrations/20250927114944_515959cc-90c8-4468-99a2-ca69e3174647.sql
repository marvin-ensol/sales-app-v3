-- Update existing hs_list_memberships to set last_api_call to current timestamp
UPDATE hs_list_memberships 
SET last_api_call = now() 
WHERE last_api_call IS NULL;