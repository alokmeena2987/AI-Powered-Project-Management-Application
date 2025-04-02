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
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { login: authLogin } = useAuth();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const isDarkMode = theme.palette.mode === 'dark';
  const themeClass = isDarkMode ? 'dark' : 'light';

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
      const response = await login(formData);
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
    <Box className={`login-container ${themeClass}`}>
      <Container maxWidth="sm">
        <Paper 
          elevation={isDarkMode ? 2 : 1} 
          className={`login-paper ${themeClass}`}
          sx={{ p: { xs: 3, md: 5 } }}
        >
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography 
              component="h1" 
              variant="h4" 
              className="login-heading"
            >
              Welcome Back
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary"
              className="login-subheading"
            >
              Sign in to access your projects
            </Typography>
          </Box>
          
          {error && (
            <Alert 
              severity="error" 
              className={`error-alert ${themeClass}`}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2.5 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" color="primary" />
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
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              className={`submit-button ${themeClass}`}
            >
              Sign In
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Don't have an account?
              </Typography>
              <Button 
                component={Link} 
                to="/signup" 
                variant="outlined"
                fullWidth
                className="create-account-button"
              >
                Create Account
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login; 