import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Box,
  CircularProgress,
  useTheme,
  alpha,
  Divider,
  Paper,
  Checkbox,
  FormControlLabel,
  Chip,
  LinearProgress,
  ButtonGroup,
  Tooltip
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import {
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { getProject, generateReport, saveTasksProgress } from '../services/api';
import { useProjectContext } from '../context/ProjectContext';

// Helper function to convert plain text tasks to structured array if JSON parsing fails
const convertPlainTextToTasksArray = (plainText) => {
  if (!plainText || typeof plainText !== 'string' || plainText.trim() === '') {
    return [];
  }
  
  try {
    const lines = plainText.split('\n');
    const tasks = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check if the line is a task (starts with - or *)
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        // Extract task text (without the bullet point)
        let taskContent = trimmedLine.substring(2).trim();
        
        // Extract title and description if formatted as "Task X: Description"
        let title = taskContent;
        let description = '';
        
        if (taskContent.includes(':')) {
          const parts = taskContent.split(':', 2);
          title = parts[0].trim();
          description = parts.length > 1 ? parts[1].trim() : '';
        }
        
        // Add the task
        tasks.push({
          id: `autogen_${index}`,
          title: title,
          description: description,
          phase: 'Tasks', // Default phase
          phase_order: 1,
          task_order: index,
          completed: false
        });
      }
    });
    
    return tasks;
  } catch (error) {
    console.error('Error converting plain text to tasks:', error);
    return [];
  }
};

// Helper function to validate project data
const validateProjectData = (data) => {
  if (!data) {
    console.error('No project data provided');
    return { isValid: false, error: 'No project data available' };
  }
  
  // Always consider the data valid but provide warnings if needed
  const result = { isValid: true, data };
  
  // Check roadmap_text - don't invalidate if missing
  if (!data.roadmap_text || typeof data.roadmap_text !== 'string' || data.roadmap_text.trim() === '') {
    console.warn('Project has no roadmap text or it is invalid');
    result.warning = 'Project does not have a roadmap description.';
  }
  
  // Try to parse tasks_checklist as JSON
  let parsedChecklist = [];
  try {
    if (data.tasks_checklist && typeof data.tasks_checklist === 'string' && data.tasks_checklist.trim() !== '') {
      try {
        // First attempt: Parse as JSON (preferred format)
        parsedChecklist = JSON.parse(data.tasks_checklist);
        
        if (!Array.isArray(parsedChecklist)) {
          console.warn('Project tasks checklist is not an array:', typeof parsedChecklist);
          // Try to create a task array from plain text
          parsedChecklist = convertPlainTextToTasksArray(data.tasks_checklist);
          
          if (parsedChecklist.length > 0) {
          } else {
            result.warning = 'Tasks checklist is not properly formatted.';
          }
        } else if (parsedChecklist.length === 0) {
          console.warn('Project tasks checklist is empty');
          result.warning = 'Tasks checklist is empty.';
        } else {
        }
      } catch (parseError) {
        console.error('Error parsing tasks_checklist JSON:', parseError);
        
        // Second attempt: Try to extract tasks from plain text
        parsedChecklist = convertPlainTextToTasksArray(data.tasks_checklist);
        
        if (parsedChecklist.length > 0) {
        } else {
          result.warning = 'Failed to parse tasks checklist. Tried both JSON and plain text formats.';
        }
      }
      
      result.parsedChecklist = parsedChecklist;
    } else {
      console.warn('Project has no tasks checklist or it is invalid');
      // Don't set warning here, already handled with roadmap warning if needed
    }
  } catch (error) {
    console.error('Error processing tasks checklist:', error);
    result.warning = 'Failed to parse tasks checklist.';
  }
  
  return result;
};

