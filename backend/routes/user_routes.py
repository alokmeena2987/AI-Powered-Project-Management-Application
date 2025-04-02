from flask import request, jsonify
from utils.auth import hash_password, token_required
from utils.db import execute_query

def register_user_routes(app):
    @app.route('/api/user/profile', methods=['GET'])
    @token_required
    def get_user_profile_route():
        user_id = request.user['user_id']
        
        user = execute_query(
            "SELECT id, email, full_name, role FROM users WHERE id = %s",
            (user_id,)
        )
        
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        return jsonify(user[0])

    @app.route('/api/user/profile', methods=['PUT'])
    @token_required
    def update_user_profile_route():
        user_id = request.user['user_id']
        data = request.json
        
        # Prepare query parts
        update_parts = []
        params = []
        
        if 'full_name' in data:
            update_parts.append("full_name = %s")
            params.append(data['full_name'])
        
        if 'email' in data:
            # Check if email already exists
            if data['email']:
                existing = execute_query(
                    "SELECT id FROM users WHERE email = %s AND id != %s",
                    (data['email'], user_id)
                )
                if existing:
                    return jsonify({'message': 'Email already in use'}), 400
            
            update_parts.append("email = %s")
            params.append(data['email'])
        
        if 'password' in data and data['password']:
            hashed = hash_password(data['password']).decode('utf-8')
            update_parts.append("password_hash = %s")
            params.append(hashed)
        
        if not update_parts:
            return jsonify({'message': 'No fields to update'}), 400
        
        # Build and execute query
        query = f"UPDATE users SET {', '.join(update_parts)} WHERE id = %s RETURNING id, email, full_name, role"
        params.append(user_id)
        
        user = execute_query(query, params)
        
        return jsonify(user[0])

    @app.route('/api/user/profile', methods=['DELETE'])
    @token_required
    def delete_user_account_route():
        user_id = request.user['user_id']
        
        # First, handle tasks assigned to or created by this user
        # For assigned tasks, set assigned_to to NULL
        execute_query(
            "UPDATE tasks SET assigned_to = NULL WHERE assigned_to = %s",
            (user_id,),
            fetch=False
        )
        
        # Handle projects created by this user
        # Get all projects where the user is the only manager
        solo_managed_projects = execute_query(
            """
            SELECT p.id FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.role = 'manager'
            GROUP BY p.id
            HAVING COUNT(pm.user_id) = 1 AND MAX(CASE WHEN pm.user_id = %s THEN 1 ELSE 0 END) = 1
            """,
            (user_id,)
        )
        
        # For each project where the user is the only manager
        for project in solo_managed_projects:
            project_id = project['id']
            
            # Delete tasks for this project
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
            
            # Delete the project
            execute_query(
                "DELETE FROM projects WHERE id = %s",
                (project_id,),
                fetch=False
            )
        
        # Handle organizations created by this user
        # Get organizations where the user is the only admin
        solo_admin_orgs = execute_query(
            """
            SELECT o.id FROM organizations o
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.role = 'admin'
            GROUP BY o.id
            HAVING COUNT(om.user_id) = 1 AND MAX(CASE WHEN om.user_id = %s THEN 1 ELSE 0 END) = 1
            """,
            (user_id,)
        )
        
        # For each organization where the user is the only admin
        for org in solo_admin_orgs:
            org_id = org['id']
            
            # Get all projects in this organization
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
            
            # Delete the organization
            execute_query(
                "DELETE FROM organizations WHERE id = %s",
                (org_id,),
                fetch=False
            )
        
        # Remove user from all remaining project memberships
        execute_query(
            "DELETE FROM project_members WHERE user_id = %s",
            (user_id,),
            fetch=False
        )
        
        # Remove user from all remaining organization memberships
        execute_query(
            "DELETE FROM organization_members WHERE user_id = %s",
            (user_id,),
            fetch=False
        )
        
        # Finally, delete the user account
        execute_query(
            "DELETE FROM users WHERE id = %s",
            (user_id,),
            fetch=False
        )
        
        return jsonify({'message': 'User account deleted successfully'}) 