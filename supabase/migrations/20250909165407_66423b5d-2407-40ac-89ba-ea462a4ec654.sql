-- Enable real-time for tables that need real-time subscriptions
ALTER TABLE hs_tasks REPLICA IDENTITY FULL;
ALTER TABLE hs_contacts REPLICA IDENTITY FULL;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE hs_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE hs_contacts;