import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  alpha,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Save as SaveIcon,
  Flag as FlagIcon,
  DateRange as DateRangeIcon,
  Description as DescriptionIcon,
  // eslint-disable-next-line no-unused-vars
  Task as TaskIcon,
  Title as TitleIcon,
  ListAlt as ListAltIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { useProjectContext } from '../context/ProjectContext';
// eslint-disable-next-line no-unused-vars
import { generateRoadmap, createTask } from '../services/api';
import ReactMarkdown from 'react-markdown';

// Add this import to ensure window.failedEndpointsCache is initialized
import '../services/api';

// Define the steps
const steps = [
  'Project Details',
  'AI-Generated Roadmap',
  'Task Checklist',
  'Project Confirmation'
];

const ProjectCreation = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const theme = useTheme(); // Used in styled components below
  
  const {
    projectFormData,
    setProjectFormData,
    setRoadmap,
    roadmap,
    organizationId,
    createProjectWithRoadmap,
    activeStep,
    setActiveStep,
    trackGenerationAttempt,
    // eslint-disable-next-line no-unused-vars
    acceptRoadmap,
    resetProject
  } = useProjectContext();
  
  // State for stepper (use context value)
  // const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Loading states
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for project details form
  const [projectDetails, setProjectDetails] = useState({
    title: '',
    description: '',
    problem_statement: '',
    deadline: null,
    priority: 'medium',
  });
  
  // State for AI prompt
  // eslint-disable-next-line no-unused-vars
  const [prompt, setPrompt] = useState('');
  
  // Add additional local state for active step
  const [localActiveStep, setLocalActiveStep] = useState(Number(activeStep) || 0);
  
  // Track initialization to prevent multiple setup effects
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Add state for refinement
  const [isRefining, setIsRefining] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  
  // Add state for tasks and task generation
  const [tasks, setTasks] = useState([]);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  
  // Function to clear session state when needed
  const clearUserSession = () => {
    if (!orgId) return; // Need organization ID to proceed
    
    // Check if this is a fresh start or continuation
    const startFresh = sessionStorage.getItem('should_reset_project') === 'true';
    if (startFresh) {
      sessionStorage.removeItem('should_reset_project');
      
      // Use context's reset function
      resetProject();
      
      // Reset local state
      setLocalActiveStep(0);
      setError('');
      setSuccess('');
      setPrompt('');
      setProjectDetails({
        title: '',
        description: '',
        problem_statement: '',
        deadline: null,
        priority: 'medium',
      });
    }
  };
  
  // COMPLETE REWRITE: Single-direction synchronization to fix infinite loop
  useEffect(() => {
    // Stop multiple initialization
    if (isInitialized) {
      return;
    }
    
    setIsInitialized(true);
    
    // Clear any stale state
    clearUserSession();
    
    // Check if coming from project list (fresh start)
    const fromProjectList = sessionStorage.getItem('from_project_list') === 'true';
    if (fromProjectList) {
      sessionStorage.removeItem('from_project_list');
      resetProject();
    }
    
    // Get one-time snapshot of context state
    const numContextStep = Number(activeStep);
    const hasValidRoadmap = !!roadmap;
    
    // Initialize form data from context (ONCE)
    if (projectFormData) {
      try {
        // Process deadline if it's a string
        let deadlineValue = projectFormData.deadline;
        if (deadlineValue && typeof deadlineValue === 'string') {
          try {
            deadlineValue = new Date(deadlineValue);
          } catch (err) {
            console.warn('Invalid date format in projectFormData', err);
            deadlineValue = null;
          }
        }
        
        // Set project details from context
        setProjectDetails({
          title: projectFormData.title || '',
          description: projectFormData.description || '',
          problem_statement: projectFormData.problem_statement || '',
          deadline: deadlineValue,
          priority: projectFormData.priority || 'medium',
        });
        
        // Pre-populate prompt with project details
        const titlePrefix = projectFormData.title 
          ? `Based on the project "${projectFormData.title}"`
          : 'Create a project roadmap';
          
        let contextDetails = '';
        if (projectFormData.problem_statement) {
          contextDetails = ` addressing the problem: "${projectFormData.problem_statement}"`;
        } else if (projectFormData.description) {
          contextDetails = ` with the description: "${projectFormData.description}"`;
        }
        
        let deadlineInfo = '';
        if (deadlineValue) {
          const formattedDate = deadlineValue instanceof Date 
            ? deadlineValue.toLocaleDateString()
            : 'the specified deadline';
          deadlineInfo = ` The project deadline is ${formattedDate}.`;
        }
        
        setPrompt(`${titlePrefix}${contextDetails}.${deadlineInfo} Please generate a comprehensive roadmap with phases and tasks that will help complete this project successfully and on time.`);
      } catch (err) {
        console.error('Error initializing form data:', err);
      }
    }
    
    // Set initial step (ONCE)
    if (!isNaN(numContextStep) && numContextStep >= 0 && numContextStep < steps.length) {
      setLocalActiveStep(numContextStep);
    }
    
    // Special case: If we have a roadmap but are on step 0, move to step 1
    if (hasValidRoadmap && numContextStep === 0) {
      acceptRoadmap();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - runs exactly ONCE
  
  // SIMPLIFIED step synchronization - only syncs from context to local
  useEffect(() => {
    // Don't run until after initialization
    if (!isInitialized) return;
    
    const numContextStep = Number(activeStep);
    const numLocalStep = Number(localActiveStep);
    
    // Only update local step if context step changed and is valid
    if (numContextStep !== numLocalStep && 
        !isNaN(numContextStep) && 
        numContextStep >= 0 && 
        numContextStep < steps.length) {
      
      // console.log(`🔄 Syncing step: context=${numContextStep}, local=${numLocalStep}`);
      setLocalActiveStep(numContextStep);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, isInitialized, localActiveStep]);
  
  // Direct update function to handle step changes safely
  const updateStep = (newStep) => {
    // Convert to number and validate
    const numStep = Number(newStep);
    
    // Only proceed if step is valid
    if (isNaN(numStep) || numStep < 0 || numStep >= steps.length) {
      // console.log(`🔄 Updating step to: ${numStep}`);
      return;
    }
    
    // console.log(`🔄 Updating step to: ${numStep}`);
    
    // Update context step first - local step will follow via the effect
    setActiveStep(numStep);
  };
  
  // Handle form field changes
  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setProjectDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle date picker changes
  const handleDateChange = (newDate) => {
    setProjectDetails(prev => ({
      ...prev,
      deadline: newDate
    }));
  };
  
  // Function to handle prompt changes (AI instructions)
  // eslint-disable-next-line no-unused-vars
  const handlePromptChange = (e) => {
    setPrompt(e.target.value);
  };
  
  // Validate project details before proceeding
  const validateProjectDetails = () => {
    try {
      // console.log('Validating project details...');
      
      // Check for required fields
      if (!projectDetails.title.trim()) {
        setError('Project title is required');
        // console.log('Validation failed: Missing title');
        return false;
      }
      
      if (!projectDetails.priority) {
        setError('Priority is required');
        // console.log('Validation failed: Missing priority');
        return false;
      }
      
      // Save project details to context
      // console.log('Project details validated, saving to context');
      setProjectFormData(projectDetails);
      return true;
    } catch (error) {
      console.error('Error validating project details:', error);
      setError('An error occurred while validating project details');
      return false;
    }
  };
  
  // Function to validate and enhance the roadmap if needed
  // eslint-disable-next-line no-unused-vars
  const validateAndEnhanceRoadmap = (roadmapData) => {
    // Return the roadmap data as is if it has content field
    if (roadmapData && roadmapData.content) {
      return roadmapData;
    }
    
    // If there's no content, create a default roadmap structure
    return {
      content: `# Project Roadmap for ${projectDetails.title}

## Phase 1: Planning & Requirements
- Define project scope and requirements
- Set up project environment
- Create initial project plan

## Phase 2: Development
- Implement core functionality
- Develop user interface
- Integrate with backend systems

## Phase 3: Testing & Deployment
- Perform quality assurance testing
- Fix identified bugs and issues
- Deploy to production environment`
    };
  };

  // Helper function to calculate project complexity based on description and prompt
  const calculateProjectComplexity = (description = '', prompt = '') => {
    const combinedText = (description + ' ' + prompt).toLowerCase();
    
    // Define complexity indicators
    const complexityKeywords = {
      high: [
        'complex', 'advanced', 'sophisticated', 'extensive', 'comprehensive', 'enterprise',
        'microservices', 'distributed', 'real-time', 'ai', 'ml', 'machine learning',
        'blockchain', 'scalable', 'high-performance', 'multi-tenant', 'big data'
      ],
      medium: [
        'moderate', 'standard', 'typical', 'conventional', 'regular', 'normal',
        'api', 'integration', 'dashboard', 'authentication', 'authorization'
      ],
      low: [
        'simple', 'basic', 'minimal', 'straightforward', 'easy', 'small', 'prototype',
        'mvp', 'proof of concept', 'poc', 'single-page', 'static'
      ]
    };
    
    // Count matches for each complexity level
    const highCount = complexityKeywords.high.filter(word => 
      combinedText.includes(word)).length;
      
    const mediumCount = complexityKeywords.medium.filter(word => 
      combinedText.includes(word)).length;
      
    const lowCount = complexityKeywords.low.filter(word => 
      combinedText.includes(word)).length;
    
    // Determine complexity based on keyword counts
    if (highCount > (mediumCount + lowCount)) {
      return 'high';
    } else if (lowCount > (highCount + mediumCount)) {
      return 'low';
    } else {
      return 'medium';
    }
  };
  
  // Convert roadmap object to formatted text for refinement prompt
  const convertRoadmapToRefinementFormat = (roadmapData) => {
    if (!roadmapData) return '';
    
    // If roadmap has content field, just return it
    if (roadmapData.content) {
      return roadmapData.content;
    }
    
    // Fallback for old format (should not happen with updates)
    if (roadmapData.phases) {
      let text = `Current Roadmap Structure:\n\n`;
      
      roadmapData.phases.forEach((phase, phaseIndex) => {
        text += `Step ${phaseIndex + 1}: ${phase.name || phase.description}\n\n`;
        
        (phase.tasks || []).forEach((task) => {
          text += `- ${task.description || task.title}\n`;
        });
        
        text += '\n';
      });
      
      return text;
    }
    
    return '';
  };

  // Modify useEffect to auto-generate roadmap when step changes to 1
  useEffect(() => {
    const autoGenerateRoadmap = async () => {
      try {
        // If we're on step 1 (roadmap) and there's no roadmap yet, generate one automatically
        if (activeStep === 1 && !roadmap && !generatingRoadmap && projectDetails.title) {
          // console.log('Auto-generating roadmap on page load...');
          await handleGenerateRoadmap();
        }
      } catch (err) {
        console.error('Error in auto-generation of roadmap:', err);
        setError(`Failed to auto-generate roadmap: ${err.message || 'Unknown error'}`);
        setGeneratingRoadmap(false);
      }
    };
    
    autoGenerateRoadmap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, roadmap, generatingRoadmap, projectDetails.title]);

  // Modify the handleGenerateRoadmap function to use the refinement data when applicable
  const handleGenerateRoadmap = useCallback(async (isRefinement = false) => {
    try {
      // Validate title
      if (!projectDetails.title) {
        setError('Project title is required');
        setIsLoading(false);
        return;
      }
      
      // Set loading state
      setGeneratingRoadmap(true);
      setIsLoading(true);
      setError('');
      setSuccess('');
      
      // Track this generation attempt
      // console.log('Generating roadmap with project details:', projectDetails);
      trackGenerationAttempt();

      // Set up the options for the roadmap generation with proper structure
      const options = {
        problem_statement: projectDetails.problem_statement || '',
        priority: projectDetails.priority || 'medium',
        project_complexity: calculateProjectComplexity(projectDetails.description, projectDetails.problem_statement || '')
      };
      
      // Add refinement information if this is a refinement request
      if (isRefinement && refinementPrompt && roadmap) {
        options.is_refinement = true;
        options.refinement_instructions = refinementPrompt;
        
        // Convert roadmap object to text representation for the refinement prompt
        const roadmapText = convertRoadmapToRefinementFormat(roadmap);
        options.existing_roadmap = roadmapText;
        
        // console.log('Refining roadmap with instructions:', refinementPrompt);
      }
      
      // Call the updated generateRoadmap function with proper options
      // console.log('Sending roadmap generation request with options:', options);
      const response = await generateRoadmap(
        projectDetails.title,
        projectDetails.description || '',
        projectDetails.deadline,
        options
      );
      
      // Check if we have a valid response with data
      if (response && response.data) {
        // Check if the response has the content field (new format)
        if (response.data.content) {
          // console.log('✅ Roadmap generated successfully with content:', response.data);
          
          // Save the roadmap to state directly - no validation/enhancement to interfere with AI output
          setRoadmap(response.data);
          
          // Also save to localStorage as a backup
          localStorage.setItem('temp_roadmap', JSON.stringify(response.data));
          
          // Show success message
          setSuccess(isRefinement ? 
            'Roadmap refined successfully! Review the updated version below.' : 
            'Roadmap generated successfully! Review it below and click Next to proceed.');
          
          // Clear refinement state if we were refining
          if (isRefinement) {
            setIsRefining(false);
            setRefinementPrompt('');
          }
        }
        // Fallback for old format (phases)
        else if (response.data.phases) {
          // console.log('✅ Roadmap generated successfully with phases:', response.data);
          
          // Save the roadmap to state directly - no validation/enhancement to interfere with AI output
          setRoadmap(response.data);
          
          // Also save to localStorage as a backup
          localStorage.setItem('temp_roadmap', JSON.stringify(response.data));
          
          // Show success message
          setSuccess(isRefinement ? 
            'Roadmap refined successfully! Review the updated version below.' : 
            'Roadmap generated successfully! Review it below and click Next to proceed.');
          
          // Clear refinement state if we were refining
          if (isRefinement) {
            setIsRefining(false);
            setRefinementPrompt('');
          }
        } else {
          throw new Error('Generated roadmap does not have the expected structure');
        }
      } else {
        throw new Error('No response data received from roadmap generation');
      }
    } catch (err) {
      console.error('❌ Error generating roadmap:', err);
      
      // Clear the roadmap state to avoid confusion
      setRoadmap(null);
      
      // Set a clear error message
      setError(`Failed to generate roadmap: ${err.message || 'Unknown error'}. Please try again with more specific details.`);
    } finally {
      setGeneratingRoadmap(false);
      setIsLoading(false);
    }
  }, [
    projectDetails, 
    refinementPrompt, 
    roadmap, 
    setRoadmap, 
    trackGenerationAttempt, 
    setError, 
    setSuccess, 
    setIsRefining, 
    setRefinementPrompt
  ]);
  
  // Function to generate tasks from the roadmap using AI
  const handleGenerateTasks = async () => {
    if (!roadmap || !roadmap.content) {
      setError('Please generate a roadmap first');
      return;
    }
    
    setGeneratingTasks(true);
    setIsLoading(true);
    setError('');
    
    try {
      // Create prompt for task generation using the roadmap content
      const taskGenerationPrompt = `Using the following roadmap:

## **Roadmap**
${roadmap.content}  

Generate a **sequenced checklist of tasks** required to complete this project.

## **Output Format (Strictly Follow This)**
--------------------------------------------------
- Task 1: [Concise, clear description]
- Task 2: [Concise, clear description]
...
- Task N: [Concise, clear description]
--------------------------------------------------

## **Rules:**  
1. **Return only the checklist—no extra text, no unnecessary explanations.**  
2. **Each task must be a single bullet point with a clear action.**  
3. **Tasks should be in the correct order to follow the roadmap logically.**  
4. **STRICTLY REMOVE any hardcoded task outputs. Only use the LLM-generated tasks.**`;

      // Use the same API function but with a custom prompt specifically for tasks
      const response = await generateRoadmap(
        projectDetails.title,
        projectDetails.description,
        projectDetails.deadline,
        {
          prompt: taskGenerationPrompt,
          problem_statement: projectDetails.problem_statement || '',
          priority: projectDetails.priority || 'medium'
        }
      );
      
      if (response && response.data && response.data.content) {
        // console.log('Generated tasks:', response.data.content);
        
        // Store the tasks response (plain text for display)
        setTasks(response.data.content);
        
        // Move to the next step (tasks checklist)
        updateStep(2);
        
        setSuccess('Tasks generated successfully!');
      } else {
        throw new Error('Failed to generate tasks - no data received');
      }
    } catch (err) {
      console.error('Error generating tasks:', err);
      setError(`Failed to generate tasks: ${err.message || 'Unknown error'}`);
    } finally {
      setGeneratingTasks(false);
      setIsLoading(false);
    }
  };
  
  // Final submit to create project and store roadmap/checklist as text
  const handleCreateProject = async () => {
    // Validate required data is present
    if (!roadmap || !roadmap.content) {
      setError('Please generate a roadmap before creating the project');
      return;
    }
    
    if (!tasks) {
      setError('Please generate tasks before creating the project');
      return;
    }
    
    if (!projectDetails.title) {
      setError('Project title is required');
      return;
    }
    
    setCreatingProject(true);
    setError('');
    
    try {
      // console.log('Creating project with roadmap and tasks...');
      
      // Verify the token is present before proceeding
      const token = localStorage.getItem('token');
      if (!token) {
        // console.warn('No authentication token found. Will likely encounter auth errors.');
        setError('Authentication token missing. Please log in again.');
        setCreatingProject(false);
        return;
      } else {
        // console.log('Authentication token verified: present ✓');
      }
      
      // Use the roadmap content directly
      const roadmapText = roadmap.content;
      
      // Convert tasks from plain text to JSON structure for database storage
      const tasksJson = convertTasksToJson(tasks);
      
      // Create the project with roadmap and checklist text
      // console.log('Calling createProjectWithRoadmap with roadmap and tasks data:', {
      const newProject = await createProjectWithRoadmap(
        organizationId,
        projectDetails.title,
        projectDetails.description,
        projectDetails.priority,
        projectDetails.deadline,
        roadmapText,
        tasksJson
      );
      
      // console.log('✅ Project created successfully with roadmap and checklist text:', newProject);
      setSuccess('Project created successfully! Redirecting to tasks...');
      
      // Set explicit flags to prevent infinite navigation loops
      sessionStorage.setItem('project_created', 'true');
      sessionStorage.setItem(`project_${newProject.id}_visited`, 'true');
      sessionStorage.removeItem(`redirected_project_${newProject.id}`);
      
      // Reset project state to prevent issues on next visit
      setTimeout(() => {
        // Navigate to tasks page
        navigate(`/projects/${newProject.id}/tasks`);
        
        // Reset project state AFTER navigation completes
        setTimeout(() => {
          resetProject();
        }, 1000);
      }, 1500);
    } catch (err) {
      console.error('❌ Error creating project:', err);
      setError(`Failed to create project: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setCreatingProject(false);
    }
  };
  
  // Handle next button click - completely rewritten
  const handleNext = () => {
    // Validate fields based on the current step
    if (activeStep === 0) {
      if (!validateProjectDetails()) {
        return;
      }
      
      // For step 0, we're moving to generate a roadmap
      updateStep(1);
    } else if (activeStep === 2) {
      if (!tasks) {
        setError('Please generate tasks before proceeding');
        return;
      }
      
      // From tasks step to confirmation
      updateStep(3);
    }
  };
  
  // Handle going back one step
  const handleBack = () => {
    // Handle going back based on the current step
    if (localActiveStep > 0) {
      // console.log(`Moving back from step ${localActiveStep} to ${localActiveStep - 1}`);
      
      // If on task checklist step, go back to roadmap
      if (localActiveStep === 2) {
        updateStep(1);
      }
      // If on roadmap step, go back to project details
      else if (localActiveStep === 1) {
        updateStep(0);
      }
      // If on confirmation step, go back to task checklist
      else if (localActiveStep === 3) {
        updateStep(2);
      }
    }
  };
  
  // Move countTotalTasks to be within the component function
  const countTotalTasks = () => {
    let totalTasks = 0;
    
    // Count tasks from the tasks field (primary source)
    if (tasks) {
      const lines = tasks.split('\n');
      // Count lines that start with - or * (bullet points)
      totalTasks += lines.filter(line => {
        const trimmedLine = line.trim();
        return trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ');
      }).length;
    }
    
    // If no tasks counted and roadmap is available, try to count from roadmap content as fallback
    if (totalTasks === 0 && roadmap) {
      // If roadmap has content, count the bullet points (tasks)
      if (roadmap.content) {
        const lines = roadmap.content.split('\n');
        // Count lines that start with - or *
        totalTasks = lines.filter(line => {
          const trimmedLine = line.trim();
          return trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ');
        }).length;
      }
      
      // Fallback for old format
      else if (roadmap.phases) {
        totalTasks = roadmap.phases.reduce((total, phase) => {
          return total + (phase.tasks ? phase.tasks.length : 0);
        }, 0);
      }
    }
    
    return totalTasks;
  };
  
  // Render the current step content - completely rewritten for stability
  const renderStepContent = () => {
    // Force stepIndex to be a number
    const stepIndex = Number(localActiveStep);
   // console.log(`Rendering content for step: ${stepIndex}`);
    
    // Simple validation with fallback rendering
    if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= steps.length) {
      // console.error(`Invalid step index: ${stepIndex}, fallback to step 0`);
      // Return step 0 content but don't change state to avoid loops
      return renderStep0Content();
    }
    
    try {
      // Switch to appropriate step with proper validation
      switch (stepIndex) {
        case 0:
          return renderStep0Content();
          
        case 1:
          return renderStep1Content();
          
        case 2:
          // If we're on step 2 but have no tasks, show an error instead of redirecting
          if (!tasks) {
            return (
              <Box p={3} border={1} borderColor="error.main" borderRadius={2}>
                <Typography variant="h6" color="error" gutterBottom>
                  Missing Tasks Data
                </Typography>
                <Typography variant="body1" gutterBottom>
                  Tasks must be generated before reaching this step.
                </Typography>
                <Button 
                  variant="contained"
                  color="primary"
                  onClick={() => updateStep(1)}
                  sx={{ mt: 2 }}
                >
                  Go to Roadmap Step
                </Button>
              </Box>
            );
          }
          return renderStep2Content();
          
        case 3:
          return renderStep3Content();
          
        default:
          // console.error(`Unhandled step index: ${stepIndex}`);
          return renderStep0Content();
      }
    } catch (error) {
      // console.error('Error rendering step content:', error);
      
      // Return error UI instead of changing step
      return (
        <Box p={3} border={1} borderColor="error.main" borderRadius={2}>
          <Typography color="error" variant="h6">
            Error Rendering Content
          </Typography>
          <Typography color="error" variant="body2" gutterBottom>
            {error.message || "Unknown error"}
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => updateStep(0)}
            sx={{ mt: 2 }}
          >
            Reset to First Step
          </Button>
        </Box>
      );
    }
  };
  
  // Render step 0 content (Project Details)
  const renderStep0Content = () => {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
          Project Details
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Enter the details of your software project. These details will be used to generate a tailored development roadmap.
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              required
              fullWidth
              label="Project Title"
              name="title"
              value={projectDetails.title}
              onChange={handleDetailsChange}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={projectDetails.description}
              onChange={handleDetailsChange}
              multiline
              rows={3}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Problem Statement"
              name="problem_statement"
              value={projectDetails.problem_statement}
              onChange={handleDetailsChange}
              multiline
              rows={3}
              helperText="Describe the problem this project aims to solve"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="priority-label">Priority *</InputLabel>
              <Select
                labelId="priority-label"
                name="priority"
                value={projectDetails.priority}
                label="Priority *"
                onChange={handleDetailsChange}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Deadline"
              value={projectDetails.deadline ? new Date(projectDetails.deadline) : null}
              onChange={handleDateChange}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Render step 1 content (AI Roadmap & Task Checklist)
  const renderStep1Content = () => {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
          AI-Generated Software Development Roadmap
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Review the auto-generated roadmap below. When you're ready, click "Generate Tasks" to create a task checklist.
        </Typography>
        
        {generatingRoadmap && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
            <Typography variant="h6" color="text.secondary" sx={{ ml: 2 }}>
              {roadmap ? 'Refining roadmap...' : 'Generating your software development roadmap...'}
            </Typography>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}
        
        {roadmap && !generatingRoadmap && (
          <Box sx={{ mt: 3 }}>
            {/* Refinement controls */}
            <Box sx={{ mb: 4 }}>
              {!isRefining ? (
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => setIsRefining(true)}
                  sx={{ mb: 2 }}
                >
                  Refine Roadmap
                </Button>
              ) : (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Refine Your Roadmap
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="Provide specific instructions on how to refine the roadmap. For example: 'Add more DevOps tasks', 'Include security testing', 'Focus more on frontend development', etc."
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleSubmitRefinement}
                      disabled={!refinementPrompt.trim() || generatingRoadmap}
                    >
                      Apply Refinements
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setIsRefining(false)}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
            
            {/* Display the roadmap */}
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Project Roadmap: {projectDetails.title}
              </Typography>
              
              {roadmap.content ? (
                <Box sx={{ mt: 2 }}>
                  <ReactMarkdown>
                    {roadmap.content}
                  </ReactMarkdown>
                </Box>
              ) : roadmap.phases ? (
                // Fallback for old format (should not happen with updates)
                roadmap.phases.map((phase, phaseIndex) => (
                  <Box key={phaseIndex} sx={{ mt: 3, mb: 4 }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: 'primary.main',
                        pb: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      Phase {phaseIndex + 1}: {phase.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                      {phase.description}
                    </Typography>
                    
                    {phase.tasks && phase.tasks.map((task, taskIndex) => (
                      <Box 
                        key={taskIndex} 
                        sx={{ 
                          mb: 2, 
                          pb: 2,
                          borderBottom: taskIndex < phase.tasks.length - 1 ? '1px dashed' : 'none',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="subtitle2">
                          Task {phaseIndex + 1}.{taskIndex + 1}: {task.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {task.description}
                        </Typography>
                        {task.estimated_duration && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Estimated Duration: {task.estimated_duration}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="error">
                  Error: Invalid roadmap data structure
                </Typography>
              )}
            </Paper>
            
            {/* Add Generate Tasks button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleGenerateTasks}
                disabled={generatingTasks || isLoading}
                startIcon={generatingTasks ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ 
                  borderRadius: 2,
                  py: 1.2,
                  px: 3,
                  fontWeight: 'medium',
                  boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`
                }}
              >
                {generatingTasks ? 'Generating...' : 'Generate Tasks'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    );
  };
  
  // Render step 2 content (Task Checklist)
  const renderStep2Content = () => {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
          Task Checklist
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Review the AI-generated tasks for your project. These tasks are derived from your roadmap and will help you track progress.
        </Typography>
        
        {generatingTasks && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
            <Typography variant="h6" color="text.secondary" sx={{ ml: 2 }}>
              Generating tasks from your roadmap...
            </Typography>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}
        
        {tasks && !generatingTasks && (
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Project Tasks: {projectDetails.title}
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <ReactMarkdown>
                {tasks}
              </ReactMarkdown>
            </Box>
          </Paper>
        )}
      </Box>
    );
  };
  
  // Render step 3 content (Project Confirmation)
  const renderStep3Content = () => {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
          Confirm Project Creation
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Review all details before creating your project.
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card 
              variant="outlined" 
              sx={{ 
                borderRadius: 2,
                height: '100%',
                boxShadow: theme => `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`
              }}
            >
              <CardHeader title="Project Details" />
              <Divider />
              <CardContent>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <TitleIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Title"
                      secondary={projectDetails.title}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <DescriptionIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Description"
                      secondary={projectDetails.description || "No description provided"}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <ListAltIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Problem Statement"
                      secondary={projectDetails.problem_statement || "No problem statement provided"}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <FlagIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Priority"
                      secondary={projectDetails.priority.charAt(0).toUpperCase() + projectDetails.priority.slice(1)}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      <DateRangeIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Deadline"
                      secondary={projectDetails.deadline ? format(new Date(projectDetails.deadline), 'MMM d, yyyy') : "Not set"}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Card 
              variant="outlined"
              sx={{ 
                borderRadius: 2,
                boxShadow: theme => `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`
              }}
            >
              <CardHeader 
                title="Roadmap & Tasks Summary" 
                subheader={`${countTotalTasks()} tasks identified`}
              />
              <Divider />
              <CardContent>
                {roadmap && tasks ? (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      A roadmap and task checklist have been generated for your project.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Once the project is created, you will be able to track progress on each task.
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="error">
                    Please go back and generate a roadmap and tasks before confirming.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Add a function to handle refinement toggle
  // eslint-disable-next-line no-unused-vars
  const handleToggleRefinement = () => {
    setIsRefining(!isRefining);
    if (isRefining) {
      setRefinementPrompt('');
    }
  };

  // Add a function to handle refinement input changes
  // eslint-disable-next-line no-unused-vars
  const handleRefinementChange = (e) => {
    setRefinementPrompt(e.target.value);
  };

  // Add function to submit refinement
  const handleSubmitRefinement = () => {
    if (!refinementPrompt.trim()) {
      setError('Please provide refinement instructions');
      return;
    }
    
    // Generate new roadmap with refinement instructions
    handleGenerateRoadmap(true);
  };
  
  // Function to convert plain text bullet point tasks into JSON structure
  const convertTasksToJson = (tasksText) => {
    if (!tasksText) return JSON.stringify([]);
    
    try {
      const lines = tasksText.split('\n');
      const taskItems = [];
      let taskId = 1;
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        // Check if line starts with a bullet point (- or *)
        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
          // Extract the task text (remove the bullet point)
          let taskContent = trimmedLine.substring(2).trim();
          
          // Parse title and description if they exist
          let title = taskContent;
          let description = '';
          
          // If the task follows the "Task X: [description]" format, extract title and description
          if (taskContent.includes(':')) {
            const parts = taskContent.split(':', 2);
            title = parts[0].trim();
            description = parts.length > 1 ? parts[1].trim() : '';
          }
          
          // Create a unique ID for the task
          const uniqueId = `task_${taskId++}`;
          
          // Add to task items array
          taskItems.push({
            id: uniqueId,
            title: title,
            description: description,
            phase: 'Tasks',
            phase_order: 1,
            task_order: index,
            estimated_duration: null,
            completed: false
          });
        }
      });
      
      // console.log(`Converted ${taskItems.length} plain text tasks to JSON structure`);
      return JSON.stringify(taskItems);
    } catch (error) {
      console.error('Error converting tasks to JSON:', error);
      return JSON.stringify([]);
    }
  };
  
  return (
    <Container maxWidth="lg">
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          boxShadow: theme => `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              mb: 1,
              fontWeight: 'bold',
              background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Create New Project
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Complete each step to set up your project with an AI-generated roadmap
          </Typography>
        </Box>
        
        <Stepper 
          activeStep={Number(localActiveStep)} 
          sx={{ mb: 4 }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert 
            severity="success" 
            sx={{ mb: 3 }}
            onClose={() => setSuccess('')}
          >
            {success}
          </Alert>
        )}
        
        <Box sx={{ mb: 3 }}>
          {renderStepContent()}
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            color="inherit"
            variant="outlined"
            onClick={localActiveStep === 0 
              ? () => {
                 // console.log('🏠 Cancel button clicked, navigating to projects list');
                  navigate(`/organizations/${organizationId}/projects`);
                } 
              : () => {
                 // console.log('⬅️ Back button clicked');
                  handleBack();
                }
            }
            startIcon={<ArrowBackIcon />}
            sx={{ borderRadius: 2 }}
          >
            {localActiveStep === 0 ? 'Cancel' : 'Back'}
          </Button>
          
          <Box>
            {localActiveStep === steps.length - 1 ? (
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                //  console.log('💾 Create Project button clicked');
                  handleCreateProject();
                }}
                disabled={creatingProject || !roadmap || !tasks}
                startIcon={creatingProject ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{ borderRadius: 2 }}
              >
                {creatingProject ? 'Creating Project...' : 'Accept & Create Project'}
              </Button>
            ) : localActiveStep === 1 ? (
              // Step 1 has the Generate Tasks button handled within the component
              null
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
               //   console.log('➡️ Next button clicked');
                  handleNext();
                }}
                endIcon={<ArrowForwardIcon />}
                sx={{ borderRadius: 2 }}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ProjectCreation; 