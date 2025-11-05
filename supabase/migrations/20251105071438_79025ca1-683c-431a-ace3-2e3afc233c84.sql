-- Disable the Test automation to prevent auto-completion on engagement
UPDATE task_automations 
SET automation_enabled = false 
WHERE id = 'd438072f-9759-4b0f-a90a-059c08c4f3d7';