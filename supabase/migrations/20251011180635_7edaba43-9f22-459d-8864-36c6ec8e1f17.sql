-- Enable full row data for realtime subscriptions
-- This ensures complete row data is captured during updates

ALTER TABLE hs_tasks REPLICA IDENTITY FULL;
ALTER TABLE hs_contacts REPLICA IDENTITY FULL;
ALTER TABLE hs_users REPLICA IDENTITY FULL;
ALTER TABLE hs_list_memberships REPLICA IDENTITY FULL;
ALTER TABLE task_categories REPLICA IDENTITY FULL;
ALTER TABLE sync_executions REPLICA IDENTITY FULL;

-- Create monitoring view for subscription health
CREATE OR REPLACE VIEW realtime_subscription_health AS
SELECT 
  schemaname,
  relname as tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('hs_tasks', 'hs_contacts', 'hs_users', 'hs_list_memberships', 'task_categories', 'sync_executions');

-- Grant access to the monitoring view
GRANT SELECT ON realtime_subscription_health TO authenticated;