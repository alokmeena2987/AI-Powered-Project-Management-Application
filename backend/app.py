import os
import io
import json
import sqlite3
import traceback
from datetime import datetime, timedelta
from functools import wraps
import jwt
from flask import Flask, request, jsonify, send_file, make_response, g
from flask_cors import CORS
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
try:
    from dateutil import parser as dateutil_parser
except ImportError:
    print("Warning: python-dateutil not installed. Date parsing may be limited.")
    dateutil_parser = None

from utils.db import execute_query
from utils.auth import hash_password, check_password, generate_token, token_required
from utils.ai_service import generate_roadmap, generate_progress_report, generate_roadmap_with_custom_prompt
from utils.pdf_generator import create_progress_report_pdf, create_roadmap_pdf
from datetime import datetime
import tempfile
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import traceback
import json
from dateutil import parser
import time
from routes.auth_routes import register_auth_routes
from routes.user_routes import register_user_routes

app = Flask(__name__)
ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:5173']

# Properly configured CORS setup - More permissive configuration
CORS(app, resources={r"/*": {
    "origins": "*",  # Allow all origins for testing
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": "*",  # Allow all headers for testing
    "expose_headers": ["Content-Type", "Authorization", "Content-Disposition"],
    "supports_credentials": False,  # Set to False when using wildcard origin
    "max_age": 86400
}})

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    # Get the origin from the request
    origin = request.headers.get('Origin')
    
    # If origin matches our allowed origins, use it specifically and enable credentials
    if origin in ALLOWED_ORIGINS:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Credentials', 'true')
    else:
        # Otherwise use wildcard (can't be used with credentials)
        response.headers.add('Access-Control-Allow-Origin', '*') 
        
    # Always add these headers
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, access-control-allow-methods, access-control-allow-origin, access-control-allow-headers')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    
    return response

