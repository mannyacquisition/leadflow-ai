import React, { createContext, useContext } from 'react';
import { useAuth as useAuthProvider } from './AuthProvider';

// Legacy AuthContext - redirects to new AuthProvider
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Use the new AuthProvider from AuthProvider.jsx
  return children;
};

// Re-export useAuth from AuthProvider
export const useAuth = useAuthProvider;

export default AuthContext;
