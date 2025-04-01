-- Migration to add roadmap and task checklist text fields to projects table
ALTER TABLE projects ADD roadmap_text TEXT;
ALTER TABLE projects ADD tasks_checklist TEXT;

-- Update existing projects with empty values if fields are null
UPDATE projects SET roadmap_text = '' WHERE roadmap_text IS NULL;
UPDATE projects SET tasks_checklist = '' WHERE tasks_checklist IS NULL; 