import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protected Route Component
 * Restricts access based on authentication and role
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isAuthenticated } = useAuth();

  // Not logged in - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role - redirect to appropriate dashboard
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const dashboards = {
      admin: '/admin/dashboard',
      head: '/head/dashboard',
      trainer: '/trainer/dashboard',
      consultant: '/consultant/dashboard',
      learner: '/learner/dashboard',
    };
    
    return <Navigate to={dashboards[user.role] || '/'} replace />;
  }

  // Authorized - render component
  return children;
};

export default ProtectedRoute;
