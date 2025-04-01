import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  useTheme,
  alpha,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { signup } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { login: authLogin } = useAuth();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'project_manager' // Default role is always project_manager now
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await signup(formData);
      authLogin(response.data.token, response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme => theme.palette.mode === 'light'
          ? `linear-gradient(45deg, ${alpha(theme.palette.secondary.light, 0.1)}, ${alpha(theme.palette.primary.main, 0.05)})`
          : `linear-gradient(45deg, ${alpha(theme.palette.secondary.dark, 0.5)}, ${alpha(theme.palette.background.default, 0.7)})`
      }}
    >
      <Container maxWidth="sm">
        <Paper 
          elevation={theme.palette.mode === 'dark' ? 2 : 1}
          sx={{ 
            p: { xs: 3, md: 5 }, 
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
            background: theme => alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.8 : 0.6),
            boxShadow: theme => theme.palette.mode === 'light' 
              ? '0 10px 30px -5px rgba(0, 0, 0, 0.1)'
              : '0 10px 30px -5px rgba(0, 0, 0, 0.3)',
            border: theme => `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`
          }}
        >
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography 
              component="h1" 
              variant="h4" 
              sx={{ 
                fontWeight: 'bold', 
                mb: 1,
                background: theme => `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Create Account
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary"
              sx={{ fontWeight: 'medium' }}
            >
              Sign up to start managing your projects
            </Typography>
          </Box>
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                boxShadow: theme => `0 2px 8px ${alpha(theme.palette.error.main, 0.15)}`
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="full_name"
              label="Full Name"
              name="full_name"
              autoComplete="name"
              autoFocus
              value={formData.full_name}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" color="secondary" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" color="secondary" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" color="secondary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={toggleShowPassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              helperText="Password must be at least 8 characters long"
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="secondary"
              size="large"
              sx={{ 
                mt: 2, 
                mb: 3, 
                py: 1.2,
                fontSize: '1rem',
                fontWeight: 'medium',
                borderRadius: 2,
                boxShadow: theme => `0 4px 14px ${alpha(theme.palette.secondary.main, 0.4)}`
              }}
            >
              Sign Up
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Already have an account?
              </Typography>
              <Button 
                component={Link} 
                to="/login" 
                variant="outlined"
                color="secondary"
                fullWidth
                sx={{
                  borderRadius: 2,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 'medium'
                }}
              >
                Sign In
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Signup; 