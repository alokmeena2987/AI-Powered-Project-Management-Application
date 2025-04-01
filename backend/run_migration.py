import os
from utils.db import execute_query
import traceback

def run_migration():
    """Run the migration to add missing columns to the tasks table"""
    try:
        print("Running migration to add missing columns to tasks table...")
        
        # Add missing columns
        execute_query(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium'",
            fetch=False
        )
        execute_query(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_name VARCHAR(255)",
            fetch=False
        )
        execute_query(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_order INTEGER DEFAULT 0",
            fetch=False
        )
        execute_query(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_order INTEGER DEFAULT 0",
            fetch=False
        )
        execute_query(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_duration VARCHAR(100)",
            fetch=False
        )
        
        # Update existing records
        execute_query(
            "UPDATE tasks SET priority = 'medium' WHERE priority IS NULL",
            fetch=False
        )
        execute_query(
            "UPDATE tasks SET phase_order = 0 WHERE phase_order IS NULL",
            fetch=False
        )
        execute_query(
            "UPDATE tasks SET task_order = 0 WHERE task_order IS NULL",
            fetch=False
        )
        
        print("Migration completed successfully!")
        return True
    except Exception as e:
        print(f"Error running migration: {e}")
        traceback.print_exc()
        return False

def add_roadmap_fields():
    """Add roadmap_text and tasks_checklist fields to projects table"""
    try:
        print("Running migration to add roadmap fields to projects table...")
        
        # Add roadmap and task checklist text fields
        execute_query(
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS roadmap_text TEXT",
            fetch=False
        )
        execute_query(
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS tasks_checklist TEXT",
            fetch=False
        )
        
        # Set default values for existing records
        execute_query(
            "UPDATE projects SET roadmap_text = '' WHERE roadmap_text IS NULL",
            fetch=False
        )
        execute_query(
            "UPDATE projects SET tasks_checklist = '' WHERE tasks_checklist IS NULL",
            fetch=False
        )
        
        print("Added roadmap fields to projects table successfully!")
        return True
    except Exception as e:
        print(f"Error adding roadmap fields: {e}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'add_roadmap_fields':
        add_roadmap_fields()
    else:
        run_migration() 