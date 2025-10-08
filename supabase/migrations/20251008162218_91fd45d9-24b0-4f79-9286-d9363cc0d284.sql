-- Add exit_processed_at column to track which exits have been processed
ALTER TABLE hs_list_memberships
ADD COLUMN IF NOT EXISTS exit_processed_at timestamptz;

-- Add index for efficient querying of unprocessed exits
CREATE INDEX IF NOT EXISTS idx_hs_list_memberships_exit_status
ON hs_list_memberships(list_exit_date, exit_processed_at)
WHERE list_exit_date IS NOT NULL;