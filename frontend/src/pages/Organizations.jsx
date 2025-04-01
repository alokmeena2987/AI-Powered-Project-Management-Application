import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  alpha,
  Paper,
  Divider
} from '@mui/material';
import { 
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Business as BusinessIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { createOrganization, getOrganizations, deleteOrganization } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Organizations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isProjectManager } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getOrganizations();
      setOrganizations(response.data);
    } catch (err) {
      setError('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Check location state to see if we should open the create dialog
  useEffect(() => {
    if (location.state?.openCreateDialog) {
      setOpen(true);
      // Clear the state to prevent reopening on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      setError('Organization name is required');
      return;
    }
    
    try {
      const response = await createOrganization(formData);
      setOrganizations([...organizations, response.data]);
      setOpen(false);
      setFormData({ name: '', description: '' });
      setSuccess('Organization created successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create organization');
    }
  };

  const handleMenuOpen = (event, orgId) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedOrgId(orgId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedOrgId(null);
  };

  const handleDeleteClick = (org) => {
    setOrgToDelete(org);
    setConfirmDelete(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!orgToDelete) return;
    
    try {
      const response = await deleteOrganization(orgToDelete.id);
      
      // Remove the organization from state
      setOrganizations(organizations.filter(org => org.id !== orgToDelete.id));
      
      // Show success message
      const successMessage = response?.data?.message || `Organization "${orgToDelete.name}" was deleted successfully`;
      setSuccess(successMessage);
    } catch (err) {
      console.error('Error deleting organization:', err);
      
      let errorMessage = 'Failed to delete organization. ';
      
      if (err.response) {
        const status = err.response.status;
        
        if (status === 404) {
          errorMessage += 'The organization may have already been deleted.';
          // Remove from local state anyway
          setOrganizations(organizations.filter(org => org.id !== orgToDelete.id));
        } else if (status === 403) {
          errorMessage += 'You may not have permission to delete this organization.';
        } else if (status === 405) {
          errorMessage += 'API method not supported. The backend API needs to be updated.';
          
          // For development/testing purposes only
          if (process.env.NODE_ENV === 'development') {
            // Remove the organization from the UI immediately
            setOrganizations(prevOrgs => prevOrgs.filter(org => org.id !== orgToDelete.id));
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
      setConfirmDelete(false);
      setOrgToDelete(null);
    }
  };

  const handleViewProjects = (orgId) => {
    if (!orgId || orgId === 'undefined' || orgId === null) {
      setError('Invalid organization ID. Cannot view projects.');
      return;
    }
    
    if (isNaN(Number(orgId))) {
      setError('Invalid organization ID format. Cannot view projects.');
      return;
    }
    
    navigate(`/organizations/${orgId}/projects`);
  };

  return (
    <Container maxWidth="lg">
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
            Organizations
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your organizations and projects
          </Typography>
        </Box>
        
        {isProjectManager && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{ 
              borderRadius: 2,
              py: 1.2,
              px: 3,
              fontWeight: 'medium',
              boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`
            }}
          >
            Create Organization
          </Button>
        )}
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 8 }}>
          <CircularProgress size={48} thickness={4} />
        </Box>
      ) : (
        <>
          {organizations.length === 0 ? (
            <Paper
              sx={{ 
                p: 4,
                borderRadius: 3,
                textAlign: 'center',
                backgroundColor: theme => alpha(theme.palette.background.paper, 0.7),
                backdropFilter: 'blur(8px)',
                border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <BusinessIcon 
                color="primary" 
                sx={{ 
                  fontSize: 60,
                  opacity: 0.7,
                  mb: 2
                }} 
              />
              <Typography variant="h5" gutterBottom fontWeight="medium">
                No Organizations Yet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
                Create your first organization to start managing projects and collaborating with your team.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpen(true)}
                sx={{ 
                  borderRadius: 2,
                  py: 1.2,
                  px: 3,
                  fontWeight: 'medium'
                }}
              >
                Create Organization
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {organizations.map((org) => (
                <Grid item xs={12} sm={6} md={4} key={org.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      borderRadius: 3, 
                      overflow: 'hidden',
                      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: theme => `0 12px 20px ${alpha(theme.palette.primary.main, 0.15)}`
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}
                  >
                    <Box 
                      sx={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 6,
                        background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
                      }}
                    />
                    <CardContent sx={{ pt: 3, pb: 1, flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box 
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 40,
                              height: 40,
                              borderRadius: '12px',
                              bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                              mr: 1
                            }}
                          >
                            <BusinessIcon fontSize="small" />
                          </Box>
                          <Typography variant="h6" fontWeight="medium" gutterBottom>
                            {org.name}
                          </Typography>
                        </Box>
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleMenuOpen(e, org.id)}
                          aria-label="organization menu"
                          sx={{
                            bgcolor: theme => alpha(theme.palette.grey[500], 0.05),
                            '&:hover': {
                              bgcolor: theme => alpha(theme.palette.grey[500], 0.1)
                            }
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {org.description || 'No description provided'}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ px: 2, py: 1.5 }}>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => handleViewProjects(org.id)}
                        fullWidth
                        sx={{ 
                          borderRadius: 2,
                          py: 0.8,
                          fontWeight: 'medium'
                        }}
                      >
                        View Projects
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Create Organization Dialog */}
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, pt: 2 }}>
          Create Organization
        </DialogTitle>
        <DialogContent>
          <Typography variant="h5" fontWeight="bold" sx={{ color: 'primary.main', mb: 2 }}>
            Create a New Organization
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Organization Name"
            type="text"
            fullWidth
            variant="outlined"
            value={formData.name}
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
            placeholder="Describe the purpose of this organization"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2, px: 3 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            sx={{ 
              borderRadius: 2, 
              px: 3,
              boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Organization Menu */}
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
            const org = organizations.find(o => o.id === selectedOrgId);
            if (org) handleDeleteClick(org);
          }}
          sx={{ 
            color: 'error.main',
            py: 1.5,
            px: 2
          }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} /> Delete
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
        <DialogTitle sx={{ pt: 3 }}>
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <Typography variant="h5" fontWeight="bold" color="error" sx={{ mb: 2 }}>
            Are you sure?
          </Typography>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to delete the organization <strong>"{orgToDelete?.name}"</strong>?
          </DialogContentText>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            This action cannot be undone. All projects and tasks associated with this 
            organization will be permanently deleted.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setConfirmDelete(false)}
            variant="outlined"
            sx={{ borderRadius: 2, px: 3 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            sx={{ 
              borderRadius: 2,
              px: 3,
              boxShadow: theme => `0 4px 14px ${alpha(theme.palette.error.main, 0.3)}`
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Organizations; 