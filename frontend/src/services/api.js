import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Add a cache to track failed endpoints to prevent repeated failed calls
const failedEndpointsCache = new Map();
const RETRY_COOLDOWN = 10000; // 10 seconds cooldown for failed endpoints

// Make the cache accessible globally for reset operations
window.failedEndpointsCache = failedEndpointsCache;

// Helper to create a unique cache key for requests
const createCacheKey = (config) => {
  // Include method and URL
  let key = `${config.method}:${config.url}`;
  
  // For POST/PUT requests, include a hash of the data to differentiate between different payloads
  if (config.data && (config.method === 'post' || config.method === 'put')) {
    // For task creation, use just the title to distinguish different tasks
    if (config.url.includes('/tasks') && config.data.title) {
      key += `:${config.data.title}`;
    } 
    // For other endpoints, use the first few characters of a hash
    else {
      try {
        const dataStr = typeof config.data === 'string' ? 
          config.data : JSON.stringify(config.data);
        // Use a simple hash of the first 100 chars to keep keys manageable
        key += `:${dataStr.slice(0, 100)}`;
      } catch (e) {
        // If stringify fails, just use the method+URL as key
        console.warn('Failed to include data in cache key:', e);
      }
    }
  }
  
  return key;
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds timeout for API calls
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Remove CORS headers from the request (client shouldn't set these)
    delete config.headers['Access-Control-Allow-Origin'];
    delete config.headers['access-control-allow-origin'];
    delete config.headers['Access-Control-Allow-Methods'];
    delete config.headers['access-control-allow-methods'];
    delete config.headers['Access-Control-Allow-Headers'];
    delete config.headers['access-control-allow-headers'];
    
    // Create a more specific cache key based on method, URL, and payload
    const cacheKey = createCacheKey(config);
    const failureInfo = failedEndpointsCache.get(cacheKey);
    
    if (failureInfo && Date.now() - failureInfo.timestamp < RETRY_COOLDOWN) {
      console.warn(`Request to ${cacheKey} is in cooldown until ${new Date(failureInfo.timestamp + RETRY_COOLDOWN).toLocaleTimeString()}`);
      // Return a cancelled request promise
      return Promise.reject({
        message: `This request is temporarily unavailable due to recent failures. Please try again in a few seconds.`,
        isApiCooldown: true,
        originalError: failureInfo.error
      });
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // Clear this endpoint from failed cache if the request succeeds
    const cacheKey = createCacheKey(response.config);
    if (failedEndpointsCache.has(cacheKey)) {
      failedEndpointsCache.delete(cacheKey);
    }
    return response;
  },
  (error) => {
    // Don't process already handled cooldown errors
    if (error.isApiCooldown) {
      return Promise.reject(error);
    }
    
    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    }
    
    // Store this failed endpoint to prevent immediate retries
    if (error.config && error.config.method && error.config.url) {
      const cacheKey = createCacheKey(error.config);
      // Only cache server errors and network errors, not validation errors
      if (!error.response || error.response.status >= 500) {
        failedEndpointsCache.set(cacheKey, {
          timestamp: Date.now(),
          error: error
        });
        console.warn(`Added ${cacheKey} to cooldown cache for ${RETRY_COOLDOWN}ms`);
      }
    }
    
    if (error.response) {
      // Server responded with an error
      if (error.response.status === 401) {
        // Unauthorized, token might be expired
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      
      if (error.response.status === 500) {
        console.error('Server error:', error.response.data);
      }
    } else if (error.request) {
      // Request made but no response
      console.error('Network error:', error.request);
    } else {
      // Error in setting up the request
      console.error('Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Auth API calls
export const login = (credentials) => {
  return api.post('/auth/login', credentials);
};

export const signup = (userData) => {
  return api.post('/auth/signup', userData);
};

// Organization API calls
export const createOrganization = (data) => {
  return api.post('/organizations', data);
};

export const getOrganizations = () => {
  return api.get('/organizations');
};

export const getOrganization = (id) => {
  return api.get(`/organizations/${id}`);
};

export const updateOrganization = (id, data) => {
  return api.put(`/organizations/${id}`, data);
};

export const deleteOrganization = (id) => {
  return api.delete(`/organizations/${id}`);
};

// Project API calls
export const createProject = (orgId, data) => {
  // Format the deadline if it's a Date object
  const formattedData = {
    ...data,
    deadline: data.deadline instanceof Date ? data.deadline.toISOString() : data.deadline,
    roadmap_text: data.roadmap_text || '',
    tasks_checklist: data.tasks_checklist || ''
  };
  
  return api.post(`/organizations/${orgId}/projects`, formattedData);
};

/**
 * Fetches all projects for a given organization
 */
export const fetchProjects = async (organizationId) => {
  try {
    const response = await api.get(`/organizations/${organizationId}/projects?include_tasks=true`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching projects: ${error}`);
    throw error;
  }
};

/**
 * Legacy function maintained for backward compatibility
 * @deprecated Use fetchProjects instead
 */
export const getProjects = (orgId) => {
  return api.get(`/organizations/${orgId}/projects`);
};

export const getProject = async (id) => {
  try {
    const response = await api.get(`/projects/${id}`);
    
    // Add empty strings for roadmap_text and tasks_checklist if they're missing or null
    const data = response.data;
    if (data) {
      data.roadmap_text = data.roadmap_text || '';
      data.tasks_checklist = data.tasks_checklist || '';
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching project ${id}:`, error);
    throw error;
  }
};

export const updateProject = (id, data) => {
  return api.put(`/projects/${id}`, data);
};

export const deleteProject = (id) => {
  return api.delete(`/projects/${id}`);
};

// Task API calls
export const createTask = (projectId, data) => {
  // Use the api instance with auth interceptor but with longer timeout
  const config = {
    timeout: 30000 // Longer timeout for task creation
  };
  
  // return executeWithRetry(() => 
  return api.post(`/projects/${projectId}/tasks`, data, config)
  // );
};

export const getTasks = (projectId) => {
  // Use the api instance with auth interceptor but with longer timeout
  const config = {
    timeout: 30000 // Longer timeout for task retrieval
  };
  
  // return executeWithRetry(() => 
  return api.get(`/projects/${projectId}/tasks`, config)
  // );
};

export const getTask = (id) => {
  return api.get(`/tasks/${id}`);
};

export const updateTask = (id, data) => {
  return api.put(`/tasks/${id}`, data);
};

export const deleteTask = (id) => {
  return api.delete(`/tasks/${id}`);
};

export const saveTasksProgress = (projectId, tasks) => {
  return api.post(`/projects/${projectId}/save-tasks-progress`, { tasks });
};

// AI and Report API calls
/**
 * Generates a software development roadmap based on project details using AI.
 * Uses a strict prompt format to ensure consistent, high-quality AI outputs.
 */
export const generateRoadmap = async (title, description, deadline, options = {}) => {
  // Generate a unique identifier to prevent caching
  const uniqueId = Date.now().toString();
  
  // Validate required parameters
  if (!title) {
    throw new Error('Project title is required');
  }

  // Calculate deadline information if available
  let deadlineStr = '';
  let urgencyLevel = 'normal';
  let daysToDeadline = null;
  
  if (deadline) {
    try {
      const deadlineDate = new Date(deadline);
      const now = new Date();
      daysToDeadline = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
      
      // Determine urgency level based on days to deadline
      if (daysToDeadline <= 7) {
        urgencyLevel = 'extremely urgent';
      } else if (daysToDeadline <= 30) {
        urgencyLevel = 'urgent';
      } else if (daysToDeadline <= 90) {
        urgencyLevel = 'moderately urgent';
      } else {
        urgencyLevel = 'normal';
      }
      
      // Format as days remaining instead of absolute date
      deadlineStr = `${daysToDeadline} days left`;
    } catch (e) {
      console.warn('Error processing deadline:', e);
    }
  }

  // Process options
  const {
    problem_statement = '',
    priority = 'medium',
    project_complexity = 'medium',
    is_refinement = false,
    refinement_instructions = '',
    existing_roadmap = ''
  } = options;
  
  // Build the prompt using the specified strict formatting
  let prompt = '';
  
  if (is_refinement && refinement_instructions && existing_roadmap) {
    // Use the refinement prompt template
    prompt = `I need to refine an existing software development roadmap based on specific feedback.

[Project]
Title: ${title}
Description: ${description}
${problem_statement ? `Problem Statement: ${problem_statement}\n` : ''}
${deadline ? `Deadline: ${deadlineStr} (${urgencyLevel})\n` : ''}
Priority: ${priority}
Complexity: ${project_complexity}

${existing_roadmap}

[Refinement Instructions]
${refinement_instructions}

Please provide an updated roadmap with the refinements applied. Maintain the original structure but improve it based on the feedback. Return ONLY the roadmap in this format:

[Roadmap]
Step 1: {Phase name with clear objective and timeline}

- {Task description with specific technical details}
- {Task description with specific technical details}
...

Step 2: {Phase name with clear objective and timeline}

... and so on
`;
  } else {
    // Use the initial roadmap generation prompt template
    prompt = `Create a detailed software development roadmap for the following project:

[Project]
Title: ${title}
Description: ${description}
${problem_statement ? `Problem Statement: ${problem_statement}\n` : ''}
${deadline ? `Deadline: ${deadlineStr} (${urgencyLevel})\n` : ''}
Priority: ${priority}
Complexity: ${project_complexity}

[Instructions]
1. Structure the roadmap into logical phases based on the project complexity.
2. Focus on technical implementation details, avoiding generic management terms.
3. Each phase should have a clear objective and realistic timeline.
4. Tasks should be specific to software development with technical details.
5. The number of phases and tasks should be appropriate for the project's complexity.
6. Return ONLY the roadmap in this format:

[Roadmap]
Step 1: {Phase name with clear objective and timeline}

- {Task description with specific technical details}
- {Task description with specific technical details}
...

Step 2: {Phase name with clear objective and timeline}

... and so on
`;
  }

  // Add a unique identifier to prevent caching
  prompt += `\n\nUnique request ID: ${uniqueId}`;
  
  // Prepare the request data
  const data = {
    prompt: prompt,                  // The key used by backend
    title: title,                    // Fallback
    project_title: title,            // Backend expects this
    description: description,        // Fallback
    project_description: description, // Backend expects this
    deadline: deadline ? new Date(deadline).toISOString() : null,
    problem_statement: problem_statement,
    priority: priority,
    project_complexity: project_complexity
  };

  try {
    const response = await api.post('/temp-roadmap', data);
    
    // Check if response contains error
    if (response.data && response.data.error) {
      console.error('Error from AI service:', response.data.error);
      throw new Error(response.data.error);
    }
    
    return response;
  } catch (error) {
    console.error('Error generating roadmap:', error);
    
    // Check for specific error conditions
    if (error.response) {
      console.error('Server responded with error:', error.response.status, error.response.data);
      
      // If the server returned an error message, use it
      if (error.response.data && error.response.data.error) {
        throw new Error(error.response.data.error);
      }
    }
    
    throw error;
  }
};

// Helper function to determine appropriate software development methodology
export const determineDevelopmentMethodology = (description = '', problemStatement = '', deadline = null) => {
  const combinedText = `${description} ${problemStatement}`.toLowerCase();
  let daysToDeadline = Infinity;
  
  // Calculate days to deadline if provided
  if (deadline) {
    try {
      const deadlineDate = new Date(deadline);
      const currentDate = new Date();
      daysToDeadline = Math.ceil((deadlineDate - currentDate) / (1000 * 60 * 60 * 24));
    } catch (e) {
      console.warn('Error calculating deadline for methodology determination:', e);
    }
  }
  
  // Define methodology indicators
  const indicators = {
    agile: ['agile', 'sprint', 'scrum', 'iterative', 'continuous deployment', 'user feedback', 'flexible', 'adapt', 'kanban'],
    waterfall: ['waterfall', 'sequential', 'traditional', 'linear', 'phase-based', 'milestone', 'strict requirements', 'documentation'],
    devops: ['devops', 'continuous integration', 'ci/cd', 'automation', 'deployment pipeline', 'infrastructure as code', 'docker', 'kubernetes'],
    lean: ['mvp', 'lean', 'minimal viable product', 'quick release', 'essential features', 'startup', 'rapid prototype'],
    aiml: ['machine learning', 'deep learning', 'neural network', 'ai model', 'training data', 'ml pipeline', 'artificial intelligence'],
    microservices: ['microservice', 'service oriented', 'api gateway', 'distributed system', 'container', 'scalable architecture'],
    mobile: ['android', 'ios', 'mobile app', 'responsive design', 'app store', 'play store', 'mobile-first'],
    web: ['web application', 'frontend', 'backend', 'full stack', 'responsive', 'single page application', 'spa', 'react', 'angular', 'vue']
  };
  
  // Count keyword matches for each methodology
  const counts = Object.entries(indicators).reduce((acc, [methodology, keywords]) => {
    acc[methodology] = keywords.filter(keyword => combinedText.includes(keyword)).length;
    return acc;
  }, {});
  
  // Project size/complexity considerations based on description length and complexity of terms
  const textLength = combinedText.length;
  const complexityTerms = ['complex', 'sophisticated', 'enterprise', 'scalable', 'high performance'];
  const hasComplexityTerms = complexityTerms.some(term => combinedText.includes(term));
  
  // Decision logic based on deadline, counts, and project size
  if (daysToDeadline <= 7) {
    return 'Lean/MVP with Daily Sprints'; // Extremely tight deadline requires a minimal approach
  } else if (daysToDeadline <= 21) {
    return counts.lean > 0 || counts.agile > 1 ? 'Lean Agile with Weekly Sprints' : 'Rapid Development with Agile';
  }
  
  // If specific domain has strong indicators, prioritize that
  if (counts.aiml >= 2) {
    return 'ML Ops Pipeline';
  } else if (counts.devops >= 2) {
    return 'DevOps with CI/CD Pipeline';
  } else if (counts.microservices >= 2) {
    return 'Microservices Architecture with Agile';
  }
  
  // For medium-term projects, balance between methodologies
  if (hasComplexityTerms && textLength > 300) {
    if (counts.waterfall > counts.agile) {
      return 'Hybrid Waterfall-Agile';
    } else {
      return counts.web >= 2 ? 'Agile with Feature-driven Development' : 'Scaled Agile Framework (SAFe)';
    }
  }
  
  // Mobile-specific methodology
  if (counts.mobile >= 2) {
    return 'Mobile DevOps with Agile Sprints';
  }
  
  // Web-specific methodology
  if (counts.web >= 2) {
    return 'Web Development with Agile Sprints';
  }
  
  // Default case - if nothing specific detected, use basic Agile
  if (counts.waterfall > counts.agile) {
    return 'Waterfall with Milestones';
  }
  
  return 'Agile with Scrum'; // Default methodology for software projects
};

export const generateReport = async (projectId) => {
  try {
    // Handle request timeout and potential errors
    const response = await api.get(`/projects/${projectId}/generate-report`, { 
      responseType: 'blob',
      headers: {
        'Accept': 'application/pdf'
      },
      timeout: 60000 // 60 seconds timeout for report generation (increased from 30s)
    });
    
    // Check if we got a valid PDF response by checking content type
    const contentType = response.headers['content-type'];
    if (contentType && contentType.includes('application/pdf')) {
      return response.data; // Return the blob directly
    }
    
    // If not a PDF, check if it's a JSON response
    if (contentType && contentType.includes('application/json')) {
      // Read the blob as text to parse JSON
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(response.data);
      });
      
      try {
        const jsonData = JSON.parse(text);
        return jsonData;
      } catch (e) {
        console.error('Failed to parse JSON from blob:', e);
        throw new Error('Invalid response format');
      }
    }
    
    // For any other response type
    return response;
  } catch (error) {
    console.error('Error generating report:', error);
    
    // Handle the case where the server returns an error with JSON
    if (error.response && error.response.data instanceof Blob) {
      try {
        // Try to read the error message from the blob
        const text = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsText(error.response.data);
        });
        
        // Check if it looks like JSON
        if (text.startsWith('{') && text.endsWith('}')) {
          try {
            const json = JSON.parse(text);
            console.error('Server error:', json.error || json.message || text);
            throw new Error(json.error || json.message || 'Failed to generate report');
          } catch (parseError) {
            // Not valid JSON despite looking like it
            console.error('Failed to parse error response as JSON:', parseError);
            throw new Error(text || 'Failed to generate report');
          }
        } else {
          // Not JSON, return as text error
          throw new Error(text || 'Failed to generate report');
        }
      } catch (e) {
        throw new Error('Failed to generate report: ' + e.message);
      }
    }
    
    // Handle network timeout errors specifically
    if (error.code === 'ECONNABORTED') {
      throw new Error('Report generation timed out. The server took too long to respond.');
    }
    
    // Handle other types of errors
    if (error.response) {
      // The request was made and the server responded with an error status
      const status = error.response.status;
      if (status === 404) {
        throw new Error('Project not found');
      } else if (status === 500) {
        throw new Error('Server error: Failed to generate report');
      }
    }
    
    throw error;
  }
};

// User profile API calls
export const getUserProfile = () => {
  return api.get('/user/profile');
};

export const updateUserProfile = (data) => {
  return api.put('/user/profile', data);
};

export const deleteUserAccount = () => {
  return api.delete('/user/profile');
};

export const createProjectWithRoadmap = async (
  organizationId,
  title,
  description,
  priority,
  deadline,
  roadmap_text = '',
  tasks_checklist = ''
) => {
  try {
    const formattedData = {
      organization_id: organizationId,
      title,
      description: description || '',
      priority: priority || 'medium',
      deadline: deadline instanceof Date ? deadline.toISOString() : deadline,
      roadmap_text: roadmap_text || '',
      tasks_checklist: tasks_checklist || ''
    };

    // Use the correct endpoint for creating projects
    const response = await api.post(`/organizations/${organizationId}/projects`, formattedData);
    
    // Extract data properly from response
    const data = response.data;
    return data;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

export default api; 