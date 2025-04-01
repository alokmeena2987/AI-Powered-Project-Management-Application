# Project Management Application

<div align="center">
  <img src="frontend/public/logo.png" alt="Project Management App Logo" width="200"/>
  <h3>AI-Powered Project Management Tool</h3>
</div>

## Overview

This project management application is a comprehensive solution designed to help teams and individuals efficiently organize, track, and collaborate on projects. The application leverages artificial intelligence to generate project roadmaps and simplifies task management through an intuitive user interface built with React and Material UI.

## Key Features

### 1. Dashboard
- **Project Overview**: View all your projects at a glance with visual progress indicators
- **Recent Activity Feed**: Track recent updates and changes to your projects
- **Deadline Tracking**: Visually identify approaching and overdue deadlines
- **Performance Metrics**: View completion rates and productivity metrics

### 2. Organization Management
- **Multi-Organization Support**: Create and manage multiple organizations
- **Team Collaboration**: Invite team members to your organizations
- **Organization-specific Projects**: Organize projects by organization
- **Hierarchical Structure**: Maintain clean separation between different organizational units

### 3. AI-Powered Roadmap Generation
- **Intelligent Project Planning**: Automatically generate comprehensive project roadmaps based on project descriptions
- **Problem Statement Analysis**: Generate tailored roadmaps by analyzing your specific requirements
- **Complexity Detection**: Automatic detection of project complexity (low/medium/high)
- **Industry Best Practices**: Roadmaps follow software development industry standards
- **Customizable Output**: Refine and adjust generated roadmaps

### 4. Task Management
- **Interactive Checklists**: Create, assign, and track tasks with interactive checklists
- **Task Organization**: Group tasks by phases for better organization
- **Progress Tracking**: Mark tasks as complete and track overall progress
- **Persistence**: Task progress is saved both locally and to the database
- **Visual Indicators**: Clear visual feedback for task completion status

## Detailed Setup Process

### Backend Setup

1. **Navigate to the Backend Directory**
   ```bash
   cd backend
   ```

2. **Create and Activate a Virtual Environment**
   ```bash
   # Create a virtual environment (if not already created)
   python -m venv venv

   # Activate the virtual environment
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**
   ```bash
   python app.py
   ```

### Frontend Setup

1. **Navigate to the Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Create a `.env` file in the frontend directory if it doesn't exist.
   - Add the following environment variables (adjust as needed):
     ```
     REACT_APP_API_URL=http://localhost:5000/api
     REACT_APP_ENVIRONMENT=development
     ```

4. **Run the Application**
   ```bash
   npm start
   ```

## Running the Application

### Development Mode

1. **Start Backend Server**
   ```bash
   # From the backend directory
   python app.py
   ```

2. **Start Frontend Development Server**
   ```bash
   # From the frontend directory
   npm start
   ```

3. **Access the Application**
   - Open your browser and navigate to `http://localhost:3000`
   - Backend API will be available at `http://localhost:5000`

## Application Functionality

### Authentication System

The application includes a comprehensive JWT-based authentication system:

1. **Login**
   - Navigate to the login page
   - Enter your email and password
   - The system will authenticate and redirect to the dashboard

2. **Signup**
   - Navigate to the signup page
   - Enter your full name, email, and password
   - Create a new account

3. **Persistent Sessions**
   - Authentication state is maintained across browser sessions
   - User data is stored securely in JWT tokens

### Dashboard

The dashboard is your central hub for tracking projects and activities:

1. **Accessing the Dashboard**
   - The dashboard is the default landing page after login
   - Alternatively, click the Dashboard icon in the sidebar

2. **Dashboard Features**
   - **Project Cards**: Shows all your projects with progress indicators
   - **Recent Activity**: Track updates to your projects
   - **Priority Indicators**: Color-coded priority levels (high, medium, low)
   - **Deadline Tracking**: Visual indicators for approaching deadlines

3. **Navigation**
   - Click on any project card to navigate to that project's details
   - Use the sidebar to navigate to other application areas

## Technical Architecture

The application is built with a modern technology stack:

- **Frontend**: React, Material UI, Context API for state management
- **Backend**: Python RESTful API
- **Database**: PostgreSQL (recommended)
- **Authentication**: JWT-based token authentication
- **AI Integration**: External AI service for roadmap generation
- **PDF Generation**: Server-side PDF report creation

## API Reference

Key API endpoints include:

- **Authentication**
  - POST `/api/auth/signup`: Register a new user
  - POST `/api/auth/login`: Authenticate user and get token

- **Organizations**
  - GET `/api/organizations`: List user organizations
  - POST `/api/organizations`: Create new organization
  - GET `/api/organizations/:id`: Get organization details

- **Projects**
  - GET `/api/organizations/:orgId/projects`: List organization projects
  - POST `/api/organizations/:orgId/projects`: Create new project
  - GET `/api/projects/:id`: Get project details

- **Tasks**
  - GET `/api/projects/:projectId/tasks`: Get project tasks
  - PUT `/api/projects/:projectId/tasks`: Update tasks progress

- **AI & Reports**
  - POST `/api/generate-roadmap`: Generate AI roadmap
  - GET `/api/projects/:id/generate-report`: Generate project report

## Common Issues & Troubleshooting

### Authentication Issues
- **Problem**: "Invalid credentials" error
- **Solution**: Verify your email and password are correct. Reset password if necessary.

### Roadmap Generation
- **Problem**: Empty or inadequate roadmap
- **Solution**: Provide more detailed project description and problem statement.

### Task Progress Not Saving
- **Problem**: Task progress not persisting to database
- **Solution**: Check internet connection. Progress is saved locally and will sync when connection is restored.

### Report Generation Failures
- **Problem**: Report generation fails
- **Solution**: Ensure the project has sufficient data (tasks, roadmap) for generating a meaningful report.

## Future Plans

Our roadmap for future development includes:

### Short-term Plans
- **Mobile Application**: Native mobile apps for iOS and Android
- **Team Collaboration**: Enhanced team features with comments and mentions
- **Task Assignments**: Assign tasks to specific team members
- **Notifications System**: Real-time notifications for task updates

### Medium-term Plans 
- **Advanced Analytics**: Enhanced project analytics and visualizations
- **Time Tracking**: Built-in time tracking for tasks
- **Gantt Charts**: Interactive Gantt chart for project scheduling
- **Resource Allocation**: Tools for managing team workload

### Long-term Vision 
- **AI Project Advisor**: AI-powered suggestions for improving project execution
- **Risk Assessment**: Automated risk identification and mitigation suggestions
- **Integration Ecosystem**: Integrations with popular tools (Slack, GitHub, etc.)
- **Custom Workflows**: Ability to define custom project workflows
