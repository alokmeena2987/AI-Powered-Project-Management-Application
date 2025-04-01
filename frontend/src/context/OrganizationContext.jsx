import React, { createContext, useContext, useState, useEffect } from 'react';
import { getOrganizations } from '../services/api';
import { useAuth } from './AuthContext';

const OrganizationContext = createContext();

export const useOrganizationContext = () => useContext(OrganizationContext);

export const OrganizationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [currentOrganization, setCurrentOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load organizations when user authenticates
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!isAuthenticated) {
        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await getOrganizations();
        if (response && response.data) {
          setOrganizations(response.data);
          
          // If no current organization is set and there are organizations available,
          // set the first one as current
          if (!currentOrganization && response.data.length > 0) {
            setCurrentOrganization(response.data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
        setError('Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [isAuthenticated, user, currentOrganization]);

  // Set a specific organization as current
  const selectOrganization = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        selectOrganization,
        loading,
        error
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export default OrganizationContext; 