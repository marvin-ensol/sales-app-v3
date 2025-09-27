-- Fix existing task_automations with null or invalid configurations
UPDATE task_automations 
SET 
  tasks_configuration = '{"tasks": []}'::jsonb
WHERE 
  tasks_configuration IS NULL 
  OR tasks_configuration = '{}'::jsonb 
  OR NOT (tasks_configuration ? 'tasks')
  OR NOT jsonb_typeof(tasks_configuration->'tasks') = 'array';

-- Fix existing task_automations with null or invalid schedule configurations  
UPDATE task_automations 
SET 
  schedule_configuration = '{"delay": 1, "unit": "hours"}'::jsonb
WHERE 
  schedule_configuration IS NULL 
  OR schedule_configuration::text = '{}';