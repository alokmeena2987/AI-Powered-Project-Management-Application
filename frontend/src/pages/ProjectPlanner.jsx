import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  DragIndicator as DragIndicatorIcon,
  Assignment as AssignmentIcon,
  FormatListBulleted as ListIcon,
  ViewKanban as KanbanIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { getProject, getTasks, updateTask, createTask, deleteTask } from '../services/api';

// Column definitions for the Kanban board
const columns = {
  pending: {
    id: 'pending',
    title: 'To Do',
    color: alpha => alpha('#ff9800', 0.1)
  },
  'in-progress': {
    id: 'in-progress',
    title: 'In Progress',
    color: alpha => alpha('#3f51b5', 0.1)
  },
  completed: {
    id: 'completed',
    title: 'Completed',
    color: alpha => alpha('#4caf50', 0.1)
  }
};

const priorityColors = {
  low: "#8bc34a",
  medium: "#ff9800",
  high: "#f44336"
};

const ProjectPlanner = () => {
  const { projectId } = useParams();
  const theme = useTheme();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium'
  });
  const [tasksByStatus, setTasksByStatus] = useState({
    pending: [],
    'in-progress': [],
    completed: []
  });
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'

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
      
      // Organize tasks by status
      const grouped = response.data.reduce((acc, task) => {
        const status = task.status || 'pending';
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(task);
        return acc;
      }, {
        pending: [],
        'in-progress': [],
        completed: []
      });
      
      setTasksByStatus(grouped);
    } catch (err) {
      setError('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchProject();
      await fetchTasks();
    };
    
    loadData();
  }, [fetchProject, fetchTasks]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleOpenDialog = (task = null) => {
    if (task) {
      setCurrentTask(task);
      setFormData({
        title: task.title,
        description: task.description || '',
        status: task.status || 'pending',
        priority: task.priority || 'medium'
      });
    } else {
      setCurrentTask(null);
      setFormData({
        title: '',
        description: '',
        status: 'pending',
        priority: 'medium'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentTask(null);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      setError('Task title is required');
      return;
    }
    
    setLoading(true);
    try {
      let response;
      
      if (currentTask) {
        // Update existing task
        response = await updateTask(currentTask.id, formData);
        
        // Update tasks state with the response data from the server
        const updatedTask = response.data;
        setTasks(tasks.map(task => task.id === currentTask.id ? updatedTask : task));
        setSuccess('Task updated successfully');
      } else {
        // Create new task
        response = await createTask(projectId, formData);
        
        // Add new task to tasks array from the response data
        const newTask = response.data;
        setTasks([...tasks, newTask]);
        setSuccess('Task created successfully');
      }
      
      // After successfully updating the database, update the local task state
      await fetchTasks(); // Fetch all tasks to ensure consistency with the database
      
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process task');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteTask(taskId);
      
      // Show success message
      setSuccess('Task deleted successfully');
      
      // Update tasks by fetching from server to ensure consistency with database
      await fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    
    // If dropped outside a droppable area
    if (!destination) return;
    
    // If dropped in the same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    
    // Find the task being moved
    const task = tasks.find(t => t.id.toString() === draggableId);
    
    if (!task) return;
    
    // Create new status mapping for the task
    const newStatus = destination.droppableId;
    if (task.status === newStatus) return; // No change
    
    try {
      // Optimistically update UI
      const sourceColumn = [...tasksByStatus[source.droppableId]];
      const destColumn = [...tasksByStatus[destination.droppableId]];
      const [movedTask] = sourceColumn.splice(source.index, 1);
      movedTask.status = newStatus;
      destColumn.splice(destination.index, 0, movedTask);
      
      setTasksByStatus({
        ...tasksByStatus,
        [source.droppableId]: sourceColumn,
        [destination.droppableId]: destColumn
      });
      
      // Update task in the backend
      const response = await updateTask(task.id, { status: newStatus });
      
      // Get the updated task from the response and update local state
      const updatedTask = response.data;
      
      // Update the tasks array with the updated task from the server
      setTasks(tasks.map(t => {
        if (t.id === task.id) {
          return updatedTask;
        }
        return t;
      }));
      
      // Show success message
      setSuccess(`Task "${task.title}" moved to ${columns[newStatus].title}`);
      
    } catch (err) {
      setError('Failed to update task status');
      console.error('Error updating task status:', err);
      
      // Revert back on error by restoring the original state
      setTasksByStatus({
        ...tasksByStatus,
        [source.droppableId]: [...tasksByStatus[source.droppableId], task].filter(t => t.id !== task.id),
        [destination.droppableId]: tasksByStatus[destination.droppableId].filter(t => t.id !== task.id)
      });
      
      // Refresh tasks from server to ensure consistency
      fetchTasks();
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'kanban' ? 'list' : 'kanban');
  };

  if (loading && tasks.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
          <CircularProgress size={60} thickness={4} />
        </Box>
      </Container>
    );
  }

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
                background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              Project Planner
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {project?.name ? `Manage tasks for ${project.name}` : 'Loading project...'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title={`Switch to ${viewMode === 'kanban' ? 'list' : 'kanban'} view`}>
              <Button
                variant="outlined"
                onClick={toggleViewMode}
                startIcon={viewMode === 'kanban' ? <ListIcon /> : <KanbanIcon />}
                sx={{ 
                  borderRadius: 2,
                  py: 1,
                  fontWeight: 'medium',
                }}
              >
                {viewMode === 'kanban' ? 'List View' : 'Kanban View'}
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ 
                borderRadius: 2,
                py: 1.2,
                px: 3,
                fontWeight: 'medium',
                boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`
              }}
            >
              New Task
            </Button>
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
          <AssignmentIcon 
            color="primary" 
            sx={{ 
              fontSize: 60,
              opacity: 0.7,
              mb: 2
            }} 
          />
          <Typography variant="h5" gutterBottom fontWeight="medium">
            No Tasks Yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            Create your first task to start planning and organizing your project.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{ 
              borderRadius: 2,
              py: 1.2,
              px: 3,
              fontWeight: 'medium'
            }}
          >
            Add Task
          </Button>
        </Paper>
      ) : viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Grid container spacing={3}>
            {Object.keys(columns).map(columnId => (
              <Grid item xs={12} md={4} key={columnId}>
                <Card 
                  elevation={0}
                  sx={{ 
                    borderRadius: 3,
                    border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    height: '100%'
                  }}
                >
                  <CardHeader
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {columns[columnId].title}
                        </Typography>
                        <Chip 
                          label={tasksByStatus[columnId]?.length || 0} 
                          size="small" 
                          sx={{ 
                            bgcolor: columns[columnId].color(theme.alpha), 
                            fontWeight: 'bold' 
                          }} 
                        />
                      </Box>
                    }
                    sx={{ 
                      borderBottom: 1, 
                      borderColor: 'divider',
                      bgcolor: columns[columnId].color(theme.alpha),
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
                    }}
                  />
                  <Droppable droppableId={columnId}>
                    {(provided) => (
                      <Box
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        sx={{ 
                          minHeight: 300, 
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2
                        }}
                      >
                        {tasksByStatus[columnId]?.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                {...provided.draggableProps}
                                ref={provided.innerRef}
                                elevation={snapshot.isDragging ? 6 : 1}
                                sx={{ 
                                  mb: 2,
                                  borderRadius: 2,
                                  border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                  transition: 'all 0.2s ease-in-out',
                                  transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
                                  '&:hover': {
                                    boxShadow: theme => `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`
                                  }
                                }}
                              >
                                <CardContent sx={{ pt: 2, pb: 1 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Box sx={{ display: 'flex', width: '100%' }}>
                                      <Box {...provided.dragHandleProps} sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                        <DragIndicatorIcon fontSize="small" color="action" />
                                      </Box>
                                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 0.5 }}>
                                        {task.title}
                                      </Typography>
                                    </Box>
                                    <Chip 
                                      label={task.priority} 
                                      size="small" 
                                      sx={{ 
                                        bgcolor: alpha(priorityColors[task.priority], 0.1),
                                        color: priorityColors[task.priority],
                                        fontWeight: 'medium',
                                        borderRadius: 1.5,
                                        ml: 1,
                                        height: 24
                                      }} 
                                    />
                                  </Box>
                                  {task.description && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                      {task.description}
                                    </Typography>
                                  )}
                                </CardContent>
                                <CardActions sx={{ px: 2, pt: 0, pb: 1 }}>
                                  <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleOpenDialog(task)}
                                      sx={{ 
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        '&:hover': {
                                          bgcolor: alpha(theme.palette.primary.main, 0.2)
                                        }
                                      }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleDeleteTask(task.id)}
                                      sx={{ 
                                        bgcolor: alpha(theme.palette.error.main, 0.1),
                                        '&:hover': {
                                          bgcolor: alpha(theme.palette.error.main, 0.2)
                                        }
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </CardActions>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DragDropContext>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 800 }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  p: 2, 
                  borderBottom: theme => `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  fontWeight: 'bold'
                }}
              >
                <Box sx={{ flex: 3 }}>Task</Box>
                <Box sx={{ flex: 1, textAlign: 'center' }}>Status</Box>
                <Box sx={{ flex: 1, textAlign: 'center' }}>Priority</Box>
                <Box sx={{ flex: 1, textAlign: 'right' }}>Actions</Box>
              </Box>
              {tasks.map(task => (
                <Box 
                  key={task.id} 
                  sx={{ 
                    display: 'flex', 
                    p: 2, 
                    borderBottom: theme => `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                    '&:hover': {
                      bgcolor: theme => alpha(theme.palette.primary.main, 0.03)
                    },
                    alignItems: 'center'
                  }}
                >
                  <Box sx={{ flex: 3 }}>
                    <Typography variant="subtitle2" fontWeight="medium">
                      {task.title}
                    </Typography>
                    {task.description && (
                      <Typography variant="body2" color="text.secondary">
                        {task.description}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Chip 
                      label={columns[task.status]?.title || task.status} 
                      size="small" 
                      sx={{ 
                        bgcolor: columns[task.status]?.color(theme.alpha) || alpha(theme.palette.grey[500], 0.1),
                        fontWeight: 'medium'
                      }} 
                    />
                  </Box>
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Chip 
                      label={task.priority} 
                      size="small" 
                      sx={{ 
                        bgcolor: alpha(priorityColors[task.priority], 0.1),
                        color: priorityColors[task.priority],
                        fontWeight: 'medium'
                      }} 
                    />
                  </Box>
                  <Box sx={{ flex: 1, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleOpenDialog(task)}
                      sx={{ 
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.2)
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteTask(task.id)}
                      sx={{ 
                        bgcolor: alpha(theme.palette.error.main, 0.1),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.error.main, 0.2)
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Task Form Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, pt: 2 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ color: 'primary.main' }}>
            {currentTask ? 'Edit Task' : 'Create New Task'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="title"
            label="Task Title"
            type="text"
            fullWidth
            variant="outlined"
            value={formData.title}
            onChange={handleChange}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="description"
            label="Description"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={formData.description}
            onChange={handleChange}
            sx={{ mb: 2 }}
            placeholder="Describe what needs to be done"
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  label="Status"
                >
                  <MenuItem value="pending">To Do</MenuItem>
                  <MenuItem value="in-progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                <InputLabel id="priority-label">Priority</InputLabel>
                <Select
                  labelId="priority-label"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  label="Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            variant="outlined"
            onClick={handleCloseDialog}
            sx={{ borderRadius: 2, px: 3 }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : currentTask ? <SaveIcon /> : <AddIcon />}
            sx={{ 
              borderRadius: 2, 
              px: 3,
              boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            {currentTask ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectPlanner; 