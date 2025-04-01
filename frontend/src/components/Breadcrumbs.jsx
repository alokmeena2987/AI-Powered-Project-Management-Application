import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Breadcrumbs as MuiBreadcrumbs, 
  Typography, 
  Link, 
  Box, 
  useTheme,
  alpha 
} from '@mui/material';
import { 
  NavigateNext as NavigateNextIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Folder as ProjectIcon,
  Task as TaskIcon,
  Analytics as ReportIcon,
  Psychology as RoadmapIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { getProject } from '../services/api';

const Breadcrumbs = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { orgId, projectId } = useParams();
  const [projectOrgId, setProjectOrgId] = useState(null);
  
  // Fetch the project's organization ID if we're in a project detail page
  useEffect(() => {
    // Only fetch if we have a projectId but no orgId in the URL
    if (projectId && !orgId) {
      const fetchProjectOrgId = async () => {
        try {
          const response = await getProject(projectId);
          const project = response.data || response;
          if (project && project.organization_id) {
            setProjectOrgId(project.organization_id);
          }
        } catch (error) {
          console.error("Error fetching project organization ID:", error);
        }
      };
      
      fetchProjectOrgId();
    }
  }, [projectId, orgId]);
  
  const breadcrumbsItems = useMemo(() => {
    const pathnames = location.pathname.split('/').filter(x => x);
    const items = [];
    
    // Always start with Dashboard
    items.push({
      name: 'Dashboard',
      path: '/',
      icon: <DashboardIcon fontSize="small" />,
      current: location.pathname === '/'
    });
    
    // Settings page
    if (pathnames.includes('settings')) {
      items.push({
        name: 'Settings',
        path: '/settings',
        icon: <SettingsIcon fontSize="small" />,
        current: location.pathname === '/settings'
      });
      return items;
    }
    
    // Organizations
    if (pathnames.includes('organizations')) {
      items.push({
        name: 'Organizations',
        path: '/organizations',
        icon: <BusinessIcon fontSize="small" />,
        current: location.pathname === '/organizations'
      });
    }
    
    // Projects for a specific organization
    if (pathnames.includes('organizations') && orgId && pathnames.includes('projects')) {
      items.push({
        name: 'Projects',
        path: `/organizations/${orgId}/projects`,
        icon: <ProjectIcon fontSize="small" />,
        current: location.pathname === `/organizations/${orgId}/projects`
      });
    }
    
    // Project details pages
    if (pathnames.includes('projects') && projectId) {
      // For tasks page and other project detail pages
      if (pathnames.includes('tasks') || pathnames.includes('roadmap') || pathnames.includes('report')) {
        // If we're in a project detail page (including tasks) 
        // and we don't have an 'Organizations' item yet, add it
        if (!items.find(item => item.name === 'Organizations')) {
          items.push({
            name: 'Organizations',
            path: '/organizations',
            icon: <BusinessIcon fontSize="small" />,
            current: false
          });
        }
        
        // Use the orgId from URL params or the fetched projectOrgId
        const currentOrgId = orgId || projectOrgId;
        
        // If we know the organization ID, add a Projects item
        if (currentOrgId) {
          items.push({
            name: 'Projects',
            path: `/organizations/${currentOrgId}/projects`,
            icon: <ProjectIcon fontSize="small" />,
            current: false
          });
        }
        
        // Add the Project item (singular)
        // items.push({
        //   name: 'Project',
        //   path: `/projects/${projectId}`,
        //   icon: <ProjectIcon fontSize="small" />,
        //   current: !pathnames.includes('tasks') && !pathnames.includes('roadmap') && !pathnames.includes('report')
        // });
        
        if (pathnames.includes('tasks')) {
          items.push({
            name: 'Tasks',
            path: `/projects/${projectId}/tasks`,
            icon: <TaskIcon fontSize="small" />,
            current: true
          });
        } else if (pathnames.includes('roadmap')) {
          items.push({
            name: 'AI Roadmap',
            path: `/projects/${projectId}/roadmap`,
            icon: <RoadmapIcon fontSize="small" />,
            current: true
          });
        } else if (pathnames.includes('report')) {
          items.push({
            name: 'Report',
            path: `/projects/${projectId}/report`,
            icon: <ReportIcon fontSize="small" />,
            current: true
          });
        }
      } else {
        // If we're on the main project page and don't have a Projects item
        if (!items.find(item => item.name === 'Projects')) {
          // Use the orgId from URL params or the fetched projectOrgId
          const currentOrgId = orgId || projectOrgId;
          
          items.push({
            name: 'Projects',
            path: currentOrgId ? `/organizations/${currentOrgId}/projects` : '/organizations',
            icon: <ProjectIcon fontSize="small" />,
            current: false
          });
        }
      }
    }
    
    return items;
  }, [location.pathname, orgId, projectId, projectOrgId]);
  
  // If we have no breadcrumbs (like on login page), don't render anything
  if (breadcrumbsItems.length <= 1) {
    return null;
  }
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mb: 3,
        p: 2,
        borderRadius: 2,
        bgcolor: theme => alpha(theme.palette.background.paper, 0.7)
      }}
    >
      <MuiBreadcrumbs 
        separator={<NavigateNextIcon fontSize="small" color="action" />}
        aria-label="breadcrumb"
      >
        {breadcrumbsItems.map((item, index) => {
          const isLast = index === breadcrumbsItems.length - 1;
          
          return isLast ? (
            <Typography 
              key={item.path} 
              color="text.primary"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                fontWeight: 'medium'
              }}
            >
              {item.icon && (
                <Box component="span" sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>
                  {item.icon}
                </Box>
              )}
              {item.name}
            </Typography>
          ) : (
            <Link
              key={item.path}
              underline="hover"
              color="inherit"
              onClick={() => navigate(item.path)}
              sx={{ 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                '&:hover': { color: theme.palette.primary.main } 
              }}
            >
              {item.icon && (
                <Box component="span" sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>
                  {item.icon}
                </Box>
              )}
              {item.name}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default Breadcrumbs; 