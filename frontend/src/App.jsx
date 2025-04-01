import React, { useState, useEffect, createContext, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMediaQuery, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProjectContext } from './context/ProjectContext';
import { OrganizationProvider } from './context/OrganizationContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import AIRoadmap from './pages/AIRoadmap';
import Report from './pages/Report';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import ProjectPlanner from './pages/ProjectPlanner';
import ProjectCreation from './pages/ProjectCreation';

// Theme mode context
export const ThemeModeContext = createContext();

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return null;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

// Route guard for ID parameters - validates organization ID before rendering component
// This prevents invalid IDs from being passed to components
const ValidatedOrgRoute = ({ children }) => {
  // Remove unused params
  const pathSegments = window.location.pathname.split('/');
  
  // Find the orgId in the URL path segments
  // URL structure is expected to be /organizations/:orgId/...
  const orgIdIndex = pathSegments.indexOf('organizations') + 1;
  const orgId = pathSegments[orgIdIndex];
  
  // Validate the organization ID
  if (orgIdIndex < pathSegments.length && 
      (!orgId || orgId === 'undefined' || orgId === 'null' || isNaN(Number(orgId)))) {
    console.error('Invalid organization ID in URL:', orgId);
    // Redirect to organizations page if the ID is invalid
    return <Navigate to="/organizations" />;
  }
  
  return children;
};

// Resume project creation route
const ResumeProjectCreationRoute = ({ children }) => {
  const { projectFormCompleted, activeStep } = useProjectContext(); // Remove unused organizationId
  
  // If they've already started the project creation flow, take them to where they left off
  if (projectFormCompleted && activeStep > 0) {
    return <ProjectCreation />;
  }
  
  return children;
};

const App = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode || (prefersDarkMode ? 'dark' : 'light');
  });
  
  // Apply theme mode
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);
  
  // Create theme
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#1976d2',
          },
          secondary: {
            main: '#f50057',
          },
        },
        shape: {
          borderRadius: 8,
        },
        typography: {
          fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
          ].join(','),
        },
      }),
    [mode],
  );
  
  // Toggle theme function
  const toggleThemeMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };
  
  return (
    <ThemeModeContext.Provider value={{ mode, toggleThemeMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <AuthProvider>
            <ProjectProvider>
              <OrganizationProvider>
                <Router>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Dashboard />} />
                      <Route path="organizations" element={<Organizations />} />
                      <Route path="organizations/:orgId/projects" element={
                        <ValidatedOrgRoute>
                          <ResumeProjectCreationRoute>
                            <Projects />
                          </ResumeProjectCreationRoute>
                        </ValidatedOrgRoute>
                      } />
                      <Route path="organizations/:orgId/create-project" element={
                        <ProtectedRoute>
                          <ProjectCreation />
                        </ProtectedRoute>
                      } />
                      <Route path="project/roadmap" element={
                        <ProtectedRoute>
                          <AIRoadmap />
                        </ProtectedRoute>
                      } />
                      <Route path="projects/:projectId/tasks" element={<Tasks />} />
                      <Route path="projects/:projectId/roadmap" element={<AIRoadmap />} />
                      <Route path="projects/:projectId/report" element={<Report />} />
                      <Route path="projects/:projectId/planner" element={<ProjectPlanner />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="roadmap" element={<AIRoadmap />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Router>
              </OrganizationProvider>
            </ProjectProvider>
          </AuthProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export default App; 