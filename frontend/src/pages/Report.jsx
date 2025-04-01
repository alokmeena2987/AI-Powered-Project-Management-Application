import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Button,
  CircularProgress,
  Alert,
  alpha,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  Menu,
  MenuItem
} from '@mui/material';
import {
  AssessmentOutlined as AssessmentIcon,
  GetApp as DownloadIcon,
  Share as ShareIcon,
  MoreVert as MoreVertIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { 
  PieChart, Pie, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';
import { getProject, generateReport, getTasks } from '../services/api';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe'];
const STATUS_COLORS = {
  pending: '#ff9800',
  'in-progress': '#3f51b5',
  completed: '#4caf50'
};

const PRIORITY_COLORS = {
  low: '#8bc34a',
  medium: '#ff9800',
  high: '#f44336'
};

// Helper function to generate a text-based report from tasks data
const generateTasksReport = (tasks, project) => {
  if (!tasks || tasks.length === 0 || !project) {
    return "No tasks or project data available for report generation.";
  }

  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  const highPriorityTasks = tasks.filter(task => task.priority === 'high').length;
  const completionRate = Math.round((completedTasks / tasks.length) * 100);

  // Generate a text-based report
  return `
PROJECT REPORT
==============
Project: ${project.title || project.name || 'Untitled Project'}
Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}

PROJECT SUMMARY
--------------
Description: ${project.description || 'No description provided'}
Total Tasks: ${tasks.length}
Completed Tasks: ${completedTasks} (${completionRate}%)
In Progress Tasks: ${inProgressTasks}
Pending Tasks: ${pendingTasks}
High Priority Tasks: ${highPriorityTasks}

TASK BREAKDOWN
-------------
By Status:
- Completed: ${completedTasks} (${completionRate}%)
- In Progress: ${inProgressTasks} (${Math.round((inProgressTasks / tasks.length) * 100)}%)
- Pending: ${pendingTasks} (${Math.round((pendingTasks / tasks.length) * 100)}%)

By Priority:
- High: ${highPriorityTasks} (${Math.round((highPriorityTasks / tasks.length) * 100)}%)
- Medium: ${tasks.filter(task => task.priority === 'medium').length} (${Math.round((tasks.filter(task => task.priority === 'medium').length / tasks.length) * 100)}%)
- Low: ${tasks.filter(task => task.priority === 'low').length} (${Math.round((tasks.filter(task => task.priority === 'low').length / tasks.length) * 100)}%)

PROJECT HEALTH
-------------
Overall Health: ${
  completionRate > 70 ? 'Good' :
  completionRate > 30 ? 'Average' :
  'Needs Attention'
}

RECOMMENDATIONS
--------------
${highPriorityTasks > 0 && tasks.filter(task => task.priority === 'high' && task.status !== 'completed').length > 0 ?
  '- Focus on completing high priority tasks to maintain project momentum.\n' : ''}
${inProgressTasks > completedTasks ?
  '- Too many tasks are in progress simultaneously. Consider completing current tasks before starting new ones.\n' : ''}
${pendingTasks > tasks.length * 0.7 ?
  '- A large percentage of tasks are still pending. Review project timeline and resources.\n' : ''}
${completedTasks === tasks.length ?
  '- All tasks are completed. Consider moving to the next phase or closing the project.\n' : ''}

TASK DETAILS
-----------
${tasks.map((task, index) => 
  `${index + 1}. ${task.title || 'Untitled Task'} [${task.status}] [${task.priority}]
     ${task.description || 'No description'}`
).join('\n\n')}
`;
};

const Report = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [reportContent, setReportContent] = useState(null);

  const fetchProject = useCallback(async () => {
    try {
      const response = await getProject(projectId);
      setProject(response.data);
    } catch (err) {
      setError('Failed to fetch project details');
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await getTasks(projectId);
      setTasks(response.data);
    } catch (err) {
      setError('Failed to fetch project tasks');
    }
  }, [projectId]);

  const fetchReport = useCallback(async () => {
    try {
      const response = await generateReport(projectId);
      setReportContent(response.data);
    } catch (err) {
      // If no report was saved yet, generate one from task data
      if (!reportContent) {
        const tasksReport = generateTasksReport(tasks, project);
        setReportContent(tasksReport);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, tasks, project, reportContent]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchProject();
      await fetchTasks();
      await fetchReport();
    };
    
    loadData();
  }, [fetchProject, fetchTasks, fetchReport]);

  const generateStatusData = () => {
    const statusCount = {
      pending: 0,
      'in-progress': 0,
      completed: 0
    };
    
    tasks.forEach(task => {
      if (statusCount[task.status] !== undefined) {
        statusCount[task.status]++;
      } else {
        // Handle any unexpected status
        statusCount[task.status] = 1;
      }
    });
    
    return Object.entries(statusCount).map(([name, value]) => ({ name, value }));
  };
  
  const generatePriorityData = () => {
    const priorityCount = {
      low: 0,
      medium: 0,
      high: 0
    };
    
    tasks.forEach(task => {
      if (priorityCount[task.priority] !== undefined) {
        priorityCount[task.priority]++;
      } else {
        // Handle any unexpected priority
        priorityCount[task.priority] = 1;
      }
    });
    
    return Object.entries(priorityCount).map(([name, value]) => ({ name, value }));
  };

  const handleMenuClick = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handlePrint = () => {
    handleMenuClose();
    window.print();
  };

  const handleDownload = async () => {
    handleMenuClose();
    setLoading(true);
    try {
      const response = await generateReport(projectId);
      
      // Create a blob URL from the response data
      const url = window.URL.createObjectURL(new Blob([response.data]));
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from content-disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `project_report_${projectId}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      setError('Failed to download report. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    handleMenuClose();
    // Placeholder for share functionality
    alert("Share functionality would be implemented here");
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
          <CircularProgress size={60} thickness={4} />
        </Box>
      </Container>
    );
  }

  const statusData = generateStatusData();
  const priorityData = generatePriorityData();

  return (
    <Container maxWidth="lg">
      <Box mb={3}>
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
              Project Report
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {project?.name ? `Performance analysis for ${project.name}` : 'Loading project...'}
            </Typography>
          </Box>
          
          <Box>
            <Tooltip title="Report options">
              <IconButton 
                onClick={handleMenuClick}
                sx={{ 
                  ml: 1,
                  bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: theme => alpha(theme.palette.primary.main, 0.2)
                  }
                }}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
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
              <MenuItem onClick={handlePrint} sx={{ py: 1.5, px: 2 }}>
                <PrintIcon fontSize="small" sx={{ mr: 1.5 }} /> Print Report
              </MenuItem>
              <MenuItem onClick={handleDownload} sx={{ py: 1.5, px: 2 }}>
                <DownloadIcon fontSize="small" sx={{ mr: 1.5 }} /> Download PDF
              </MenuItem>
              <MenuItem onClick={handleShare} sx={{ py: 1.5, px: 2 }}>
                <ShareIcon fontSize="small" sx={{ mr: 1.5 }} /> Share Report
              </MenuItem>
            </Menu>
          </Box>
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
        >
          {error}
        </Alert>
      )}

      {tasks.length === 0 ? (
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
          <AssessmentIcon 
            color="primary" 
            sx={{ 
              fontSize: 60,
              opacity: 0.7,
              mb: 2
            }} 
          />
          <Typography variant="h5" gutterBottom fontWeight="medium">
            No Tasks Available
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            Create tasks for this project to generate a detailed report with analytics and insights.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate(`/projects/${projectId}/tasks`)}
            sx={{ 
              borderRadius: 2,
              py: 1.2,
              px: 3,
              fontWeight: 'medium'
            }}
          >
            Go to Tasks
          </Button>
        </Paper>
      ) : (
        <Box>
          <Grid container spacing={3}>
            {/* Project Summary */}
            <Grid item xs={12}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 3,
                  border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom fontWeight="bold">
                    Project Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" paragraph>
                        <strong>Project Name:</strong> {project?.name}
                      </Typography>
                      <Typography variant="body1" paragraph>
                        <strong>Description:</strong> {project?.description || 'No description provided'}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Total Tasks:</strong> {tasks.length}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" paragraph>
                        <strong>Completed Tasks:</strong> {tasks.filter(task => task.status === 'completed').length}
                      </Typography>
                      <Typography variant="body1" paragraph>
                        <strong>Completion Rate:</strong> {Math.round((tasks.filter(task => task.status === 'completed').length / tasks.length) * 100)}%
                      </Typography>
                      <Typography variant="body1">
                        <strong>High Priority Tasks:</strong> {tasks.filter(task => task.priority === 'high').length}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Task Status Chart */}
            <Grid item xs={12} md={6}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 3,
                  height: '100%',
                  border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>
                    Task Status Distribution
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Task Priority Chart */}
            <Grid item xs={12} md={6}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 3,
                  height: '100%',
                  border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>
                    Task Priority Distribution
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={priorityData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="value" name="Tasks" radius={[4, 4, 0, 0]}>
                          {priorityData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={PRIORITY_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Project Insights */}
            <Grid item xs={12}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 3,
                  border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" gutterBottom fontWeight="bold">
                    Project Insights
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box>
                    <Typography variant="body1" paragraph>
                      <strong>Project Health:</strong> {
                        tasks.filter(task => task.status === 'completed').length / tasks.length > 0.7
                          ? 'Good'
                          : tasks.filter(task => task.status === 'completed').length / tasks.length > 0.3
                            ? 'Average'
                            : 'Needs Attention'
                      }
                    </Typography>
                    <Typography variant="body1" paragraph>
                      <strong>Critical Tasks:</strong> {tasks.filter(task => task.priority === 'high' && task.status !== 'completed').length} high priority tasks remain incomplete.
                    </Typography>
                    <Typography variant="body1">
                      <strong>Recommendations:</strong>
                    </Typography>
                    <ul>
                      {tasks.filter(task => task.priority === 'high' && task.status !== 'completed').length > 0 && (
                        <li>
                          <Typography variant="body1">
                            Focus on completing high priority tasks to maintain project momentum.
                          </Typography>
                        </li>
                      )}
                      {tasks.filter(task => task.status === 'in-progress').length > tasks.filter(task => task.status === 'completed').length && (
                        <li>
                          <Typography variant="body1">
                            Too many tasks are in progress simultaneously. Consider completing current tasks before starting new ones.
                          </Typography>
                        </li>
                      )}
                      {tasks.filter(task => task.status === 'pending').length > tasks.length * 0.7 && (
                        <li>
                          <Typography variant="body1">
                            A large percentage of tasks are still pending. Review project timeline and resources.
                          </Typography>
                        </li>
                      )}
                      {tasks.filter(task => task.status === 'completed').length === tasks.length && (
                        <li>
                          <Typography variant="body1">
                            All tasks are completed. Consider moving to the next phase or closing the project.
                          </Typography>
                        </li>
                      )}
                    </ul>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
    </Container>
  );
};

export default Report; 