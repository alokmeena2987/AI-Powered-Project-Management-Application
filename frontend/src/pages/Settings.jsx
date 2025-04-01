import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  alpha,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  AccountCircle as AccountCircleIcon
} from '@mui/icons-material';
import { getUserProfile, updateUserProfile, deleteUserAccount } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const navigate = useNavigate();
  const { logout, user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getUserProfile();
      
      // Handle both mock data and real API responses
      const userData = response.data;
      
      setFormData(prevData => ({
        ...prevData,
        full_name: userData.full_name || '',
        email: userData.email || ''
      }));
      
      setError(''); // Clear any errors if successful
    } catch (err) {
      console.error('Failed to load user profile:', err);
      
      // Use fallback data from AuthContext if API fails
      if (user) {
        setFormData(prevData => ({
          ...prevData,
          full_name: user.full_name || '',
          email: user.email || ''
        }));
        setError('Using cached profile data. Some features may be limited.');
      } else {
        setError('Failed to load user profile. Please try refreshing the page.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitLoading(true);
    
    try {
      // Check if passwords match when trying to update password
      if (formData.new_password) {
        if (formData.new_password !== formData.confirm_password) {
          setError('New passwords do not match');
          setSubmitLoading(false);
          return;
        }
        
        if (!formData.current_password) {
          setError('Current password is required to set a new password');
          setSubmitLoading(false);
          return;
        }
      }
      
      // Prepare data for update
      const updateData = {
        full_name: formData.full_name,
        email: formData.email
      };
      
      // Only include password if trying to change it
      if (formData.new_password) {
        updateData.current_password = formData.current_password;
        updateData.password = formData.new_password;
      }
      
      const response = await updateUserProfile(updateData);
      
      setSuccess('Profile updated successfully!');
      
      // Update local user data if available
      if (response.data) {
        // Update user in Auth context
        updateUser({
          full_name: response.data.full_name,
          email: response.data.email
        });
      }
      
      // Clear password fields
      setFormData({
        ...formData,
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
      setSubmitLoading(false);
    } catch (err) {
      console.error('Profile update error:', err);
      
      if (err.response?.status === 400) {
        setError(err.response.data?.message || 'Invalid input. Please check your information.');
      } else if (err.response?.status === 401) {
        setError('Current password is incorrect');
      } else if (!navigator.onLine) {
        setError('You are offline. Please check your internet connection.');
      } else {
        setError('Failed to update profile. Please try again later.');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUserAccount();
      logout();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setConfirmOpen(false);
    }
  };

  // If loading initially, show loading indicator
  if (loading && !formData.full_name) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flexDirection: 'column' }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="body1" sx={{ mt: 2 }}>Loading settings...</Typography>
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
                background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              Account Settings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your profile information
            </Typography>
          </Box>
        </Box>
      </Box>

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

      <Grid container spacing={3}>
        {/* Account Settings */}
        <Grid item xs={12}>
          <Card 
            elevation={0} 
            sx={{ 
              borderRadius: 3,
              border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AccountCircleIcon 
                  color="primary" 
                  sx={{ 
                    fontSize: 28,
                    mr: 1.5,
                    p: 1,
                    borderRadius: '50%',
                    bgcolor: theme => alpha(theme.palette.primary.main, 0.1)
                  }} 
                />
                <Typography variant="h6" fontWeight="bold">
                  Profile Information
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />
              
              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      variant="outlined"
                      sx={{ mb: 2 }}
                      required
                      disabled={submitLoading}
                      helperText="Your display name in the application"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      variant="outlined"
                      sx={{ mb: 3 }}
                      required
                      disabled={submitLoading}
                      helperText="Your email address used for login"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                      Change Password
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      name="current_password"
                      type="password"
                      value={formData.current_password}
                      onChange={handleChange}
                      variant="outlined"
                      sx={{ mb: 2 }}
                      disabled={submitLoading}
                      helperText="Required to change your password"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="New Password"
                      name="new_password"
                      type="password"
                      value={formData.new_password}
                      onChange={handleChange}
                      variant="outlined"
                      sx={{ mb: 2 }}
                      disabled={submitLoading}
                      helperText="Leave blank to keep current password"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      name="confirm_password"
                      type="password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      variant="outlined"
                      sx={{ mb: 2 }}
                      disabled={submitLoading}
                      error={formData.new_password !== formData.confirm_password && formData.confirm_password !== ''}
                      helperText={formData.new_password !== formData.confirm_password && formData.confirm_password !== '' ? "Passwords don't match" : ""}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button 
                      type="submit"
                      variant="contained" 
                      startIcon={submitLoading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      disabled={submitLoading}
                      sx={{ 
                        borderRadius: 2,
                        py: 1.2,
                        px: 3,
                        fontWeight: 'medium',
                        boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`
                      }}
                    >
                      {submitLoading ? 'Updating...' : 'Update Profile'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper 
        sx={{ 
          p: 3, 
          mt: 3, 
          borderRadius: 3,
          border: theme => `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
          bgcolor: theme => alpha(theme.palette.error.main, 0.03)
        }}
      >
        <Typography variant="h6" gutterBottom color="error">
          Danger Zone
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Deleting your account is permanent. All your data will be wiped out immediately and you won't be able to get it back.
        </Typography>
        <Button 
          variant="outlined" 
          color="error"
          onClick={() => setConfirmOpen(true)}
        >
          Delete Account
        </Button>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle>Confirm Account Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={() => setConfirmOpen(false)} 
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAccount} 
            color="error" 
            variant="contained"
            sx={{ 
              borderRadius: 2,
              boxShadow: theme => `0 4px 14px ${alpha(theme.palette.error.main, 0.4)}`
            }}
          >
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Settings; 