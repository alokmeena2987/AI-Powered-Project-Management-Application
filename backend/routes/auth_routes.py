from flask import request, jsonify
from utils.auth import hash_password, check_password, generate_token
from utils.db import execute_query

def register_auth_routes(app):
    @app.route('/api/auth/signup', methods=['POST'])
    def signup_route():
        data = request.json
        
        # Always set role to project_manager
        data['role'] = 'project_manager'
        
        # Check if user exists
        existing_user = execute_query(
            "SELECT * FROM users WHERE email = %s",
            (data['email'],)
        )
        
        if existing_user:
            return jsonify({'message': 'Email already registered'}), 400
        
        # Create new user
        hashed_password = hash_password(data['password']).decode('utf-8')
        user = execute_query(
            """
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, email, full_name, role
            """,
            (data['email'], hashed_password, data['full_name'], data['role']),
            fetch=True
        )
        
        token = generate_token(user[0]['id'], user[0]['role'])
        return jsonify({
            'token': token,
            'user': user[0]
        })

    @app.route('/api/auth/login', methods=['POST'])
    def login_route():
        data = request.json
        
        user = execute_query(
            "SELECT * FROM users WHERE email = %s",
            (data['email'],)
        )
        
        if not user or not check_password(data['password'], user[0]['password_hash']):
            return jsonify({'message': 'Invalid credentials'}), 401
        
        token = generate_token(user[0]['id'], user[0]['role'])
        return jsonify({
            'token': token,
            'user': {
                'id': user[0]['id'],
                'email': user[0]['email'],
                'full_name': user[0]['full_name'],
                'role': user[0]['role']
            }
        }) 