import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkAuth = useCallback(async () => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setIsLoadingAuth(false);
      return;
    }

    try {
      setIsLoadingAuth(true);
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      // Don't set authError here - just means user needs to login
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const result = await api.auth.login({ email, password });
      setUser(result.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return result;
    } catch (error) {
      setAuthError({ type: 'login_failed', message: error.message });
      throw error;
    }
  };

  const register = async (email, password, fullName) => {
    try {
      const result = await api.auth.register({ email, password, full_name: fullName });
      setUser(result.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return result;
    } catch (error) {
      setAuthError({ type: 'register_failed', message: error.message });
      throw error;
    }
  };

  const handleGoogleCallback = async (sessionId) => {
    try {
      const result = await api.auth.googleCallback(sessionId);
      setUser(result.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return result;
    } catch (error) {
      setAuthError({ type: 'google_auth_failed', message: error.message });
      throw error;
    }
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      login,
      register,
      handleGoogleCallback,
      logout,
      navigateToLogin,
      checkAuth,
    }}>
      {children}
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
