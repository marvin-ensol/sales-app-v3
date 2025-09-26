-- Migrate schedule_configuration from JSONB to JSON to preserve key ordering
ALTER TABLE public.task_categories 
ALTER COLUMN schedule_configuration TYPE json USING schedule_configuration::json;