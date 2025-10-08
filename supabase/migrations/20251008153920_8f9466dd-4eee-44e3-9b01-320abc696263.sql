-- Priority 1 & 2: Add Foreign Key Constraints for Data Integrity

-- Handle orphaned owner IDs (19 tasks with non-existent owners)
UPDATE hs_tasks 
SET hubspot_owner_id = NULL 
WHERE hubspot_owner_id NOT IN (SELECT owner_id FROM hs_users);

-- Add unique constraint to hs_contacts.hs_object_id (if not exists)
ALTER TABLE hs_contacts
ADD CONSTRAINT unique_hs_object_id UNIQUE (hs_object_id);

-- Add unique constraint to hs_users.owner_id (if not exists)
ALTER TABLE hs_users
ADD CONSTRAINT unique_owner_id UNIQUE (owner_id);

-- Priority 1.1: Add FK from hs_tasks.associated_contact_id to hs_contacts
ALTER TABLE hs_tasks 
ADD CONSTRAINT fk_hs_tasks_contact 
FOREIGN KEY (associated_contact_id) 
REFERENCES hs_contacts(hs_object_id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Priority 1.2: Add FK from hs_tasks.hubspot_owner_id to hs_users
ALTER TABLE hs_tasks 
ADD CONSTRAINT fk_hs_tasks_owner 
FOREIGN KEY (hubspot_owner_id) 
REFERENCES hs_users(owner_id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Priority 2.1: Add FK from task_automation_runs.automation_id to task_automations
ALTER TABLE task_automation_runs 
ADD CONSTRAINT fk_automation_runs_automation 
FOREIGN KEY (automation_id) 
REFERENCES task_automations(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Priority 2.2: Add FK from task_automation_runs.hs_contact_id to hs_contacts
ALTER TABLE task_automation_runs 
ADD CONSTRAINT fk_automation_runs_contact 
FOREIGN KEY (hs_contact_id) 
REFERENCES hs_contacts(hs_object_id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_hs_tasks_contact 
ON hs_tasks(associated_contact_id);

CREATE INDEX IF NOT EXISTS idx_hs_tasks_owner 
ON hs_tasks(hubspot_owner_id);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation 
ON task_automation_runs(automation_id);

CREATE INDEX IF NOT EXISTS idx_automation_runs_contact 
ON task_automation_runs(hs_contact_id);