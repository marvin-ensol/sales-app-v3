-- Enhance sync_metadata table to support incremental sync tracking
ALTER TABLE sync_metadata 
ADD COLUMN IF NOT EXISTS incremental_sync_timestamp timestamptz DEFAULT '1970-01-01 00:00:00+00'::timestamptz,
ADD COLUMN IF NOT EXISTS full_sync_timestamp timestamptz DEFAULT '1970-01-01 00:00:00+00'::timestamptz,
ADD COLUMN IF NOT EXISTS tasks_added integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tasks_updated integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tasks_deleted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sync_type text DEFAULT 'full',
ADD COLUMN IF NOT EXISTS sync_duration integer DEFAULT 0;

-- Update existing records to have proper full_sync_timestamp values
UPDATE sync_metadata 
SET full_sync_timestamp = last_sync_timestamp 
WHERE full_sync_timestamp = '1970-01-01 00:00:00+00'::timestamptz;