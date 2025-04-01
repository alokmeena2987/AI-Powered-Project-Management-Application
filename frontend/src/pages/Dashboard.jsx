import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Paper,
  Stack,
  LinearProgress,
  IconButton,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import {
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Schedule as ScheduleIcon,
  ArrowForward as ArrowForwardIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { getOrganizations, fetchProjects } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

// Helper functions for consistent task progress calculation
// These are the same methods used in the Tasks page
const isTaskCompleted = (task) => {
  return task.status === 'completed' || task.completed === true;
};

// Cache for organization data to prevent refetching
const organizationCache = new Map();

// Helper function to get organization name
const getOrganizationName = async (orgId) => {
  // Return from cache if available
  if (organizationCache.has(orgId)) {
    return organizationCache.get(orgId);
  }
  
  try {
    const { getOrganization } = await import('../services/api');
    const response = await getOrganization(orgId);
    const orgName = response.data?.name || `Organization ${orgId}`;
    
    // Cache the result
    organizationCache.set(orgId, orgName);
    return orgName;
  } catch (error) {
    console.error(`Error fetching organization ${orgId}:`, error);
    return `Organization ${orgId}`;
  }
};

const getTasksFromLocalStorage = (projectId) => {
  try {
    const savedChecklist = localStorage.getItem(`checklist_${projectId}`);
    if (savedChecklist) {
      return JSON.parse(savedChecklist);
    }
  } catch (e) {
    console.error(`Error reading project ${projectId} tasks from localStorage:`, e);
  }
  return null;
};

// Parse tasks from tasks_checklist if it's a JSON string
const parseTasksFromChecklist = (tasks_checklist) => {
  if (!tasks_checklist || typeof tasks_checklist !== 'string') {
    return null;
  }
  
  try {
    const parsed = JSON.parse(tasks_checklist);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // If JSON parsing fails, it's probably not a JSON string
  }
  return null;
};

const calculateProjectProgress = (project) => {
  if (!project) return 0;
  
  // First, check for tasks from localStorage (most up-to-date)
  const localTasks = getTasksFromLocalStorage(project.id);
  
  if (localTasks && localTasks.length > 0) {
    // Use localStorage tasks (same as in Tasks page)
    const completedTasks = localTasks.filter(task => task.completed).length;
    return Math.round((completedTasks / localTasks.length) * 100);
  }
  
  // Next check if tasks_checklist contains a JSON array of tasks (database-saved tasks)
  const tasksFromChecklist = parseTasksFromChecklist(project.tasks_checklist);
  if (tasksFromChecklist && tasksFromChecklist.length > 0) {
    const completedTasks = tasksFromChecklist.filter(task => task.completed).length;
    return Math.round((completedTasks / tasksFromChecklist.length) * 100);
  }
  
  // Next check API tasks
  if (project.tasks && project.tasks.length > 0) {
    const completedTasks = project.tasks.filter(isTaskCompleted).length;
    return Math.round((completedTasks / project.tasks.length) * 100);
  }
  
  // Finally check task checklist for text-based tasks
  if (project.tasks_checklist && typeof project.tasks_checklist === 'string') {
    // Count tasks (same logic as in Tasks page)
    const lines = project.tasks_checklist.split('\n');
    const taskLines = lines.filter(line => {
      const trimmedLine = line.trim();
      return trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ');
    });
    
    if (taskLines.length === 0) return 0;
    
    // For plaintext tasks, local storage is the only way to know completion
    // so if we don't have that data, return 0
    return 0;
  }
  
  return 0;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingProjects: 0,
    upcomingDeadlines: []
  });
  const theme = useTheme();

  // Fetch all organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await getOrganizations();
      return response.data;
    } catch (err) {
      setError('Failed to fetch organizations');
      return [];
    }
  }, []);

  // Fetch all projects across orgs with full data including tasks
  const fetchAllProjects = useCallback(async (orgs) => {
    if (!orgs || orgs.length === 0) return [];

    try {
      const projectPromises = orgs.map(org => fetchProjects(org.id));
      const orgProjectsArray = await Promise.all(projectPromises);
      
      // Flatten array of arrays into a single array of all projects
      const allProjects = orgProjectsArray.flat();
      
      // For each project, check if it has local storage tasks that should override API data
      allProjects.forEach(project => {
        const localTasks = getTasksFromLocalStorage(project.id);
        if (localTasks && localTasks.length > 0) {
          // Keep original tasks but note we'll use localStorage for progress
          project.hasLocalTasks = true;
        }
        
        // Calculate project progress (removing unused variable)
        calculateProjectProgress(project);
      });
      
      return allProjects;
    } catch (error) {
      console.error("Error fetching all projects:", error);
      return [];
    }
  }, []);

  // Calculate statistics based on fetched data using consistent progress calculation
  const calculateStats = useCallback((orgs, allProjects) => {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    // Find upcoming deadlines (within the next 7 days)
    const upcomingDeadlines = allProjects
      .filter(project => {
        if (!project.deadline) return false;
        const deadlineDate = new Date(project.deadline);
        return deadlineDate >= now && deadlineDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    // Calculate project status statistics based on tasks completion
    // using the same progress logic as in Tasks page
    const completedProjects = allProjects.filter(project => {
      const progress = calculateProjectProgress(project);
      return progress === 100;
    }).length;

    // Consider projects active if they have tasks and aren't fully completed
    const activeProjects = allProjects.filter(project => {
      const progress = calculateProjectProgress(project);
      const hasTasks = (project.tasks && project.tasks.length > 0) || 
                      getTasksFromLocalStorage(project.id)?.length > 0;
      return hasTasks && progress > 0 && progress < 100;
    }).length;

    const pendingProjects = allProjects.length - activeProjects - completedProjects;

    setStats({
      totalOrgs: orgs.length,
      totalProjects: allProjects.length,
      activeProjects,
      completedProjects,
      pendingProjects,
      upcomingDeadlines: upcomingDeadlines.slice(0, 3) // Limit to top 3
    });
  }, []);

  // Combined data fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const orgs = await fetchOrganizations();
      const allProjects = await fetchAllProjects(orgs);
      calculateStats(orgs, allProjects);
      setProjects(allProjects);
      setLoading(false);
    };

    fetchData();
  }, [fetchOrganizations, fetchAllProjects, calculateStats]);

  // Use the consistent project progress calculation function 
  const getProjectProgress = (project) => {
    return calculateProjectProgress(project);
  };

  // Add validation for project navigation
  const handleViewProject = (projectId, organizationId) => {
    // Validate project ID before navigation
    if (!projectId || projectId === 'undefined') {
      setError('Invalid project ID. Cannot view project details.');
      return;
    }
    
    // Ensure projectId is a number or string that can be converted to a number
    if (isNaN(Number(projectId))) {
      setError('Invalid project ID format. Cannot view project details.');
      return;
    }
    
    // If organization ID is available, use it in the path
    if (organizationId && !isNaN(Number(organizationId))) {
      navigate(`/projects/${projectId}/tasks`);
    } else {
      // Otherwise navigate directly to the project
      navigate(`/projects/${projectId}/tasks`);
    }
  };

  // Add validation for viewing all projects
  const handleViewAllProjects = () => {
    // If no projects exist or organization ID can't be determined, go to organizations page
    if (!projects.length || !projects[0].organization_id) {
      navigate('/organizations');
      return;
    }
    
    // Navigate to projects of the first organization
    const firstOrgId = projects[0].organization_id;
    
    if (!firstOrgId || isNaN(Number(firstOrgId))) {
      navigate('/organizations');
    } else {
      navigate(`/organizations/${firstOrgId}/projects`);
    }
  };

  // Organization Chip component to properly display organization names
  const OrganizationChip = ({ organizationId }) => {
    const [orgName, setOrgName] = useState(`Org ${organizationId}`);
    const [isLoading, setIsLoading] = useState(true);
    const theme = useTheme();
    
    useEffect(() => {
      let isMounted = true;
      
      const fetchOrgName = async () => {
        try {
          const name = await getOrganizationName(organizationId);
          if (isMounted) {
            setOrgName(name);
            setIsLoading(false);
          }
        } catch (error) {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };
      
      if (organizationId) {
        fetchOrgName();
      } else {
        setOrgName('Unknown Org');
        setIsLoading(false);
      }
      
      return () => {
        isMounted = false;
      };
    }, [organizationId]);
    
    return (
      <Chip 
        icon={<BusinessIcon sx={{ fontSize: '0.8rem' }} />} 
        label={isLoading ? `Loading...` : orgName}
        size="small"
        sx={{ 
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: theme.palette.primary.main,
          borderRadius: 1,
          height: 24,
          minWidth: isLoading ? 100 : 'auto',
          '& .MuiChip-label': {
            display: 'block',
            maxWidth: 150,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }
        }}
      />
    );
  };

  return (
    <Container maxWidth="lg">
      {/* Welcome Header */}
      <Box 
        component={motion.div}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        sx={{ mb: 4 }}
      >
        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 2, md: 4 }, 
            borderRadius: 4, 
            background: theme => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Decorative elements */}
          <Box 
            sx={{ 
              position: 'absolute', 
              top: -20, 
              right: -20, 
              width: 120, 
              height: 120, 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.1)',
              zIndex: 0
            }} 
          />
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: -30, 
              left: '40%', 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.1)',
              zIndex: 0
            }} 
          />
          
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography 
              variant="h4" 
              fontWeight="bold" 
              sx={{ 
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                mb: 0.5,
                fontSize: { xs: '1.5rem', sm: '2rem' }
              }}
            >
              Welcome back, {user?.full_name || 'User'}
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                opacity: 0.9,
                maxWidth: { sm: '80%', md: '60%' },
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              Here's an overview of your projects and activities. Track your progress and manage your tasks efficiently.
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Main Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>
      ) : (
        <Grid container spacing={3}>
          {/* Statistics Cards */}
          <Grid item xs={12}>
            <Typography 
              variant="h5" 
              component={motion.h2}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              sx={{ 
                mb: 2, 
                fontWeight: 'medium',
                color: theme.palette.text.primary
              }}
            >
              Project Statistics
            </Typography>
            <Grid container spacing={2}>
              {/* Total Projects */}
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  component={motion.div}
                  whileHover={{ y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  sx={{ 
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    height: '100%'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography color="text.secondary" variant="subtitle2">Total Projects</Typography>
                      <AssignmentIcon sx={{ color: theme.palette.primary.main }} />
                    </Box>
                    <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
                      {stats.totalProjects}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Across {stats.totalOrgs} organizations
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Active Projects */}
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  component={motion.div}
                  whileHover={{ y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  sx={{ 
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    height: '100%' 
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography color="text.secondary" variant="subtitle2">Active Projects</Typography>
                      <ScheduleIcon sx={{ color: theme.palette.warning.main }} />
                    </Box>
                    <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
                      {stats.activeProjects}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((stats.activeProjects / stats.totalProjects) * 100) || 0}% of total projects
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Completed Projects */}
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  component={motion.div}
                  whileHover={{ y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  sx={{ 
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    height: '100%'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography color="text.secondary" variant="subtitle2">Completed</Typography>
                      <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
                    </Box>
                    <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
                      {stats.completedProjects}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((stats.completedProjects / stats.totalProjects) * 100) || 0}% completion rate
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Pending Projects */}
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  component={motion.div}
                  whileHover={{ y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  sx={{ 
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    height: '100%'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography color="text.secondary" variant="subtitle2">Pending</Typography>
                      <PendingIcon sx={{ color: theme.palette.error.main }} />
                    </Box>
                    <Typography variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
                      {stats.pendingProjects}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((stats.pendingProjects / stats.totalProjects) * 100) || 0}% require attention
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Recent Projects */}
          <Grid item xs={12} md={8}>
            <Typography 
              variant="h5" 
              component={motion.h2}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              sx={{ 
                mb: 2, 
                fontWeight: 'medium',
                color: theme.palette.text.primary
              }}
            >
              Recent Projects
            </Typography>
            
            <Box 
              component={motion.div}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              {projects.length === 0 ? (
                <Card sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="body1">No projects found</Typography>
                </Card>
              ) : (
                projects.slice(0, 4).map((project, index) => (
                  <Card 
                    key={project.id} 
                    sx={{ 
                      mb: 2, 
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      '&:hover': {
                        boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                        transform: 'translateY(-2px)'
                      }
                    }}
                    onClick={() => handleViewProject(project.id, project.organization_id)}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={7}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                              {project.title}
                            </Typography>
                            {getProjectProgress(project) === 100 && (
                              <Chip 
                                size="small" 
                                label="Completed" 
                                color="success" 
                                sx={{ ml: 2, height: 24 }} 
                              />
                            )}
                            {getProjectProgress(project) > 0 && getProjectProgress(project) < 100 && (
                              <Chip 
                                size="small" 
                                label="In Progress" 
                                color="warning" 
                                sx={{ ml: 2, height: 24 }} 
                              />
                            )}
                            {getProjectProgress(project) === 0 && project.tasks && project.tasks.length > 0 && (
                              <Chip 
                                size="small" 
                                label="Pending" 
                                color="error" 
                                sx={{ ml: 2, height: 24 }} 
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {project.description?.substring(0, 100) || 'No description provided'}
                            {project.description?.length > 100 ? '...' : ''}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <OrganizationChip organizationId={project.organization_id} />
                            {project.deadline && (
                              <Chip 
                                icon={<ScheduleIcon sx={{ fontSize: '0.8rem' }} />} 
                                label={new Date(project.deadline).toLocaleDateString()} 
                                size="small"
                                sx={{ 
                                  bgcolor: alpha(theme.palette.info.main, 0.1),
                                  color: theme.palette.info.main,
                                  borderRadius: 1,
                                  height: 24
                                }}
                              />
                            )}
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">Progress</Typography>
                              <Typography variant="body2" fontWeight="medium">
                                {`${getProjectProgress(project)}%`}
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={getProjectProgress(project)} 
                              sx={{ 
                                height: 8,
                                borderRadius: 4,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                },
                                mb: 1
                              }}
                            />
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Tooltip title="View Project">
                            <IconButton size="small" color="primary" sx={{ mt: { xs: 1, sm: 0 } }}>
                              <ArrowForwardIcon />
                            </IconButton>
                          </Tooltip>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))
              )}
              {projects.length > 0 && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Button 
                    variant="outlined" 
                    color="primary"
                    onClick={handleViewAllProjects}
                    endIcon={<ArrowForwardIcon />}
                    sx={{ borderRadius: 2 }}
                  >
                    View All Projects
                  </Button>
                </Box>
              )}
            </Box>
          </Grid>
          
          {/* Upcoming Deadlines */}
          <Grid item xs={12} md={4}>
            <Typography 
              variant="h5" 
              component={motion.h2}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              sx={{ 
                mb: 2, 
                fontWeight: 'medium',
                color: theme.palette.text.primary
              }}
            >
              Upcoming Deadlines
            </Typography>
            
            <Card 
              component={motion.div}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              sx={{ 
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                height: '100%'
              }}
            >
              <CardContent sx={{ p: 3 }}>
                {stats.upcomingDeadlines.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="textSecondary">No upcoming deadlines</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {stats.upcomingDeadlines.map((project) => (
                      <Paper 
                        key={project.id}
                        elevation={0}
                        sx={{ 
                          p: 2, 
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.warning.light, 0.1),
                          border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                              {project.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              Due {new Date(project.deadline).toLocaleDateString()}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                label={`${getDaysUntil(project.deadline)} days left`}
                                size="small"
                                color="warning"
                                sx={{ height: 24 }}
                              />
                              <OrganizationChip organizationId={project.organization_id} />
                            </Box>
                          </Box>
                          <Tooltip title="View Project">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleViewProject(project.id, project.organization_id)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

// Utility function to calculate days until deadline
const getDaysUntil = (dateString) => {
  const now = new Date();
  const deadline = new Date(dateString);
  const diffTime = Math.abs(deadline - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
};

export default Dashboard; 