const Tasks = () => {
  const { projectId } = useParams();
  const theme = useTheme();
  const { setCurrentProject } = useProjectContext();
  const [project, setProject] = useState(null);
  const [taskChecklist, setTaskChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [success, setSuccess] = useState('');
  const [checklistUpdated, setChecklistUpdated] = useState(false);
  
  // Use a ref to track if data has been fetched to prevent duplicate API calls
  const dataFetchedRef = useRef(false);

  // Memoize the fetch function to prevent it from changing on re-renders
  const fetchProject = useCallback(async () => {
    if (dataFetchedRef.current) {
      return; // Skip if data has already been fetched
    }
    
    try {
      setLoading(true);
      
      const response = await getProject(projectId);
      
      // Process the data from the API response
      const projectData = response.data || response;
      
      // Always set the project data we received, even if validation fails
      setProject(projectData);
      
      // Validate the data
      const validationResult = validateProjectData(projectData);
      
      if (!validationResult.isValid) {
        setError(validationResult.error || 'Invalid project data');
        setLoading(false);
        return;
      }
      
      if (validationResult.warning) {
        setWarning(validationResult.warning);
      }
      
      // Update context with current project ID if needed
      if (setCurrentProject && projectId) {
        setCurrentProject(parseInt(projectId, 10));
      }
      
      // Process the validated checklist if available
      if (validationResult.parsedChecklist && Array.isArray(validationResult.parsedChecklist)) {
        const checklist = validationResult.parsedChecklist;
        
        // Ensure each task has a unique ID and proper structure
        const structuredChecklist = checklist.map((task, index) => ({
          id: task.id || `generated_id_${index}`,
          title: task.title || `Task ${index + 1}`,
          description: task.description || '',
          phase: task.phase || 'Tasks',
          phase_order: task.phase_order || 1,
          task_order: task.task_order || index,
          estimated_duration: task.estimated_duration || null,
          completed: task.completed || false
        }));
        
        // Check if we have saved progress in localStorage
        const savedProgress = localStorage.getItem(`checklist_${projectId}`);
        if (savedProgress) {
          try {
            const parsedSavedProgress = JSON.parse(savedProgress);
            // Merge saved progress with task checklist
            const mergedChecklist = structuredChecklist.map(task => {
              const savedTask = parsedSavedProgress.find(st => st.id === task.id);
              return savedTask ? { ...task, completed: savedTask.completed } : task;
            });
            setTaskChecklist(mergedChecklist);
          } catch (parseError) {
            console.error('Error parsing saved checklist:', parseError);
            setTaskChecklist(structuredChecklist);
          }
        } else {
          setTaskChecklist(structuredChecklist);
        }
      } 
      // If we don't have a parsed checklist, fall back to plain text conversion
      else if (projectData.tasks_checklist && typeof projectData.tasks_checklist === 'string') {
        const plainTextTasks = convertPlainTextToTasksArray(projectData.tasks_checklist);
        
        if (plainTextTasks.length > 0) {
          setTaskChecklist(plainTextTasks);
        } else {
          console.warn('Could not extract tasks from plain text');
          setTaskChecklist([]);
        }
      } else {
        setTaskChecklist([]);
      }
      
      // Mark as fetched to prevent duplicate fetches
      dataFetchedRef.current = true;
      setLoading(false);
    } catch (error) {
      console.error('Error fetching project data:', error);
      setError('Error loading project data. Please try again later.');
      setLoading(false);
    }
  }, [projectId, setCurrentProject]);

  useEffect(() => {
    const loadProject = async () => {
      await fetchProject();
    };
    
    loadProject();
  }, [fetchProject]); // Add fetchProject as a dependency

  // Move handleTaskToggle inside useCallback to fix exhaustive deps warning
  const handleTaskToggle = useCallback(async (taskId) => {
    try {
      // Create a copy of the current tasks
      const updatedTasks = taskChecklist.map(task => {
        if (task.id === taskId) {
          return { ...task, completed: !task.completed };
        }
        return task;
      });
      
      // Update state immediately for responsive UI
      setTaskChecklist(updatedTasks);
      setChecklistUpdated(true);
      
      // Save to localStorage
      const localStorageKey = `checklist_${projectId}`;
      localStorage.setItem(localStorageKey, JSON.stringify(updatedTasks));
      
      // Save to database
      const saveToDatabase = async (retries = 3) => {
        try {
          await saveTasksProgress(projectId, updatedTasks);
          setSuccess('Task progress updated and saved to database');
          
          // Clear the success message after 3 seconds
          setTimeout(() => {
            setSuccess('');
            setChecklistUpdated(false);
          }, 3000);
        } catch (error) {
          console.error(`Error saving tasks progress to database (retries left: ${retries-1}):`, error);
          
          // If we have retries left and it's a potentially recoverable error, retry
          if (retries > 1 && (!error.response || error.response.status >= 500)) {
            const delay = (4 - retries) * 1000; // 1s, 2s, 3s
            await new Promise(resolve => setTimeout(resolve, delay));
            return saveToDatabase(retries - 1);
          }
          
          // Display a more specific error message based on the error
          let errorMessage = 'Failed to save progress to database. Changes are only saved locally.';
          
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            if (error.response.status === 404) {
              errorMessage = 'Project not found. Progress saved locally only.';
            } else if (error.response.status === 403) {
              errorMessage = 'Permission denied. Progress saved locally only.';
            } else if (error.response.status >= 500) {
              errorMessage = 'Server error. Progress saved locally. Please try again later.';
            }
            
            if (error.response.data && error.response.data.error) {
              errorMessage += ` Details: ${error.response.data.error}`;
            }
          } else if (error.request) {
            // The request was made but no response was received
            errorMessage = 'No response from server. Progress saved locally only.';
          }
          
          setError(errorMessage);
          
          // Clear the error message after 5 seconds
          setTimeout(() => {
            setError('');
            setChecklistUpdated(false);
          }, 5000);
        }
      };
      
      // Try to save to database
      saveToDatabase();
      
    } catch (error) {
      console.error('Error toggling task completion:', error);
      setError('Failed to update task status');
    }
  }, [taskChecklist, projectId]); // Add dependencies
  
  // Calculate project progress - memoize via useCallback to prevent unnecessary recalculations
  const calculateProgress = useCallback(() => {
    // If we have structured tasks, use those for calculation
    if (taskChecklist && taskChecklist.length > 0) {
      const completedTasks = taskChecklist.filter(task => task.completed).length;
      return Math.round((completedTasks / taskChecklist.length) * 100);
    }
    
    // Fallback to counting tasks in plain text if we have no structured tasks
    if (project && project.tasks_checklist && typeof project.tasks_checklist === 'string') {
      // Count total tasks in plaintext (lines starting with - or *)
      const lines = project.tasks_checklist.split('\n');
      const taskLines = lines.filter(line => {
        const trimmedLine = line.trim();
        return trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ');
      });
      
      if (taskLines.length === 0) return 0;
      
      // For plaintext tasks, we have no completed state, so return 0
      return 0;
    }
    
    return 0;
  }, [taskChecklist, project]);
  
  // Render roadmap markdown - memoize to prevent unnecessary re-renders
  const renderRoadmap = useCallback(() => {
    if (!project) {
      return (
        <Alert severity="info" sx={{ my: 2 }}>
          Loading project information...
        </Alert>
      );
    }
    
    // Even if roadmap_text is empty, try to render it (don't show "No roadmap available")
    // unless it's actually null or empty after trimming
    const roadmapContent = project.roadmap_text || '';
    
    if (roadmapContent.trim() === '') {
      return (
        <Alert severity="info" sx={{ my: 2 }}>
          No roadmap content available for this project.
        </Alert>
      );
    }
    
    return (
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          my: 3,
          borderRadius: 2,
          maxHeight: '500px',
          overflowY: 'auto'
        }}
      >
        <ReactMarkdown>{roadmapContent}</ReactMarkdown>
      </Paper>
    );
  }, [project]); // Only re-render when project changes
  
  // Render task checklist component - memoize to prevent unnecessary re-renders
  const renderTaskChecklist = useCallback(() => {
    if (!taskChecklist) {
      return (
        <Alert severity="info" sx={{ my: 2 }}>
          Loading task checklist...
        </Alert>
      );
    }
    
    if (taskChecklist.length === 0) {
      // Try to render plain text tasks if the project has tasks_checklist but no parsed tasks
      if (project && project.tasks_checklist && typeof project.tasks_checklist === 'string' && project.tasks_checklist.trim() !== '') {
        return (
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              my: 3,
              borderRadius: 2
            }}
          >
            <Typography variant="h6" gutterBottom>
              Project Tasks (Plain Text)
            </Typography>
            <ReactMarkdown>
              {project.tasks_checklist}
            </ReactMarkdown>
          </Paper>
        );
      }
      
      return (
        <Alert severity="info" sx={{ my: 2 }}>
          No tasks found in the checklist. You can create tasks manually.
        </Alert>
      );
    }
    
    // Group tasks by phase
    const tasksByPhase = taskChecklist.reduce((groups, task) => {
      const phase = task.phase || 'Uncategorized Tasks';
      if (!groups[phase]) {
        groups[phase] = [];
      }
      groups[phase].push(task);
      return groups;
    }, {});
    
    // Sort phases by phase_order if available
    const sortedPhases = Object.entries(tasksByPhase).sort((a, b) => {
      const aOrder = a[1][0]?.phase_order ?? 999;
      const bOrder = b[1][0]?.phase_order ?? 999;
      return aOrder - bOrder;
    });
    
    return (
      <Box sx={{ mt: 3 }}>
        {checklistUpdated && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Task progress updated! Your changes are saved to the database.
          </Alert>
        )}
        
        {sortedPhases.map(([phaseName, phaseTasks], phaseIndex) => (
          <Paper 
            key={`phase-${phaseIndex}`}
            elevation={2} 
            sx={{ 
              mb: 3, 
              p: 2, 
              borderLeft: '4px solid', 
              borderColor: 'primary.main' 
            }}
          >
            <Typography variant="h6" gutterBottom>
              {phaseName}
            </Typography>
            
            <Divider sx={{ mb: 2 }} />
            
            {phaseTasks
              .sort((a, b) => (a.task_order || 0) - (b.task_order || 0))
              .map((task, taskIndex) => (
                <Card 
                  key={`task-${task.id || taskIndex}`}
                  sx={{ 
                    mb: 1, 
                    bgcolor: task.completed ? 'action.hover' : 'background.paper',
                    transition: 'all 0.3s ease',
                    border: '1px solid',
                    borderColor: task.completed ? 'success.light' : 'divider',
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={task.completed}
                          onChange={() => handleTaskToggle(task.id)}
                          icon={<UncheckedIcon />}
                          checkedIcon={<CheckCircleIcon color="success" />}
                        />
                      }
                      label={
                        <Typography 
                          variant="subtitle1"
                          sx={{
                            textDecoration: task.completed ? 'line-through' : 'none',
                            color: task.completed ? 'text.secondary' : 'text.primary',
                            fontWeight: task.completed ? 'normal' : 'medium',
                          }}
                        >
                          {task.title}
                        </Typography>
                      }
                    />
                    
                    {task.description && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          mt: 1, 
                          ml: 4,
                          opacity: task.completed ? 0.7 : 1
                        }}
                      >
                        {task.description}
                      </Typography>
                    )}
                    
                    {task.estimated_duration && (
                      <Chip
                        icon={<AssignmentIcon fontSize="small" />}
                        label={`Est: ${task.estimated_duration}`}
                        size="small"
                        sx={{ 
                          mt: 1,
                          ml: 4,
                          bgcolor: alpha(theme.palette.info.main, 0.1),
                          color: theme.palette.info.main,
                          borderRadius: 2
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
          </Paper>
        ))}
      </Box>
    );
  }, [taskChecklist, project, checklistUpdated, theme, handleTaskToggle]);

  // Force refresh function for manual reload
  const handleRefresh = () => {
    dataFetchedRef.current = false;
    setLoading(true);
    setWarning('');
    setError('');
    fetchProject();
  };

  // Handle report generation and download
  const handleDownloadReport = async () => {
    try {
      setLoading(true);
      setSuccess('');
      setError('');
      setWarning('');
      setSuccess('Generating your report... Please wait.');
      
      // Generate the report
      const response = await generateReport(projectId);
      
      // If we got a direct Blob response
      if (response instanceof Blob) {
        // Check if it's a PDF (by checking the MIME type)
        if (response.type === 'application/pdf') {
          // Create a download link
          const url = window.URL.createObjectURL(response);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `${project?.title || 'Project'}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          setSuccess('Report downloaded successfully!');
          // Clear success message after 5 seconds
          setTimeout(() => setSuccess(''), 5000);
        } else {
          // Got a blob but it's not a PDF - could be an error response as blob
          try {
            // Try to read as text to check for error messages
            const textReader = new FileReader();
            textReader.onload = () => {
              try {
                const data = JSON.parse(textReader.result);
                if (data.error) {
                  setError(`Error: ${data.error}`);
                } else {
                  setError('Received invalid report format. Please try again.');
                }
              } catch (parseError) {
                setError('Could not process the report. Please try again.');
              }
              setLoading(false);
            };
            textReader.onerror = () => {
              setError('Failed to read the report data. Please try again.');
              setLoading(false);
            };
            textReader.readAsText(response);
          } catch (readError) {
            setError('Failed to process the report. Please try again.');
            setLoading(false);
          }
        }
      } 
      // If the API returns a URL
      else if (response.data && response.data.report_url) {
        window.open(response.data.report_url, '_blank');
        setSuccess('Report opened in a new tab!');
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(''), 5000);
      }
      // Other successful response
      else {
        setSuccess('Report generated successfully! Check your downloads folder.');
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      if (error.response && error.response.status === 500) {
        setError(`Server error: ${error.response.data?.error || 'Failed to generate report due to a server issue. Please try again later.'}`);
      } else if (error.message) {
        setError(`Failed to generate report: ${error.message}`);
      } else {
        setError('Failed to generate report. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Render loading spinner
  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Render error message
  if (error) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 5 }}>
          {error}
        </Alert>
        <Button 
          component={Link} 
          to="/dashboard" 
          variant="outlined" 
          sx={{ mt: 2 }}
        >
          Return to Dashboard
        </Button>
      </Container>
    );
  }

  // Main render
  return (
    <Container maxWidth="lg">
      <Box mb={4}>
        <Paper 
          elevation={0}
          sx={{ 
            p: 3, 
            borderRadius: 2,
            background: theme => theme.palette.mode === 'dark' 
              ? alpha(theme.palette.primary.dark, 0.2)
              : alpha(theme.palette.primary.light, 0.1),
            mb: 3
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap">
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {project?.title || 'Project Tasks'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {project?.description || 'Loading project details...'}
              </Typography>
            </Box>
            
            <ButtonGroup>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                sx={{ mt: { xs: 2, md: 0 } }}
              >
                Refresh Data
              </Button>
              <Tooltip title="Download Report">
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<PdfIcon />}
                  onClick={handleDownloadReport}
                  sx={{ 
                    mt: { xs: 2, md: 0 },
                    bgcolor: theme => theme.palette.mode === 'dark' ? 'error.dark' : 'error.main',
                    '&:hover': {
                      bgcolor: theme => theme.palette.mode === 'dark' ? 'error.main' : 'error.dark',
                    } 
                  }}
                >
                  Download Report
                </Button>
              </Tooltip>
            </ButtonGroup>
          </Box>
          
          {warning && (
            <Alert 
              severity="warning" 
              sx={{ mt: 2 }}
              onClose={() => setWarning('')}
            >
              {warning}
            </Alert>
          )}
          
          {success && (
            <Alert 
              severity="success" 
              sx={{ mt: 2 }}
              onClose={() => setSuccess('')}
            >
              {success}
            </Alert>
          )}
        </Paper>
      </Box>
      
      {error ? (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      ) : loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box mb={4}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Project Progress
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Track your project completion below
            </Typography>
            
            <LinearProgress 
              variant="determinate" 
              value={calculateProgress()} 
              sx={{ 
                height: 10, 
                borderRadius: 5,
                mt: 2,
                mb: 1,
                bgcolor: theme => 
                  theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.grey[700], 0.5) 
                    : alpha(theme.palette.grey[300], 0.5)
              }} 
            />
            
            <Typography variant="body2" color="text.secondary" align="right">
              {calculateProgress()}% Complete
            </Typography>
          </Box>
          
          <Box mb={5}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Project Roadmap
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Overview of your project plan and milestones
            </Typography>
            
            {renderRoadmap()}
          </Box>
          
          <Box mb={4}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Task Checklist
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Track your progress by completing tasks
            </Typography>
            
            {renderTaskChecklist()}
          </Box>
        </>
      )}
    </Container>
  );
};

export default Tasks; 