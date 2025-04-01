-- Migration to add missing columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_name VARCHAR(255);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_order INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_order INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_duration VARCHAR(100);

-- Set appropriate values for existing tasks if needed
UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;
UPDATE tasks SET phase_order = 0 WHERE phase_order IS NULL;
UPDATE tasks SET task_order = 0 WHERE task_order IS NULL; 