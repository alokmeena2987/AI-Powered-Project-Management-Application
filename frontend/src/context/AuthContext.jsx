import React, { createContext, useState, useContext, useEffect } from 'react';
import jwtDecode from 'jwt-decode';
import { getUserProfile } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp > currentTime) {
            // Set initial user state with minimal data
            setUser({
              id: decoded.user_id,
              token
            });
            
            // Fetch full user data if possible
            try {
              const profileResponse = await getUserProfile();
              if (profileResponse && profileResponse.data) {
                setUser(prevUser => ({
                  ...prevUser,
                  ...profileResponse.data,
                  token
                }));
              }
            } catch (profileError) {
              console.warn('Failed to load user profile:', profileError);
              // Continue with minimal user data
            }
          } else {
            // Token expired
            console.warn('Token expired, redirecting to login');
            localStorage.removeItem('token');
          }
        } catch (error) {
          console.error('Invalid token:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser({
      ...userData,
      token
    });
  };

  const updateUser = (userData) => {
    if (!user) return;
    
    // Update only the provided fields, keeping the rest
    setUser(prevUser => ({
      ...prevUser,
      ...userData
    }));
    
    // Also update in localStorage for persistence
    const userDataForStorage = {
      ...user,
      ...userData
    };
    
    // Don't store the token in localStorage.user (it's already in localStorage.token)
    const { token, ...userDataWithoutToken } = userDataForStorage;
    
    localStorage.setItem('user', JSON.stringify(userDataWithoutToken));
  };

  const logout = () => {
    // Clear ALL local storage items
    localStorage.clear(); // This is more comprehensive than individual removes
    
    // Specifically ensure critical items are removed
    localStorage.removeItem('token');
    localStorage.removeItem('projectState');
    localStorage.removeItem('user');
    localStorage.removeItem('roadmapData');
    
    // Reset user state
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    updateUser,
    loading,
    isAuthenticated: !!user,
    isProjectManager: true // Always true since all users are project managers now
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 