import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import TrainerDashboard from './pages/trainer/TrainerDashboard';
import LearnerDashboard from './pages/learner/LearnerDashboard';
import TrainerSession from './pages/trainer/TrainerSession';
import LearnerSession from './pages/learner/LearnerSession';

function ProtectedRoute({ children, requiredRole }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'trainer' ? '/trainer/dashboard' : '/learner/dashboard'} replace />;
  }

  return children;
}

export default function App() {
  const { user, isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/trainer/dashboard"
        element={
          <ProtectedRoute requiredRole="trainer">
            <TrainerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/trainer/session/:sessionId"
        element={
          <ProtectedRoute requiredRole="trainer">
            <TrainerSession />
          </ProtectedRoute>
        }
      />

      <Route
        path="/learner/dashboard"
        element={
          <ProtectedRoute requiredRole="learner">
            <LearnerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/learner/session/:sessionId"
        element={
          <ProtectedRoute requiredRole="learner">
            <LearnerSession />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'trainer' ? '/trainer/dashboard' : '/learner/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