# Error handling for CORS and other common issues
@app.errorhandler(500)
def handle_500_error(e):
    response = jsonify({
        "error": "Internal server error occurred", 
        "details": str(e),
        "status": 500
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response, 500

@app.errorhandler(404)
def handle_404_error(e):
    response = jsonify({
        "error": "Resource not found", 
        "status": 404
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response, 404

@app.errorhandler(405)
def handle_405_error(e):
    response = jsonify({
        "error": "Method not allowed", 
        "status": 405
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response, 405

# Global OPTIONS handler for preflight requests
@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_preflight(path):
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Max-Age', '86400')
    return response, 200

# Register route modules
register_auth_routes(app)
register_user_routes(app)

# Organization routes
@app.route('/api/organizations', methods=['POST'])
@token_required
def create_organization():
    data = request.json
    user_id = request.user['user_id']
    
    org = execute_query(
        """
        INSERT INTO organizations (name, description, created_by)
        VALUES (%s, %s, %s)
        RETURNING id, name, description
        """,
        (data['name'], data.get('description'), user_id),
        fetch=True
    )
    
    # Add creator as admin
    execute_query(
        """
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (%s, %s, %s)
        """,
        (org[0]['id'], user_id, 'admin'),
        fetch=False
    )
    
    return jsonify(org[0])

@app.route('/api/organizations', methods=['GET'])
@token_required
def get_organizations():
    user_id = request.user['user_id']
    
    orgs = execute_query(
        """
        SELECT o.* FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = %s
        """,
        (user_id,)
    )
    
    return jsonify(orgs)

@app.route('/api/organizations/<int:org_id>', methods=['GET'])
@token_required
def get_organization(org_id):
    user_id = request.user['user_id']
    
    # Check if the user is a member of this organization
    org = execute_query(
        """
        SELECT o.* FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE o.id = %s AND om.user_id = %s
        """,
        (org_id, user_id)
    )
    
    if not org:
        return jsonify({'message': 'Organization not found or you do not have access'}), 404
    
    return jsonify(org[0])

@app.route('/api/organizations/<int:org_id>', methods=['PUT'])
@token_required
def update_organization(org_id):
    data = request.json
    user_id = request.user['user_id']
    
    # Check if user has admin rights for this organization
    admin_check = execute_query(
        """
        SELECT 1 FROM organization_members
        WHERE organization_id = %s AND user_id = %s AND role = 'admin'
        """,
        (org_id, user_id)
    )
    
    if not admin_check:
        return jsonify({'message': 'You do not have permission to update this organization'}), 403
    
    # Update organization
    updated_org = execute_query(
        """
        UPDATE organizations
        SET name = %s, description = %s
        WHERE id = %s
        RETURNING id, name, description
        """,
        (data['name'], data.get('description'), org_id),
        fetch=True
    )
    
    if not updated_org:
        return jsonify({'message': 'Organization not found'}), 404
    
    return jsonify(updated_org[0])

@app.route('/api/organizations/<int:org_id>', methods=['DELETE'])
@token_required
def delete_organization(org_id):
    user_id = request.user['user_id']
    
    # Check if user has admin rights for this organization
    admin_check = execute_query(
        """
        SELECT 1 FROM organization_members
        WHERE organization_id = %s AND user_id = %s AND role = 'admin'
        """,
        (org_id, user_id)
    )
    
    if not admin_check:
        return jsonify({'message': 'You do not have permission to delete this organization'}), 403
    
    # First, get all projects in this organization
    projects = execute_query(
        "SELECT id FROM projects WHERE organization_id = %s",
        (org_id,)
    )
    
    # Delete tasks for each project
    for project in projects:
        execute_query(
            "DELETE FROM tasks WHERE project_id = %s",
            (project['id'],),
            fetch=False
        )
        
        # Delete project memberships
        execute_query(
            "DELETE FROM project_members WHERE project_id = %s",
            (project['id'],),
            fetch=False
        )
        
        # Delete the project
        execute_query(
            "DELETE FROM projects WHERE id = %s",
            (project['id'],),
            fetch=False
        )
    
    # Delete organization memberships
    execute_query(
        "DELETE FROM organization_members WHERE organization_id = %s",
        (org_id,),
        fetch=False
    )
    
    # Finally, delete the organization
    execute_query(
        "DELETE FROM organizations WHERE id = %s",
        (org_id,),
        fetch=False
    )
    
    return jsonify({'message': 'Organization deleted successfully'})

# Project routes
@app.route('/api/organizations/<int:org_id>/projects', methods=['POST'])
@token_required
def create_project(org_id):
    try:
        data = request.json
        user_id = request.user['user_id']
        
        # Extract fields from request
        title = data.get('title')
        description = data.get('description', '')
        deadline = data.get('deadline')
        
        # New fields for storing roadmap and task checklist as text
        roadmap_text = data.get('roadmap_text', '')
        tasks_checklist = data.get('tasks_checklist', '')
        
        # Create new project with roadmap and tasks checklist text
        query = """
        INSERT INTO projects (
            organization_id, title, description, deadline, 
            created_by, roadmap_text, tasks_checklist
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, title, description, deadline, created_at, roadmap_text, tasks_checklist
        """
        
        project = execute_query(
            query,
            (org_id, title, description, deadline, user_id, roadmap_text, tasks_checklist),
            fetch=True
        )
        
        # Add creator as project member
        execute_query(
            """
            INSERT INTO project_members (project_id, user_id, role)
            VALUES (%s, %s, %s)
            """,
            (project[0]['id'], user_id, 'manager'),
            fetch=False
        )
        
        return jsonify(project[0]), 201
    except Exception as e:
        print(f"Error creating project: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/organizations/<int:organization_id>/projects', methods=['GET'])
@token_required
def get_organization_projects(organization_id):
    try:
        # Check if we should include tasks
        include_tasks = request.args.get('include_tasks', 'false').lower() == 'true'
        
        # Get projects for the organization
        projects = execute_query(
            """
            SELECT p.* 
            FROM projects p
            WHERE p.organization_id = %s
            ORDER BY p.created_at DESC
            """,
            (organization_id,)
        )
        
        # If include_tasks is true, fetch tasks for each project
        if include_tasks and projects:
            for project in projects:
                project_id = project['id']
                tasks = execute_query(
                    """
                    SELECT * FROM tasks 
                    WHERE project_id = %s
                    ORDER BY phase_order, task_order
                    """,
                    (project_id,)
                )
                
                # Ensure all tasks have the required fields for progress tracking
                for task in tasks:
                    # Make sure both status and completed fields are always present
                    # This ensures consistent progress calculation across the app
                    if 'status' in task:
                        # If status is 'completed', set completed to True
                        if task['status'] == 'completed':
                            task['completed'] = True
                        # Otherwise, set completed to False unless already set
                        elif 'completed' not in task:
                            task['completed'] = False
                    # If no status but has completed field, set status accordingly
                    elif 'completed' in task and task['completed'] == True:
                        task['status'] = 'completed'
                    # Default values if neither exist
                    else:
                        task['status'] = 'pending'
                        task['completed'] = False
                
                project['tasks'] = tasks
        
        return jsonify(projects)
    except Exception as e:
        print(f"Error fetching projects: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<int:project_id>', methods=['GET'])
@token_required
def get_project(project_id):
    try:
        # Get project with roadmap and tasks checklist text
        project = execute_query(
            """
            SELECT 
                p.id, p.organization_id, p.title, p.description, p.deadline, 
                p.created_at, p.roadmap_text, p.tasks_checklist,
                o.name as organization_name
            FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = %s
            """,
            (project_id,)
        )
        
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        return jsonify(project[0])
    except Exception as e:
        print(f"Error fetching project: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Task routes
@app.route('/api/projects/<int:project_id>/tasks', methods=['POST'])
@token_required
def create_task(project_id):
    """Create a new task for a project"""
    try:
        # For debugging: print the full request headers and body
        print(f"Creating task for project {project_id}")
        print(f"Request headers: {request.headers}")
        
        data = request.get_json()
        print(f"Request data: {data}")
        
        # Extract all possible fields with defaults
        task_title = data.get('title')
        task_description = data.get('description', '')
        status = data.get('status', 'todo')
        priority = data.get('priority', 'medium')
        phase_name = data.get('phase_name', '')
        phase_order = data.get('phase_order', 0)
        task_order = data.get('task_order', 0)
        estimated_duration = data.get('estimated_duration', '')
        
        if not task_title:
            response = jsonify({'error': 'Task title is required'})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400

        # Build dynamic column list and values based on provided data
        columns = ["project_id", "title", "description", "status", "priority"]
        values = [project_id, task_title, task_description, status, priority]
        
        # Add optional fields if present
        if phase_name:
            columns.append("phase_name")
            values.append(phase_name)
        
        if phase_order is not None:
            columns.append("phase_order")
            values.append(phase_order)
            
        if task_order is not None:
            columns.append("task_order")
            values.append(task_order)
            
        if estimated_duration:
            columns.append("estimated_duration")
            values.append(estimated_duration)
        
        # Create the SQL query
        columns_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(values))
        
        query = f"""
        INSERT INTO tasks ({columns_str})
        VALUES ({placeholders})
        RETURNING id, project_id, title, description, status, priority, phase_name, phase_order, task_order, created_at
        """
        
        print(f"Executing SQL: {query}")
        print(f"With values: {values}")
        
        task = execute_query(query, values)[0]
        print(f"Task created successfully: {task}")
        
        # Make sure response includes CORS headers
        response = jsonify(task)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 201
    except Exception as e:
        print(f"Error creating task: {str(e)}")
        response = jsonify({'error': str(e)})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route('/api/projects/<int:project_id>/tasks', methods=['GET'])
@token_required
def get_tasks(project_id):
    """Get all tasks for a project"""
    try:
        print(f"Fetching tasks for project {project_id}")
        
        query = """
        SELECT 
            id, 
            project_id, 
            title, 
            description, 
            status, 
            priority, 
            created_at, 
            phase_name, 
            phase_order, 
            task_order,
            estimated_duration
        FROM tasks
        WHERE project_id = %s
        ORDER BY phase_order ASC, task_order ASC, created_at ASC
        """
        
        tasks = execute_query(query, (project_id,))
        print(f"Found {len(tasks)} tasks for project {project_id}")
        
        response = jsonify(tasks)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 200
    except Exception as e:
        print(f"Error fetching tasks: {str(e)}")
        response = jsonify({'error': str(e)})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@token_required
def delete_project(project_id):
    user_id = request.user['user_id']
    
    # Check if user has permission to delete this project
    permission_check = execute_query(
        """
        SELECT 1 FROM project_members
        WHERE project_id = %s AND user_id = %s AND role = 'manager'
        """,
        (project_id, user_id)
    )
    
    if not permission_check:
        return jsonify({'message': 'You do not have permission to delete this project'}), 403
    
    # First, delete all tasks associated with this project
    execute_query(
        "DELETE FROM tasks WHERE project_id = %s",
        (project_id,),
        fetch=False
    )
    
    # Delete project memberships
    execute_query(
        "DELETE FROM project_members WHERE project_id = %s",
        (project_id,),
        fetch=False
    )
    
    # Finally, delete the project
    execute_query(
        "DELETE FROM projects WHERE id = %s",
        (project_id,),
        fetch=False
    )
    
    return jsonify({'message': 'Project deleted successfully'})

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@token_required
def update_task(task_id):
    data = request.json
    
    # Build dynamic update query based on provided fields
    update_parts = []
    params = []
    
    # Required fields
    update_parts.append("title = %s")
    params.append(data['title'])
    
    update_parts.append("updated_at = NOW()")
    
    # Optional fields to update if present
    if 'description' in data:
        update_parts.append("description = %s")
        params.append(data.get('description'))
    
    if 'status' in data:
        update_parts.append("status = %s")
        params.append(data['status'])
    
    if 'priority' in data:
        update_parts.append("priority = %s")
        params.append(data['priority'])
    
    if 'assigned_to' in data:
        update_parts.append("assigned_to = %s")
        params.append(data.get('assigned_to'))
    
    if 'deadline' in data:
        update_parts.append("deadline = %s")
        params.append(data.get('deadline'))
    
    if 'phase_name' in data:
        update_parts.append("phase_name = %s")
        params.append(data.get('phase_name'))
    
    if 'phase_order' in data:
        update_parts.append("phase_order = %s")
        params.append(data.get('phase_order'))
    
    if 'task_order' in data:
        update_parts.append("task_order = %s")
        params.append(data.get('task_order'))
    
    # Add task_id to params
    params.append(task_id)
    
    # Construct the SQL query
    query = f"""
    UPDATE tasks
    SET {", ".join(update_parts)}
    WHERE id = %s
    RETURNING id, title, description, status, priority, assigned_to, phase_name, phase_order, task_order, deadline
    """
    
    task = execute_query(query, params, fetch=True)
    
    return jsonify(task[0])

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@token_required
def delete_task(task_id):
    execute_query(
        "DELETE FROM tasks WHERE id = %s",
        (task_id,),
        fetch=False
    )
    
    return jsonify({'message': 'Task deleted'})

# AI routes
@app.route('/api/temp-roadmap', methods=['POST'])
def generate_temp_roadmap():
    try:
        # Get request data
        data = request.json
        print(f"Received temp roadmap request: {data}")
        
        # Extract request parameters with defaults to prevent None values
        title = data.get('project_title', '') or data.get('title', '')
        description = data.get('project_description', '') or data.get('description', '')
        deadline = data.get('deadline', '')
        problem_statement = data.get('problem_statement', '')
        priority = data.get('priority', 'Medium')
        project_complexity = data.get('project_complexity', 'medium')
        development_methodology = data.get('development_methodology', 'Agile')
        custom_prompt = data.get('prompt', '')
        
        print(f"Extracted parameters: title='{title}', prompt length={len(custom_prompt) if custom_prompt else 0}")
        
        if not title and not custom_prompt:
            return jsonify({"error": "Either project title or custom prompt is required"}), 400
        
        # Check if custom prompt is provided - use it directly
        if custom_prompt:
            print(f"Using custom prompt directly with length: {len(custom_prompt)}")
            try:
                # Call the AI service with the custom prompt
                roadmap = generate_roadmap_with_custom_prompt(custom_prompt)
                
                if not roadmap:
                    error_msg = "AI service returned empty response"
                    print(f"Error: {error_msg}")
                    return jsonify({'error': error_msg}), 500
                    
                print(f"Successfully generated roadmap with content length: {len(roadmap.get('content', ''))}")
                return jsonify(roadmap)
            except Exception as e:
                error_msg = f"Error in roadmap generation with custom prompt: {str(e)}"
                print(error_msg)
                traceback.print_exc()
                return jsonify({"error": error_msg}), 500
        else:
            # Create a standard context for the AI with project details
            context = f"""
Project Title: {title}
Description: {description}
Priority: {priority}
Deadline: {deadline}
Requirements/Goals: {problem_statement}
Project Complexity: {project_complexity}
Development Methodology: {development_methodology}
            """
            
            try:
                # Generate roadmap using regular method
                roadmap = generate_roadmap(context.strip())
                
                if not roadmap:
                    error_msg = "AI service returned empty response"
                    print(f"Error: {error_msg}")
                    return jsonify({'error': error_msg}), 500
                
                print(f"Successfully generated roadmap with standard prompt")
                return jsonify(roadmap)
            except Exception as e:
                error_msg = f"Error in standard roadmap generation: {str(e)}"
                print(error_msg)
                traceback.print_exc()
                return jsonify({"error": error_msg}), 500
    except Exception as e:
        error_msg = f"Unexpected error in temp roadmap generation: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        return jsonify({"error": error_msg}), 500

@app.route('/api/projects/<int:project_id>/generate-roadmap', methods=['POST'])
@token_required
def generate_project_roadmap(project_id):
    try:
        # Get project data from database first
        project = execute_query(
            "SELECT * FROM projects WHERE id = %s",
            (project_id,)
        )
        
        if not project:
            return jsonify({'message': 'Project not found'}), 404
        
        project = project[0]
        
        # Get user input requirements
        data = request.json
        input_requirements = data.get('requirements', '')
        
        # Get project stats to provide additional context
        tasks = execute_query(
            "SELECT * FROM tasks WHERE project_id = %s",
            (project_id,)
        )
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for task in tasks if task['status'] == 'Completed')
        completion_percentage = 0
        if total_tasks > 0:
            completion_percentage = (completed_tasks / total_tasks) * 100
        
        # Create a comprehensive context that includes project data, stats, and user requirements
        context = f"""
Project Title: {project['title']}
Description: {project['description'] or ''}
Deadline: {project['deadline'] or ''}
Priority: {data.get('priority', project.get('priority', 'medium'))}
Current Progress: {completion_percentage}% complete ({completed_tasks}/{total_tasks} tasks)

Requirements/Goals: {input_requirements}
        """
        
        # Generate roadmap using AI with comprehensive context
        roadmap = generate_roadmap(context.strip())
        
        if not roadmap:
            return jsonify({
                'message': 'Failed to generate roadmap',
                'error': 'AI service returned empty response'
            }), 500
        
        # Return the roadmap as JSON
        return jsonify(roadmap)
    except Exception as e:
        # Return detailed error for debugging
        return jsonify({
            'message': 'Failed to generate roadmap',
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/api/projects/<int:project_id>/generate-report', methods=['GET'])
@token_required
def generate_project_report(project_id):
    """
    Generate a comprehensive project report as PDF with enhanced styling
    """
    try:
        # Get project data
        project_result = execute_query(
            """
            SELECT p.*, o.name as organization_name,
                   to_char(p.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_formatted,
                   to_char(p.deadline, 'YYYY-MM-DD') as deadline_formatted
            FROM projects p
            LEFT JOIN organizations o ON p.organization_id = o.id
            WHERE p.id = %s
            """,
            (project_id,)
        )
        
        if not project_result or len(project_result) == 0:
            return jsonify({'error': 'Project not found'}), 404
        
        project = project_result[0]
        
        # Get tasks data from database
        tasks_from_db = execute_query(
            """
            SELECT t.*, u.full_name as assigned_to_name 
            FROM tasks t 
            LEFT JOIN users u ON t.assigned_to = u.id 
            WHERE t.project_id = %s
            ORDER BY t.phase_order, t.task_order
            """,
            (project_id,)
        )
        
        # Process tasks_checklist to extract tasks from plain text if needed
        tasks_from_checklist = []
        if project.get('tasks_checklist'):
            tasks_checklist = project.get('tasks_checklist')
            
            # Try to parse as JSON first (structured tasks)
            try:
                parsed_checklist = json.loads(tasks_checklist)
                if isinstance(parsed_checklist, list):
                    tasks_from_checklist = parsed_checklist
            except (json.JSONDecodeError, TypeError):
                # Fallback to extracting tasks from plain text
                lines = tasks_checklist.split('\n')
                
                for i, line in enumerate(lines):
                    trimmed_line = line.strip()
                    if trimmed_line.startswith('- ') or trimmed_line.startswith('* '):
                        task_text = trimmed_line[2:].strip()
                        if task_text:
                            tasks_from_checklist.append({
                                'id': f'text_task_{i}',
                                'title': task_text,
                                'description': '',
                                'phase': 'Tasks',
                                'phase_order': 1,
                                'task_order': i,
                                'completed': False  # Default to not completed
                            })
        
        # Try to get completion status from localStorage by checking for localStorage data in the database
        # This approach matches the one used in the Dashboard
        local_tasks = None
        try:
            # First check if the user_local_storage table exists
            table_check = execute_query(
                """
                SELECT count(*) as table_exists 
                FROM information_schema.tables 
                WHERE table_name = 'user_local_storage'
                """
            )
            
            has_storage_table = table_check and table_check[0]['table_exists'] > 0
            
            if has_storage_table:
                local_storage_query = execute_query(
                    """
                    SELECT json_data 
                    FROM user_local_storage 
                    WHERE project_id = %s AND key = %s
                    """,
                    (project_id, f'checklist_{project_id}'),
                )
                
                if local_storage_query and len(local_storage_query) > 0:
                    try:
                        local_tasks = json.loads(local_storage_query[0]['json_data'])
                        print(f"Found localStorage data for project {project_id}: {len(local_tasks)} tasks")
                    except (json.JSONDecodeError, TypeError, KeyError):
                        print(f"Error parsing localStorage data for project {project_id}")
            else:
                print("user_local_storage table does not exist - using fallback approach")
        except Exception as e:
            print(f"Error checking for localStorage data: {e}")
            # Continue with database tasks
        
        # If local_tasks is still None, check if tasks_checklist itself contains embedded localStorage data
        # (Frontend might have embedded it as a JSON string with a special marker)
        if local_tasks is None and project.get('tasks_checklist') and isinstance(project.get('tasks_checklist'), str):
            checklist_str = project.get('tasks_checklist')
            if '___LOCAL_STORAGE_DATA___' in checklist_str:
                try:
                    # Extract the localStorage JSON
                    localStorage_marker = '___LOCAL_STORAGE_DATA___'
                    start_idx = checklist_str.find(localStorage_marker) + len(localStorage_marker)
                    end_idx = checklist_str.find('___END_LOCAL_STORAGE___', start_idx)
                    
                    if start_idx > len(localStorage_marker) and end_idx > start_idx:
                        local_storage_json = checklist_str[start_idx:end_idx].strip()
                        local_tasks = json.loads(local_storage_json)
                        print(f"Found embedded localStorage data in tasks_checklist: {len(local_tasks)} tasks")
                except Exception as e:
                    print(f"Error parsing embedded localStorage data: {e}")
        
        # Ensure all tasks from_checklist have 'completed' property
        for task in tasks_from_checklist:
            if 'completed' not in task:
                task['completed'] = False
        
        # Update task completion status based on localStorage if available
        if local_tasks and isinstance(local_tasks, list) and len(local_tasks) > 0:
            # Use localStorage data for tasks (highest priority - matches Tasks page behavior)
            for task in tasks_from_checklist:
                task_id = task.get('id')
                if task_id:
                    # Find match by ID in localStorage
                    local_task = next((lt for lt in local_tasks if lt.get('id') == task_id), None)
                    if local_task and 'completed' in local_task:
                        task['completed'] = local_task['completed']
                        print(f"Updated task {task_id} completion to {task['completed']}")
            print(f"Updated task completion from localStorage")
                
        # Combine all tasks
        all_tasks = tasks_from_db + tasks_from_checklist
        
        # Create a file-like buffer for the PDF
        buffer = io.BytesIO()
        
        # Setup the PDF document with better margins
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=letter,
            title=f"Project Report - {project.get('title', 'Untitled')}",
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )
        
        # Get styles
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        heading_style = styles['Heading1']
        subheading_style = styles['Heading2']
        normal_style = styles['Normal']
        
        # Create custom styles
        section_style = ParagraphStyle(
            'SectionStyle',
            parent=heading_style,
            fontSize=16,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.darkblue
        )
        
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=normal_style,
            fontSize=12,
            fontName='Helvetica-Oblique',
            textColor=colors.darkslategray,
            spaceBefore=0,
            spaceAfter=10
        )
        
        # Initialize content list for PDF
        content = []
        
        # Add title with better spacing
        content.append(Paragraph(f"Project Report", title_style))
        content.append(Spacer(1, 5))
        content.append(Paragraph(f"{project.get('title', 'Untitled Project')}", section_style))
        content.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y')}", subtitle_style))
        content.append(Spacer(1, 20))
        
        # Create a horizontal line
        content.append(Paragraph("<hr width='100%'/>", normal_style))
        content.append(Spacer(1, 10))
        
        # --- PROJECT OVERVIEW SECTION ---
        content.append(Paragraph("Project Overview", heading_style))
        
        # Safe data extraction with defaults
        org_name = project.get('organization_name', 'Not specified')
        description = project.get('description', 'No description provided')
        priority = project.get('priority', 'Medium').capitalize()
        
        # Format dates safely using pre-formatted strings from the query
        created_date = project.get('created_at_formatted', 'Not specified')
        deadline_date = project.get('deadline_formatted', 'Not specified')
        
        # Convert formatted dates to more readable format if possible
        if created_date != 'Not specified':
            try:
                dt = datetime.strptime(created_date, '%Y-%m-%d %H:%M:%S')
                created_date = dt.strftime('%B %d, %Y')
            except Exception as e:
                print(f"Error formatting created_at date: {e}")
        
        if deadline_date != 'Not specified':
            try:
                dt = datetime.strptime(deadline_date, '%Y-%m-%d')
                deadline_date = dt.strftime('%B %d, %Y')
            except Exception as e:
                print(f"Error formatting deadline date: {e}")
        
        # Create custom style for wrapped text in table
        table_text_style = ParagraphStyle(
            'TableTextStyle',
            parent=normal_style,
            fontSize=10,
            leading=12
        )
        
        # Convert description to a Paragraph object to enable proper wrapping
        description_paragraph = Paragraph(description, table_text_style)
        
        # Create a more visually appealing project details table
        detail_data = []
        detail_data.append(["Organization:", org_name])
        detail_data.append(["Description:", description_paragraph])  # Use paragraph instead of raw text
        detail_data.append(["Created On:", created_date])
        detail_data.append(["Deadline:", deadline_date])
        detail_data.append(["Priority:", priority])
        
        # Project details table with better styling
        details_table = Table(detail_data, colWidths=[100, 400])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightsteelblue),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.darkblue),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.whitesmoke, colors.white]),
            ('WORDWRAP', (0, 0), (-1, -1), True)  # Enable word wrapping in all cells
        ]))
        
        content.append(details_table)
        content.append(Spacer(1, 20))
        
        # --- EXECUTIVE SUMMARY SECTION ---
        content.append(Paragraph("Executive Summary", heading_style))
        
        # Calculate task statistics safely using all tasks
        total_tasks = len(all_tasks) if all_tasks else 0
        
        # Count completed tasks from both sources
        # Using the same algorithm as Dashboard.jsx calculateProjectProgress function
        completed_tasks = 0
        in_progress_tasks = 0
        todo_tasks = 0
        
        # First prioritize local tasks (just like Dashboard.jsx does)
        if local_tasks and isinstance(local_tasks, list) and len(local_tasks) > 0:
            # Use localStorage tasks (highest priority - same as Dashboard)
            completed_tasks = sum(1 for task in local_tasks if task.get('completed'))
            total_tasks = len(local_tasks)
            in_progress_tasks = 0  # localStorage tasks don't track in_progress status
            todo_tasks = total_tasks - completed_tasks
        else:
            # Otherwise use API tasks with status/completed fields
            for task in all_tasks:
                # For database tasks, use status field
                if 'status' in task:
                    if task['status'] == 'completed':
                        completed_tasks += 1
                    elif task['status'] == 'in_progress':
                        in_progress_tasks += 1
                    else:
                        todo_tasks += 1
                # For checklist tasks, use completed field
                elif 'completed' in task:
                    if task['completed']:
                        completed_tasks += 1
                    else:
                        todo_tasks += 1
                # Default case
                else:
                    todo_tasks += 1
        
        # Calculate progress percentage safely
        progress_percentage = 0
        if total_tasks > 0:
            progress_percentage = (completed_tasks / total_tasks) * 100
        
        # Determine project status
        project_status = "On Track"
        status_color = colors.green
        
        # Calculate timeline metrics safely
        try:
            current_date = datetime.now()
            
            # Get creation and deadline dates from formatted strings
            creation_dt = None
            deadline_dt = None
            
            if project.get('created_at_formatted'):
                try:
                    creation_dt = datetime.strptime(project.get('created_at_formatted'), '%Y-%m-%d %H:%M:%S')
                except Exception as e:
                    print(f"Error parsing created_at in timeline: {e}")
            
            if project.get('deadline_formatted'):
                try:
                    deadline_dt = datetime.strptime(project.get('deadline_formatted'), '%Y-%m-%d')
                except Exception as e:
                    print(f"Error parsing deadline in timeline: {e}")
            
            days_elapsed = None
            days_remaining = None
            expected_progress = None
            
            if creation_dt and deadline_dt:
                days_elapsed = max(0, (current_date - creation_dt).days)
                days_remaining = max(0, (deadline_dt - current_date).days)
                total_duration = max(1, (deadline_dt - creation_dt).days)  # Avoid division by zero
                
                expected_progress = (days_elapsed / total_duration) * 100
                
                # Update status based on progress
                if days_remaining > 0:  # Only evaluate if deadline hasn't passed
                    if progress_percentage < (expected_progress - 10):
                        project_status = "Behind Schedule"
                        status_color = colors.red
                    elif progress_percentage > (expected_progress + 10):
                        project_status = "Ahead of Schedule"
                        status_color = colors.blue
                else:
                    if progress_percentage < 100:
                        project_status = "Overdue"
                        status_color = colors.red
                    else:
                        project_status = "Completed"
                        status_color = colors.green
        except Exception as e:
            print(f"Error calculating timeline metrics: {e}")
            days_elapsed = None
            days_remaining = None
            expected_progress = None
            
        # Add project summary paragraph
        summary = f"""
        This project has {total_tasks} defined tasks, of which {completed_tasks} are completed 
        ({progress_percentage:.1f}% completion rate). The project is currently {project_status}.
        """
        
        if days_elapsed is not None and days_remaining is not None:
            if days_remaining > 0:
                summary += f" There are {days_remaining} days remaining until the deadline."
            else:
                summary += f" The project deadline has passed by {abs(days_remaining)} days."
                
        content.append(Paragraph(summary, normal_style))
        content.append(Spacer(1, 15))
        
        # Add status with appropriate color
        status_style = ParagraphStyle(
            'StatusStyle', 
            parent=styles['Heading2'],
            textColor=status_color
        )
        
        content.append(Paragraph(f"Project Status: {project_status}", status_style))
        content.append(Spacer(1, 10))
        
        # Create progress bar with better styling
        progress_bar_width = 500
        progress_width = int((progress_percentage / 100) * progress_bar_width)
        
        # Ensure progress_width is within valid bounds (0 to progress_bar_width)
        progress_width = max(0, min(progress_width, progress_bar_width))
        
        # Calculate progress width ratio safely (prevent division by zero)
        if progress_bar_width > 0:
            progress_ratio = progress_width / progress_bar_width
        else:
            progress_ratio = 0
            
        progress_data = [[f"{progress_percentage:.1f}% Complete"]]
        
        progress_table = Table(progress_data, colWidths=[progress_bar_width])
        progress_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.lightgrey),
            ('BACKGROUND', (0, 0), (progress_ratio, 0), colors.green),
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white if progress_percentage > 50 else colors.black),
        ]))
        
        content.append(progress_table)
        content.append(Spacer(1, 15))
        
        # Task statistics table with better styling
        task_stats = [
            ["Completed Tasks:", f"{completed_tasks}", f"{(completed_tasks/total_tasks*100):.1f}%" if total_tasks > 0 else "0%"],
            ["In Progress Tasks:", f"{in_progress_tasks}", f"{(in_progress_tasks/total_tasks*100):.1f}%" if total_tasks > 0 else "0%"],
            ["Todo Tasks:", f"{todo_tasks}", f"{(todo_tasks/total_tasks*100):.1f}%" if total_tasks > 0 else "0%"],
            ["Total Tasks:", f"{total_tasks}", "100%"]
        ]
        
        stats_table = Table(task_stats, colWidths=[150, 100, 100])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -2), colors.lightsteelblue),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightsteelblue),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 0), (-1, -2), [colors.whitesmoke, colors.white])
        ]))
        
        content.append(stats_table)
        content.append(Spacer(1, 20))
        
        # Create a horizontal line
        content.append(Paragraph("<hr width='100%'/>", normal_style))
        content.append(Spacer(1, 10))
        
        # --- TIMELINE ANALYSIS SECTION ---
        content.append(Paragraph("Timeline Analysis", heading_style))
        
        if days_elapsed is not None and days_remaining is not None:
            try:
                total_duration = days_elapsed + days_remaining
                
                timeline_data = [
                    ["Days Elapsed:", f"{days_elapsed} days", f"{(days_elapsed/total_duration*100):.1f}%" if total_duration > 0 else "0%"],
                    ["Days Remaining:", f"{days_remaining} days", f"{(days_remaining/total_duration*100):.1f}%" if total_duration > 0 else "0%"],
                    ["Total Duration:", f"{total_duration} days", "100%"]
                ]
                
                timeline_table = Table(timeline_data, colWidths=[150, 100, 100])
                timeline_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -2), colors.lightsteelblue),
                    ('BACKGROUND', (0, -1), (-1, -1), colors.lightsteelblue),
                    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                    ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 0), (-1, -2), [colors.whitesmoke, colors.white])
                ]))
                
                content.append(timeline_table)
                content.append(Spacer(1, 15))
                
                # Add completion prediction
                if expected_progress is not None and expected_progress > 0 and progress_percentage > 0:
                    content.append(Spacer(1, 10))
                    content.append(Paragraph(f"Expected Progress (Time-Based): {expected_progress:.1f}%", normal_style))
                    content.append(Paragraph(f"Actual Progress: {progress_percentage:.1f}%", normal_style))
                    
                    if days_remaining > 0 and progress_percentage > 0:
                        try:
                            # Calculate estimated days to complete based on current progress rate
                            total_estimated_days = days_elapsed * (100 / progress_percentage)
                            additional_days_needed = int(max(0, total_estimated_days - days_elapsed - days_remaining))
                            
                            content.append(Spacer(1, 10))
                            if additional_days_needed > 0:
                                content.append(Paragraph(f"<b>Estimated Completion:</b> Project may require approximately {additional_days_needed} additional days beyond the deadline.", normal_style))
                            else:
                                early_days = abs(additional_days_needed)
                                content.append(Paragraph(f"<b>Estimated Completion:</b> Project is on track to complete {early_days} days before the deadline.", normal_style))
                        except Exception as e:
                            print(f"Error in completion prediction: {e}")
            except Exception as e:
                print(f"Error in timeline section: {e}")
                content.append(Paragraph("Timeline calculation error occurred.", normal_style))
        else:
            content.append(Paragraph("Timeline information is not available. Please set a project deadline.", normal_style))
        
        content.append(Spacer(1, 20))
        
        # Create a horizontal line
        content.append(Paragraph("<hr width='100%'/>", normal_style))
        content.append(Spacer(1, 10))
        
        # --- INSIGHTS & RECOMMENDATIONS SECTION ---
        content.append(Paragraph("Insights & Recommendations", heading_style))
        
        # Generate insights based on project data
        insights = []
        
        if progress_percentage < 50 and days_remaining and days_remaining < (days_elapsed + days_remaining) / 3:
            insights.append("The project is less than 50% complete with less than a third of the timeline remaining. Consider re-evaluating the scope or allocating additional resources.")
        
        if progress_percentage > 90:
            insights.append("The project is nearing completion. Focus on final quality checks and documentation.")
        
        if in_progress_tasks > completed_tasks + todo_tasks:
            insights.append("There are a large number of tasks in progress simultaneously. Consider focusing on completing some in-progress tasks before starting new ones.")
        
        if total_tasks == 0:
            insights.append("No tasks have been created. Breaking down the project into specific tasks improves tracking and accountability.")
        
        # Add insights to the report with better formatting
        if insights:
            for i, insight in enumerate(insights):
                bullet_style = ParagraphStyle(
                    f'Bullet{i}',
                    parent=normal_style,
                    leftIndent=20,
                    firstLineIndent=-15
                )
                content.append(Paragraph(f"• {insight}", bullet_style))
        else:
            content.append(Paragraph("No specific insights available for this project.", normal_style))
        
        # --- REPORT FOOTER ---
        content.append(Spacer(1, 30))
        footer_style = ParagraphStyle('Footer', parent=normal_style, fontSize=8, textColor=colors.grey)
        generation_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content.append(Paragraph(f"Report generated on: {generation_date}", footer_style))
        content.append(Paragraph(f"Report ID: PRJ-{project_id}-{int(time.time())}", footer_style))
        
        # Build the PDF
        doc.build(content)
        
        # Rewind the buffer
        buffer.seek(0)
        
        # Send the PDF
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'Project_Report_{project.get("title", "Untitled")}_{datetime.now().strftime("%Y%m%d")}.pdf'
        )
    
    except Exception as e:
        print(f"Error generating project report: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Failed to generate report: {str(e)}'}), 500

def parse_date(date_string):
    """Safely parse a date string in various formats"""
    if not date_string:
        return None
        
    formats = [
        '%a, %d %b %Y %H:%M:%S GMT',  # RFC 1123
        '%Y-%m-%dT%H:%M:%S.%fZ',      # ISO format with microseconds
        '%Y-%m-%dT%H:%M:%SZ',         # ISO format
        '%Y-%m-%d %H:%M:%S',          # Standard format
        '%Y-%m-%d',                   # Just date
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_string.replace('Z', '+00:00'), fmt)
        except ValueError:
            continue
    
    # If none of the formats match, try parsing with dateutil
    if dateutil_parser:
        try:
            return dateutil_parser.parse(date_string)
        except:
            print(f"Could not parse date: {date_string}")
    else:
        print(f"Could not parse date (dateutil not available): {date_string}")
    
    return None

@app.route('/api/projects/<int:project_id>/save-tasks-progress', methods=['POST'])
@token_required
def save_tasks_progress(project_id):
    """
    Save the tasks progress to the database.
    This endpoint updates the project's tasks_checklist in the database
    to include the completion status of tasks.
    """
    try:
        print(f"Received request to save tasks progress for project {project_id}")
        data = request.get_json()
        user_id = request.user['user_id']
        
        if not data or 'tasks' not in data:
            print(f"No tasks data provided in request")
            return jsonify({'message': 'No tasks provided'}), 400
            
        print(f"Validating user {user_id} access to project {project_id}")
        # Get the project data to ensure it exists and belongs to the user
        project = execute_query(
            """
            SELECT p.* FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            JOIN organization_members om ON o.id = om.organization_id
            WHERE p.id = %s AND om.user_id = %s
            """,
            (project_id, user_id)
        )
        
        if not project:
            print(f"Project {project_id} not found or user {user_id} does not have access")
            return jsonify({'message': 'Project not found or access denied'}), 404
        
        print(f"User {user_id} has access to project {project_id}, processing {len(data['tasks'])} tasks")    
        # Convert the tasks list to a JSON string
        tasks_json = json.dumps(data['tasks'])
        
        # Update the project's tasks_checklist
        print(f"Updating tasks_checklist for project {project_id}")
        execute_query(
            """
            UPDATE projects
            SET tasks_checklist = %s
            WHERE id = %s
            """,
            (tasks_json, project_id),
            fetch=False
        )
        
        print(f"Successfully updated tasks progress for project {project_id}")
        return jsonify({
            'message': 'Tasks progress saved successfully',
            'tasks': data['tasks']
        }), 200
            
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"Error saving tasks progress: {e}")
        print(f"Error details: {error_details}")
        
        # Return more specific error information
        error_info = str(e)
        if len(error_info) > 200:
            error_info = error_info[:200] + "..." # Truncate very long error messages
            
        return jsonify({
            'error': 'An error occurred while saving tasks progress',
            'details': error_info
        }), 500

if __name__ == '__main__':
    print("Starting backend server with CORS enabled...")
    print("Allowed origins:", ["http://localhost:3000", "https://app.yourdomain.com"])
    print("Server running at http://localhost:5000")
    print("API accessible at http://localhost:5000/api")
    app.run(debug=True, host='0.0.0.0', port=5000) 