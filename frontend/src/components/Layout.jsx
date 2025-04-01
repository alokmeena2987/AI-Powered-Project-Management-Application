import React, { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Divider,
  Container,
  ListItemButton,
  alpha,
  useMediaQuery,
  Collapse,
  Tooltip,
  useTheme,
  CircularProgress
} from '@mui/material';
import {
  Menu as MenuIcon,
  Business as BusinessIcon,
  ExitToApp as LogoutIcon,
  Dashboard as DashboardIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { ThemeModeContext } from '../App';
import Breadcrumbs from './Breadcrumbs';
import { getOrganizations } from '../services/api';

const drawerWidth = 280;

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const themeMode = useContext(ThemeModeContext);
  const [organizations, setOrganizations] = useState([]);
  const [expandedMenus, setExpandedMenus] = useState({});
  
  // Add state for the selected organization
  const [selectedOrg, setSelectedOrg] = useState(null);
  
  // Add state for organizations
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgError] = useState(null);
  
  // Keep track of last fetch time to avoid excessive API calls
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const FETCH_COOLDOWN = 30000; // 30 seconds between fetches

  // Improved organization fetching logic with cache invalidation
  const fetchOrganizationsData = useCallback(async (forceFetch = false) => {
    const now = Date.now();
    
    // Don't fetch if we've recently fetched, unless forceFetch is true
    if (!forceFetch && now - lastFetchTime < FETCH_COOLDOWN) {
      return;
    }
    
    setLoadingOrgs(true);
    try {
      const response = await getOrganizations();
      setOrganizations(response.data || []);
      
      // If no selected org or the selected org no longer exists, select the first one
      if (response.data.length > 0) {
        const currentOrgExists = response.data.some(org => org.id === selectedOrg?.id);
        if (!selectedOrg || !currentOrgExists) {
          setSelectedOrg(response.data[0]);
        }
      } else {
        // No organizations available
        setSelectedOrg(null);
      }
      
      setLastFetchTime(now);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      // Clear organizations on error to avoid showing stale data
      setOrganizations([]);
      setSelectedOrg(null);
    } finally {
      setLoadingOrgs(false);
    }
  }, [selectedOrg, lastFetchTime]);

  useEffect(() => {
    fetchOrganizationsData();
    
    // Refresh organizations when navigating between pages
    // This ensures the sidebar always shows the current list
    const handleNavigation = () => {
      fetchOrganizationsData();
    };
    
    // Listen for location changes to refresh data
    window.addEventListener('popstate', handleNavigation);
    
    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [location.pathname, fetchOrganizationsData]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  // Toggle theme
  const handleToggleTheme = () => {
    themeMode.toggleThemeMode();
  };

  const handleToggleMenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  // Check if breadcrumbs should be shown
  const shouldShowBreadcrumbs = () => {
    // Show breadcrumbs only on organization pages, projects, and tasks
    return (
      location.pathname.includes('/organizations/') ||
      location.pathname.includes('/projects/')
    ) && !location.pathname.includes('/settings');
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Function to navigate to organization's projects
  const navigateToOrgProjects = (orgId) => {
    navigate(`/organizations/${orgId}/projects`);
    if (isMobile) setMobileOpen(false);
  };

  const mainMenuItems = [
    { 
      id: 'dashboard',
      text: 'Dashboard', 
      icon: <DashboardIcon />, 
      path: '/',
      action: () => navigate('/')
    },
    { 
      id: 'organizations',
      text: 'Organizations', 
      icon: <BusinessIcon />, 
      path: '/organizations',
      action: () => navigate('/organizations'),
      submenu: [
        {
          id: 'new-organization',
          text: 'Add Organization',
          icon: <AddIcon fontSize="small" />,
          action: () => {
            navigate('/organizations', { state: { openCreateDialog: true } });
          }
        }
      ]
    },
    { 
      id: 'settings',
      text: 'Settings', 
      icon: <SettingsIcon />, 
      path: '/settings',
      action: () => navigate('/settings')
    }
  ];

  const drawer = (
    <div>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Typography 
          variant="h6" 
          color="primary" 
          fontWeight="bold"
          sx={{ 
            letterSpacing: '0.5px', 
            fontSize: '1.25rem',
            transition: 'color 0.3s ease',
            background: theme => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Task Manager
        </Typography>
      </Box>
      
      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ px: 2 }}>
        <Box 
          sx={{ 
            py: 1.5, 
            px: 2, 
            borderRadius: 2, 
            mb: 2,
            background: alpha(theme.palette.primary.main, 0.08),
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight="medium" noWrap>
              {user?.full_name || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Project Manager
            </Typography>
          </Box>
        </Box>
      </Box>
      
      <List sx={{ px: 2 }}>
        {mainMenuItems.map((item) => (
          <React.Fragment key={item.id}>
            <ListItemButton
              onClick={() => {
                if (item.submenu) {
                  handleToggleMenu(item.id);
                }
                if (item.action) {
                  item.action();
                  if (isMobile && !item.submenu) setMobileOpen(false);
                }
              }}
              sx={{
                mb: 0.5,
                py: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.16),
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    height: '60%',
                    width: 4,
                    bgcolor: theme.palette.primary.main,
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  }
                },
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
                position: 'relative',
                transition: 'all 0.2s ease',
              }}
              selected={isActive(item.path)}
            >
              <ListItemIcon
                sx={{
                  color: isActive(item.path) ? theme.palette.primary.main : 'inherit',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{
                  fontWeight: isActive(item.path) ? 600 : 400
                }}
              />
              {item.submenu && (
                expandedMenus[item.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />
              )}
            </ListItemButton>
            
            {item.submenu && (
              <Collapse in={expandedMenus[item.id]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {/* Display user organizations */}
                  {item.id === 'organizations' && (
                    <>
                      {loadingOrgs ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : organizations.length > 0 ? (
                        <>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ pl: 4, py: 1, display: 'block' }}
                          >
                            Your Organizations
                          </Typography>
                          {organizations.map(org => (
                            <ListItemButton
                              key={org.id}
                              sx={{
                                pl: 4,
                                py: 0.75,
                                borderRadius: 2,
                                mb: 0.5,
                                ml: 2,
                                '&.Mui-selected': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                                },
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                                },
                              }}
                              selected={location.pathname.includes(`/organizations/${org.id}/`)}
                              onClick={() => navigateToOrgProjects(org.id)}
                            >
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <FolderIcon fontSize="small" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={org.name} 
                                primaryTypographyProps={{
                                  fontSize: '0.875rem',
                                  noWrap: true,
                                  style: { 
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '160px' 
                                  }
                                }}
                              />
                            </ListItemButton>
                          ))}
                          <Divider sx={{ my: 1, mx: 2 }} />
                        </>
                      ) : orgError ? (
                        <Typography 
                          variant="caption" 
                          color="error"
                          sx={{ pl: 4, py: 1, display: 'block' }}
                        >
                          {orgError}
                        </Typography>
                      ) : (
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ pl: 4, py: 1, display: 'block' }}
                        >
                          No Organizations Available
                        </Typography>
                      )}
                    </>
                  )}
                
                  {/* Display regular submenu items */}
                  {item.submenu.map((subItem) => (
                    <ListItemButton
                      key={subItem.id}
                      sx={{
                        pl: 4,
                        py: 0.75,
                        borderRadius: 2,
                        mb: 0.5,
                        ml: 2,
                        '&.Mui-selected': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                        },
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                      onClick={() => {
                        if (subItem.action) {
                          subItem.action();
                          if (isMobile) setMobileOpen(false);
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {subItem.icon}
                      </ListItemIcon>
                      <ListItemText 
                        primary={subItem.text} 
                        primaryTypographyProps={{
                          fontSize: '0.875rem'
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            )}
          </React.Fragment>
        ))}
      </List>
      
      <Box sx={{ flexGrow: 1 }} />
      
      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ p: 2 }}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          color="primary"
          sx={{ 
            justifyContent: 'flex-start',
            py: 1,
            borderRadius: 2,
            borderWidth: '1px',
            '&:hover': {
              borderWidth: '1px'
            }
          }}
        >
          Logout
        </Button>
      </Box>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          backdropFilter: 'blur(20px)',
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon color="primary" />
          </IconButton>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Theme Toggle Button */}
            <Tooltip title={theme.palette.mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton onClick={handleToggleTheme} color="primary">
                {theme.palette.mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: 'none',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          bgcolor: theme.palette.mode === 'light' ? 'grey.50' : 'grey.900',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Toolbar />
        <Container 
          maxWidth="lg" 
          sx={{ 
            py: 3,
            px: { xs: 2, sm: 3 },
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {shouldShowBreadcrumbs() && <Breadcrumbs />}
          <Box sx={{ flexGrow: 1 }}>
            <Outlet />
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout; 