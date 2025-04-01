import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Box, Typography, Button, Paper, useTheme, alpha } from '@mui/material';
import { Home as HomeIcon, ErrorOutline as ErrorIcon } from '@mui/icons-material';

const NotFound = () => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme => theme.palette.mode === 'light'
          ? `linear-gradient(45deg, ${alpha(theme.palette.primary.light, 0.05)}, ${alpha(theme.palette.error.light, 0.05)})`
          : `linear-gradient(45deg, ${alpha(theme.palette.background.paper, 0.4)}, ${alpha(theme.palette.background.default, 0.8)})`
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={theme.palette.mode === 'dark' ? 2 : 1}
          sx={{
            padding: { xs: 3, md: 6 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 3,
            background: theme => alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.8 : 0.6),
            backdropFilter: 'blur(10px)',
            boxShadow: theme => theme.palette.mode === 'light' 
              ? '0 10px 40px -10px rgba(0, 0, 0, 0.1)'
              : '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: theme => alpha(theme.palette.divider, 0.1),
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <Box 
            sx={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '6px',
              background: theme => `linear-gradient(90deg, ${theme.palette.error.main}, ${theme.palette.error.light})`
            }}
          />
          
          <ErrorIcon 
            color="error" 
            sx={{ 
              fontSize: 60, 
              mb: 2,
              opacity: 0.8
            }} 
          />
          
          <Typography 
            variant="h1" 
            sx={{ 
              fontWeight: 800, 
              color: theme => alpha(theme.palette.error.main, 0.85),
              letterSpacing: '-2px',
              mb: 2,
              textAlign: 'center',
              fontSize: { xs: '5rem', md: '8rem' }
            }}
          >
            404
          </Typography>
          
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600, 
              mb: 2,
              textAlign: 'center'
            }}
          >
            Page Not Found
          </Typography>
          
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ 
              mb: 4, 
              maxWidth: 500,
              textAlign: 'center',
              lineHeight: 1.6
            }}
          >
            The page you are looking for might have been removed, had its name changed, 
            or is temporarily unavailable.
          </Typography>
          
          <Button
            component={Link}
            to="/"
            variant="contained"
            size="large"
            startIcon={<HomeIcon />}
            sx={{ 
              py: 1.2,
              px: 4,
              borderRadius: 2,
              fontWeight: 600,
              boxShadow: theme => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`
            }}
          >
            Back to Home
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default NotFound; 