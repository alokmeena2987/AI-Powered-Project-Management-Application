import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
  alpha,
  Divider,
  Paper,
  Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Assignment as AssignmentIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
// We're not using useAuth but it's traditional to keep context imports
// eslint-disable-next-line no-unused-vars
import { useAuth } from '../context/AuthContext';
import { getOrganization, fetchProjects as fetchProjectsApi, deleteProject } from '../services/api';
import { format } from 'date-fns';
import { useProjectContext } from '../context/ProjectContext';

const Projects = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const theme = useTheme(); // Used in styled components
  const { setOrganizationId } = useProjectContext();
  
  const [organization, setOrganization] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [activeProject, setActiveProject] = useState(null); // Used for context in menu operations
  const [invalidOrgId, setInvalidOrgId] = useState(false);

  // Define fetchOrganization and fetchProjects BEFORE using them in useRef
  const fetchOrganization = useCallback(async () => {
    // Check if orgId is valid before making the API call
    if (!orgId || orgId === 'undefined') {
      console.error('Invalid organization ID:', orgId);
      // Don't update invalidOrgId inside this callback to prevent re-render loops
      setOrganization(null);
      setError('Missing or invalid organization ID. Please select an organization from the dashboard.');
      setLoading(false);
      return false; // Return false to indicate invalid ID
    }
    
    try {
      // Keep current organization data during loading to avoid flickering
      // Only reset if we're loading a different organization
      if (!organization || organization.id !== Number(orgId)) {
        // We'll use the skeleton loading state instead of a placeholder name
        setOrganization({
          id: Number(orgId),
          name: 'Loading...',
          description: 'Loading organization details...'
        });
      }
      
      const response = await getOrganization(orgId);
      setOrganization(response.data);
      // Use a functional update to prevent dependency on previous state
      setError(prev => prev && !prev.includes('organization') ? '' : prev);
      return true; // Return true to indicate success
    } catch (err) {
      console.error('Error fetching organization:', err);
      
      // Only create a fallback organization if we don't already have data
      // This prevents replacing a valid cached organization with error data
      if (!organization || organization.id !== Number(orgId) || organization.name === 'Loading...') {
        setOrganization({
          id: Number(orgId) || 1,
          name: `Organization ${orgId}`, // More neutral naming
          description: 'Information temporarily unavailable'
        });
      }
      
      // Set user-friendly error messages based on error type and status code
      if (err.response) {
        const status = err.response.status;
        if (status === 404) {
          setError(`Organization with ID ${orgId} not found or you don't have access to it. Please select a different organization.`);
        } else if (status === 401 || status === 403) {
          setError('You don\'t have permission to view this organization. Please log in again or contact an administrator.');
        } else if (status === 405) {
          setError('The server doesn\'t support this operation. This is likely a backend API configuration issue. Please contact support.');
        } else {
          setError(`Server returned error ${status} while loading organization details. Using limited information.`);
        }
      } else if (err.message && err.message.includes('Network Error')) {
        setError('Network error while loading organization details. Backend server may be unavailable. Using cached information.');
      } else if (err.message && err.message.includes('CORS')) {
        setError('CORS policy error. API server may have incorrect CORS configuration. Contact support.');
      } else {
        setError('Unable to load complete organization details. Using limited information.');
      }
      return false; // Return false to indicate an error
    }
  }, [orgId, organization]);

  const fetchProjects = useCallback(async () => {
    // Skip API call if orgId is invalid - don't rely on state
    if (!orgId || orgId === 'undefined') {
      setLoading(false);
      setProjects([]);
      return;
    }
    
    try {
      const projectsData = await fetchProjectsApi(orgId);
      setProjects(projectsData || []);
      // Clear project-related errors if successful
      setError(''); // Simplify error clearing to avoid dependency issues
    } catch (err) {
      console.error('Error fetching projects:', err);
      
      // Create user-friendly error message with specific guidance
      let errorMessage = 'Unable to load projects. ';
      
      if (err.response?.status === 404) {
        errorMessage += 'The organization may not exist.';
      } else if (err.response?.status === 403) {
        errorMessage += 'You may not have permission to view these projects.';
      } else if (!navigator.onLine) {
        errorMessage += 'Please check your internet connection.';
      } else if (err.message && err.message.includes('Network Error')) {
        errorMessage = 'Network error while loading projects. Backend server may be unavailable. Please check your connection.';
      } else if (err.message && err.message.includes('CORS')) {
        errorMessage = 'CORS policy error. API server may have incorrect CORS configuration. Contact your administrator.';
      } else {
        errorMessage += 'Please try again later.';
      }
      
      setError(errorMessage);
      // Always ensure projects is an array to prevent UI errors
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]); // Only depend on orgId, nothing else

  // Store the fetch functions in refs to maintain their identity across renders
  const fetchFunctionsRef = useRef({
    fetchOrganization,
    fetchProjects
  });
  
  // Update the refs when the functions change
  useEffect(() => {
    fetchFunctionsRef.current = {
      fetchOrganization,
      fetchProjects
    };
  }, [fetchOrganization, fetchProjects]);

  // Set organization ID in context when it changes
  useEffect(() => {
    if (orgId && orgId !== 'undefined' && String(organization?.id) !== String(orgId)) {
      setOrganizationId(orgId);
    } else {
      // Remove console.log(`Not updating organization ID in context: current=${organization?.id}, requested=${orgId}`);
    }
  }, [orgId, setOrganizationId, organization?.id]);

  useEffect(() => {
    // Return early if we don't have a valid orgId to prevent unnecessary re-renders
    if (!orgId || orgId === 'undefined') {
      console.error('Invalid organization ID in useEffect:', orgId);
      setInvalidOrgId(true);
      setLoading(false);
      return;
    }
    
    // Reset invalidOrgId at the start of the effect to prevent stale state
    setInvalidOrgId(false);
    
    let isMounted = true; // Track if component is mounted
    let isDataLoading = false; // Track if data loading is in progress
    
    const initPage = async () => {
      // Set loading state only if we're not already loading
      if (isMounted && !isDataLoading) {
        isDataLoading = true;
        setLoading(true);
      } else {
        // Skip if we're already loading data
        return;
      }
      
      try {
        // Use the current functions from the ref
        const { fetchOrganization, fetchProjects } = fetchFunctionsRef.current;
        
        // First try to get the organization info
        const orgSuccess = await fetchOrganization();
        
        // Only continue if component is still mounted and organization ID is valid
        if (isMounted && orgSuccess) {
          // Then get its projects
          await fetchProjects();
        } else if (isMounted) {
          // Update invalidOrgId based on fetch result
          setInvalidOrgId(!orgSuccess);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error during page initialization:', error);
          // Set a generic error message if none was set by the fetch functions
          setError(prev => prev || 'An unexpected error occurred while loading the page. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          isDataLoading = false;
        }
      }
    };
    
    // Start the data loading process
    initPage();
    
    // Cleanup function to prevent state updates after unmounting
    return () => {
      isMounted = false;
    };
  }, [orgId]); // Only depend on orgId - not the fetch functions that could cause re-renders

  const handleMenuOpen = (event, projectId) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedProjectId(projectId);
    setActiveProject(projects.find(p => p.id === projectId));
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedProjectId(null);
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setConfirmDelete(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await deleteProject(projectToDelete.id);
      
      // Remove the project from state
      setProjects(projects.filter(project => project.id !== projectToDelete.id));
      
      // Show success message
      const successMessage = response?.data?.message || `Project "${projectToDelete.title}" was deleted successfully`;
      setSuccess(successMessage);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Error deleting project:', err);
      
      let errorMessage = 'Failed to delete project. ';
      
      if (err.response) {
        const status = err.response.status;
        
        if (status === 404) {
          errorMessage += 'The project may have already been deleted.';
          // Remove from local state anyway
          setProjects(projects.filter(project => project.id !== projectToDelete.id));
        } else if (status === 403) {
          errorMessage += 'You may not have permission to delete this project.';
        } else if (status === 405) {
          errorMessage += 'API method not supported. The backend API needs to be updated.';
          
          // Handle delete case for development environment
          if (process.env.NODE_ENV !== 'production') {
            setProjects(projects.filter(project => project.id !== projectToDelete.id));
            setSuccess(`Project "${projectToDelete.title}" was removed from the UI (but not deleted on server)`);
          }
        } else {
          errorMessage += 'Please try again later.';
        }
      } else if (!navigator.onLine) {
        errorMessage += 'Please check your internet connection.';
      } else if (err.message && err.message.includes('Network Error')) {
        errorMessage += 'Network error. The server may be unavailable.';
      } else if (err.message && err.message.includes('CORS')) {
        errorMessage += 'CORS policy error. API server may have incorrect configuration.';
      } else {
        errorMessage += 'Please try again later.';
      }
      
      setError(errorMessage);
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(false);
      setProjectToDelete(null);
    }
  };

  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}/tasks`);
  };

  // Helper function to go back to organizations
  const handleBackToOrganizations = () => {
    navigate('/organizations');
  };

  // Add new function to navigate to the project creation page
  const handleCreateProject = () => {
    navigate(`/organizations/${orgId}/create-project`);
  };

  return (
    <Container maxWidth="lg">
      <Box mb={2}>
        <Box
          sx={{
            mb: 4,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 2
          }}
        >
          <Box>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700,
                background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              Projects
            </Typography>
            {organization ? (
              <Typography variant="body1" color="text.secondary">
                {organization?.name === 'Loading...' ? (
                  <Skeleton width={200} animation="wave" />
                ) : (
                  `Manage projects for ${organization.name}`
                )}
              </Typography>
            ) : (
              <Skeleton width={200} animation="wave" />
            )}
          </Box>

          {!invalidOrgId && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateProject}
              sx={{ 
                borderRadius: 2,
                py: 1.2,
                px: 3,
                fontWeight: 'medium',
                boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`
              }}
            >
              New Project
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3, 
            borderRadius: 2,
            boxShadow: theme => `0 2px 8px ${alpha(theme.palette.error.main, 0.15)}`
          }}
          onClose={() => setError('')}
          action={
            invalidOrgId ? (
              <Button color="inherit" size="small" onClick={handleBackToOrganizations}>
                Go to Organizations
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 3, 
            borderRadius: 2,
            boxShadow: theme => `0 2px 8px ${alpha(theme.palette.success.main, 0.15)}`
          }}
          onClose={() => setSuccess('')}
        >
          {success}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map(index => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card sx={{ 
                height: '100%', 
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                <Box sx={{ height: 8, width: '100%', bgcolor: 'grey.300' }} />
                <CardContent sx={{ p: 3 }}>
                  <Skeleton variant="rectangular" width="70%" height={28} sx={{ mb: 2, borderRadius: 1 }} />
                  <Skeleton variant="rectangular" width="100%" height={16} sx={{ mb: 1, borderRadius: 1 }} />
                  <Skeleton variant="rectangular" width="90%" height={16} sx={{ mb: 1, borderRadius: 1 }} />
                  <Skeleton variant="rectangular" width="80%" height={16} sx={{ mb: 2, borderRadius: 1 }} />
                  <Divider sx={{ my: 1.5 }} />
                  <Skeleton variant="rectangular" width="60%" height={16} sx={{ borderRadius: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : invalidOrgId ? (
        <Paper
          elevation={0}
          sx={{ 
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            backgroundColor: theme => alpha(theme.palette.background.paper, 0.7),
            backdropFilter: 'blur(8px)',
            border: theme => `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
          }}
        >
          <ErrorIcon 
            color="error" 
            sx={{ 
              fontSize: 60,
              opacity: 0.7,
              mb: 2
            }} 
          />
          <Typography variant="h5" gutterBottom fontWeight="medium">
            Invalid Organization
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            The organization ID is missing or invalid. Please select an organization from the organizations page.
          </Typography>
          <Button
            variant="contained"
            onClick={handleBackToOrganizations}
            sx={{ 
              borderRadius: 2,
              py: 1.2,
              px: 3,
              fontWeight: 'medium'
            }}
          >
            Go to Organizations
          </Button>
        </Paper>
      ) : projects.length > 0 ? (
        <Grid container spacing={3}>
          {projects.map(project => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: theme => `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
                onClick={() => handleProjectClick(project.id)}
              >
                <Box 
                  sx={{ 
                    height: 8, 
                    width: '100%',
                    bgcolor: 'primary.main'
                  }}
                />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography 
                      variant="h6" 
                      component="h2"
                      fontWeight="bold"
                      sx={{ 
                        mb: 1,
                        color: 'primary.main'
                      }}
                    >
                      {project.title}
                    </Typography>
                    <IconButton 
                      size="small" 
                      onClick={(e) => handleMenuOpen(e, project.id)}
                      sx={{ mt: -1, mr: -1 }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    paragraph
                    sx={{ 
                      mb: 'auto',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {project.description || 'No description provided'}
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 'auto' }}>
                    <Typography variant="body2" color="text.secondary">
                      {project.deadline 
                        ? `Due: ${format(new Date(project.deadline), 'MMM d, yyyy')}` 
                        : 'No deadline set'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper
          elevation={0}
          sx={{ 
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            backgroundColor: theme => alpha(theme.palette.background.paper, 0.7),
            backdropFilter: 'blur(8px)',
            border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <FolderIcon 
            color="primary" 
            sx={{ 
              fontSize: 60,
              opacity: 0.7,
              mb: 2
            }} 
          />
          <Typography variant="h5" gutterBottom fontWeight="medium">
            No Projects Available
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            {invalidOrgId 
              ? 'Please select a valid organization first.'
              : 'Get started by creating your first project for this organization.'
            }
          </Typography>
          {!invalidOrgId && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateProject}
              sx={{ 
                borderRadius: 2,
                py: 1.2,
                px: 3,
                fontWeight: 'medium'
              }}
            >
              Create Project
            </Button>
          )}
        </Paper>
      )}

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.14))',
            mt: 1.5,
            borderRadius: 2,
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem 
          onClick={() => {
            handleMenuClose();
            const project = projects.find(p => p.id === selectedProjectId);
            if (project) {
              navigate(`/projects/${project.id}/tasks`);
            }
          }}
          sx={{ py: 1.5, px: 2 }}
        >
          <AssignmentIcon fontSize="small" sx={{ mr: 1.5 }} /> View Tasks
        </MenuItem>
        <MenuItem 
          onClick={() => {
            const project = projects.find(p => p.id === selectedProjectId);
            if (project) {
              handleDeleteClick(project);
            }
          }}
          sx={{ py: 1.5, px: 2, color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} /> Delete Project
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{projectToDelete?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={() => setConfirmDelete(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
            sx={{ 
              borderRadius: 2,
              px: 3
            }}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Projects; 