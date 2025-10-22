-- Add event_id column to error_logs table to establish one-to-many relationship
ALTER TABLE error_logs ADD COLUMN event_id bigint REFERENCES events(id);

-- Create index for better query performance
CREATE INDEX idx_error_logs_event_id ON error_logs(event_id);