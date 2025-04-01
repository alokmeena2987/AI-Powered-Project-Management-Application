import React, { createContext, useContext, useState, useEffect } from 'react';
import { createProject } from '../services/api';
import { useAuth } from './AuthContext'; // Import useAuth

const ProjectContext = createContext();

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
  const { user } = useAuth(); // Get current user info
  const userId = user?.id; // User ID for state isolation
  
  // Return a fresh default state object - MOVED HERE TO FIX HOISTING ISSUE
  const getDefaultState = () => ({
    organizationId: null,
    projectFormData: {
      title: '',
      description: '',
      deadline: null,
      problem_statement: '',
      priority: 'medium',
    },
    activeStep: 0,
    lastGenerationAttempt: null,
    currentProjectId: null,
    requirements: '',
    problemStatement: '',
    deadline: null,
    roadmapGenerated: false,
    roadmapAccepted: false,
    tasks: [],
    roadmap: null,
    projectFormCompleted: false,
    projectCreated: false,
    hasRedirectedToRoadmap: false,
  });
  
  // Initialize state with a function to prevent stale closures
  const [projectState, setProjectState] = useState(() => {
    try {
      // Create a user-specific storage key
      const storageKey = userId ? `projectState_${userId}` : null;
      
      // Only load from localStorage if we have a valid user
      if (storageKey) {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
          try {
            const parsedState = JSON.parse(savedState);
            return {
              ...parsedState,
              activeStep: Number(parsedState.activeStep) || 0
            };
          } catch (error) {
            console.error('Error parsing saved project state:', error);
            // On error, remove the corrupted data
            localStorage.removeItem(storageKey);
          }
        }
      }
      
      // Default state if no saved state exists or no user is logged in
      return getDefaultState();
    } catch (error) {
      // Fallback to a minimal default state if anything goes wrong
      console.error('Critical error initializing project state:', error);
      return {
        organizationId: null,
        projectFormData: { title: '', priority: 'medium' },
        activeStep: 0,
        roadmapGenerated: false,
        roadmapAccepted: false,
        projectCreated: false
      };
    }
  });
  
  // Reset state when user changes
  useEffect(() => {
    try {
      // Reset the entire state when user ID changes
      if (userId) {
        // Load from user-specific storage or use default
        const storageKey = `projectState_${userId}`;
        const savedState = localStorage.getItem(storageKey);
        
        if (savedState) {
          try {
            const parsedState = JSON.parse(savedState);
            setProjectState({
              ...parsedState,
              activeStep: Number(parsedState.activeStep) || 0
            });
          } catch (error) {
            console.error('Error loading user-specific state, using default');
            // Get default state safely
            try {
              setProjectState(getDefaultState());
            } catch (defaultStateError) {
              console.error('Error creating default state:', defaultStateError);
              // Minimal fallback state
              setProjectState({
                organizationId: null,
                projectFormData: { title: '', priority: 'medium' },
                activeStep: 0
              });
            }
            localStorage.removeItem(storageKey);
          }
        } else {
          // No saved state for this user, use default
          try {
            setProjectState(getDefaultState());
          } catch (defaultStateError) {
            console.error('Error creating default state:', defaultStateError);
            // Minimal fallback state
            setProjectState({
              organizationId: null,
              projectFormData: { title: '', priority: 'medium' },
              activeStep: 0
            });
          }
        }
      } else {
        // No user, reset to default state
        try {
          setProjectState(getDefaultState());
        } catch (defaultStateError) {
          console.error('Error creating default state:', defaultStateError);
          // Minimal fallback state
          setProjectState({
            organizationId: null,
            projectFormData: { title: '', priority: 'medium' },
            activeStep: 0
          });
        }
      }
    } catch (error) {
      console.error('Critical error in user change effect:', error);
      // Last resort - minimal reset
      setProjectState({
        organizationId: null,
        projectFormData: { title: '' },
        activeStep: 0
      });
    }
  }, [userId]); // Only trigger when user ID changes

  // Save state to localStorage whenever it changes
  useEffect(() => {
    // Only save state if we have a user
    if (!userId) return;
    
    try {
      // Get user-specific storage key
      const storageKey = `projectState_${userId}`;
      
      // Process state for proper serialization
      const stateToSave = {
        ...projectState,
        projectFormData: {
          ...projectState.projectFormData,
          deadline: projectState.projectFormData.deadline 
            ? projectState.projectFormData.deadline instanceof Date
              ? projectState.projectFormData.deadline.toISOString()
              : projectState.projectFormData.deadline 
            : null
        },
        activeStep: Number(projectState.activeStep) || 0
      };
      
      // Safely save to localStorage with fallbacks
      try {
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
      } catch (primarySaveError) {
        console.error('Primary save error:', primarySaveError);
        
        // If saving fails, try with a simplified state
        try {
          const simplifiedState = {
            ...projectState,
            projectFormData: {
              ...projectState.projectFormData,
              deadline: null
            },
            roadmap: null,
            activeStep: Number(projectState.activeStep) || 0
          };
          localStorage.setItem(storageKey, JSON.stringify(simplifiedState));
        } catch (simplifySaveError) {
          console.error('Simplified save error:', simplifySaveError);
          
          // Try an even more minimal state
          try {
            const minimalState = {
              organizationId: projectState.organizationId,
              currentProjectId: projectState.currentProjectId,
              activeStep: Number(projectState.activeStep) || 0
            };
            localStorage.setItem(storageKey, JSON.stringify(minimalState));
          } catch (minimalSaveError) {
            console.error('Even minimal save failed:', minimalSaveError);
            
            // Last resort - clear storage for this user
            try {
              localStorage.removeItem(storageKey);
            } catch (clearError) {
              console.error('Failed to clear storage:', clearError);
            }
          }
        }
      }
    } catch (outerError) {
      console.error('Critical error in state persistence effect:', outerError);
    }
  }, [projectState, userId]);

  const setOrganizationId = newOrgId => {
    // Type safety
    newOrgId = Number(newOrgId) || null;
    
    // Update state, making sure to avoid updates when IDs match
    setProjectState(prev => {
      const currentOrgId = prev.organizationId;
      
      // If the IDs match, don't update state
      if (currentOrgId === newOrgId) {
        return prev;
      }
      
      return {
        ...prev,
        organizationId: newOrgId
      };
    });
  };

  const setProjectFormData = (formData) => {
    setProjectState(prev => ({
      ...prev,
      projectFormData: {
        ...prev.projectFormData,
        ...formData
      }
    }));
  };

  const completeProjectForm = () => {
    setProjectState(prev => ({
      ...prev,
      projectFormCompleted: true,
      activeStep: 1 // This is already a number
    }));
  };

  const resetProjectForm = () => {
    setProjectState(prev => ({
      ...prev,
      projectFormData: {
        title: '',
        description: '',
        deadline: null,
        problem_statement: '',
        priority: 'medium',
      },
      projectFormCompleted: false,
      activeStep: 0 // This is already a number
    }));
  };

  const setActiveStep = (step) => {
    // Ensure step is always a number
    const numStep = Number(step);
    if (isNaN(numStep)) {
      console.error('Invalid activeStep value:', step);
      return; // Don't update with invalid values
    }
    
    setProjectState(prev => ({
      ...prev,
      activeStep: numStep
    }));
  };

  const resetActiveStep = () => {
    setProjectState(prev => ({
      ...prev,
      activeStep: 0
    }));
  };

  const trackGenerationAttempt = () => {
    setProjectState(prev => ({
      ...prev,
      lastGenerationAttempt: new Date().toISOString()
    }));
  };

  const createProjectWithRoadmap = async (
    organizationId,
    title,
    description,
    priority = 'medium',
    deadline = null,
    roadmap_text = '',
    tasks_checklist = '',
    selectedMethodology = null
  ) => {
    if (!organizationId) {
      console.error('Cannot create project: No organization ID provided');
      throw new Error('Organization ID is required');
    }

    if (!title) {
      console.error('Cannot create project: No project title provided');
      throw new Error('Project title is required');
    }

    try {
      // Process the deadline value
      const apiDeadline = deadline instanceof Date ? deadline.toISOString() : deadline;
      
      // Create our project data payload
      const projectData = {
        title,
        description,
        priority,
        deadline: apiDeadline,
        roadmap_text: roadmap_text || '',
        tasks_checklist: tasks_checklist || '',
        methodology: selectedMethodology
      };
      
      // Call the API directly with organization ID and project data
      const response = await createProject(organizationId, projectData);
      const newProject = response.data;
      
      // Update state with the new project
      setProjectState(prev => ({
        ...prev,
        currentProjectId: newProject.id,
        projectCreated: true,
        roadmapAccepted: true,
        projectFormCompleted: true
      }));
      
      return newProject;
    } catch (error) {
      console.error('Error creating project with roadmap:', error);
      throw error;
    }
  };

  const setCurrentProject = (projectId) => {
    // Only reset roadmap-related state, not the whole project state
    setProjectState(prev => ({
      ...prev,
      currentProjectId: projectId,
      // Don't reset these values when viewing an existing project
      // roadmapGenerated: false,
      // roadmapAccepted: false,
      // roadmap: null,
      projectCreated: true
      // Don't reset activeStep as it breaks navigation
      // activeStep: 0
    }));
  };

  const setRequirements = (requirements) => {
    setProjectState(prev => ({
      ...prev,
      requirements
    }));
  };

  const setProblemStatement = (problemStatement) => {
    setProjectState(prev => ({
      ...prev,
      problemStatement
    }));
  };

  const setDeadline = (deadline) => {
    setProjectState(prev => ({
      ...prev,
      deadline
    }));
  };

  const setRoadmap = (roadmap) => {
    setProjectState(prev => ({
      ...prev,
      roadmap,
      roadmapGenerated: true
    }));
  };

  const acceptRoadmap = () => {
    // Set roadmapAccepted to true and move to step 2
    try {
      // Always use a specific step number (2) rather than a variable
      // Update state in a single operation to avoid potential issues
      setProjectState(prev => ({
        ...prev,
        roadmapAccepted: true,
        activeStep: 2, // Hard-coded step number for reliability
        hasRedirectedToRoadmap: true // Set the guard to prevent future redirects
      }));
    } catch (error) {
      console.error('Error accepting roadmap:', error);
      // Ensure we at least set the accepted flag even if step change fails
      setProjectState(prev => ({
        ...prev,
        roadmapAccepted: true,
        hasRedirectedToRoadmap: true
      }));
    }
  };

  const resetProject = () => {
    try {
      // Reset to default state
      setProjectState(getDefaultState());
      
      // Clean up localStorage
      if (userId) {
        localStorage.removeItem(`projectState_${userId}`);
      }
      
      // Clean up sessionStorage flags
      const sessionKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.startsWith('project_') || 
          key.startsWith('visited_') || 
          key.startsWith('redirected_')
        )) {
          sessionKeys.push(key);
        }
      }
      
      // Remove collected keys
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      // Clean up API cache
      if (window.failedEndpointsCache) {
        window.failedEndpointsCache.forEach((value, key) => {
          if (key.includes('/projects/')) {
            window.failedEndpointsCache.delete(key);
          }
        });
      }
    } catch (error) {
      console.error('Error resetting project state:', error);
    }
  };

  const updateTasks = (tasks) => {
    setProjectState(prev => ({
      ...prev,
      tasks
    }));
  };

  const shouldRedirectToRoadmap = (projectId) => {
    // Don't redirect if explicitly told not to
    if (sessionStorage.getItem(`no_redirect_${projectId}`) === 'true') {
      return false;
    }
    
    // Don't redirect if we've already redirected this session
    if (sessionStorage.getItem(`redirected_project_${projectId}`) === 'true') {
      return false;
    }
    
    // Don't redirect if the project has been visited directly
    if (sessionStorage.getItem(`visited_project_${projectId}`) === 'true') {
      return false;
    }
    
    // Don't redirect if we've already created tasks
    if (sessionStorage.getItem(`project_${projectId}_has_tasks`) === 'true') {
      return false;
    }
    
    // Check for infinite loop protection
    const redirectAttempts = parseInt(sessionStorage.getItem(`redirect_attempts_${projectId}`) || '0', 10);
    if (redirectAttempts > 2) {
      console.warn(`⚠️ Preventing potential infinite redirect loop for project ${projectId}`);
      // Set a flag to prevent future redirects
      sessionStorage.setItem(`no_redirect_${projectId}`, 'true');
      return false;
    }
    
    // Increment the redirect attempts counter
    sessionStorage.setItem(`redirect_attempts_${projectId}`, String(redirectAttempts + 1));
    
    // Default behavior - return true if the project needs roadmap creation
    const hasRoadmap = projectState.roadmap !== null;
    return !hasRoadmap;
  };

  return (
    <ProjectContext.Provider value={{
      ...projectState,
      setOrganizationId,
      setProjectFormData,
      completeProjectForm,
      resetProjectForm,
      createProjectWithRoadmap,
      setCurrentProject,
      setRequirements,
      setProblemStatement,
      setDeadline,
      setRoadmap,
      acceptRoadmap,
      resetProject,
      updateTasks,
      shouldRedirectToRoadmap,
      setActiveStep,
      resetActiveStep,
      trackGenerationAttempt
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export default ProjectContext; 