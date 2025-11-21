
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { MediaControlProvider } from './context/MediaControlContext';

// Pages
import Home from './pages/Home';
import Login from './pages/auth/Login';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import RegisterHead from './pages/admin/RegisterHead';
import ManageHeads from './pages/admin/ManageHeads';
import EditHead from './pages/admin/EditHead';
import ManageLearningGoals from './pages/admin/ManageLearningGoals';
import ManageLearningContent from './pages/admin/ManageLearningContent';
import ViewLearners from './pages/admin/ViewLearners';
import ViewTrainers from './pages/admin/ViewTrainers';
import ManageVlogs from './pages/admin/ManageVlogs';
import EditVlog from './pages/admin/EditVlog';


// Head Pages
import HeadDashboard from './pages/head/Dashboard';
import ManageTrainers from './pages/head/ManageTrainers';
import RegisterTrainer from './pages/head/RegisterTrainer';
import EditTrainer from './pages/head/EditTrainer';
import ManageLearners from './pages/head/ManageLearners';
import EditLearner from './pages/head/EditLearner';
import RegisterLearner from './pages/head/RegisterLearner';
import ScheduleSession from './pages/head/ScheduleSession';
import ManageSessions from './pages/head/ManageSessions';
import ViewVlogs from './pages/head/ViewVlogs';
import ManageAssignedPrograms from "./pages/head/ManageAssignedPrograms";
import ManageAssignedLearningContent from './pages/head/ManageAssignedLearningContent';


// Trainer Pages
import TrainerDashboard from './pages/trainer/Dashboard';
import TrainerSession from './pages/trainer/TrainerSession';

// Consultant Pages
import ConsultantDashboard from './pages/consultant/Dashboard';

// Learner Pages
import LearnerDashboard from './pages/learner/Dashboard';
import LearnerSession from './pages/learner/LearnerSession';
import ViewAssignedPrograms from "./pages/learner/ViewAssignedPrograms";
import LearningProgramDetails from "./pages/learner/LearningProgramDetails";



// Components
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

function App() {
  const { isAuthenticated, user } = useAuth();

  // Determine dashboard based on user role
  const getDashboardPath = () => {
    if (!user) return '/';
    const dashboards = {
      admin: '/admin/dashboard',
      head: '/head/dashboard',
      trainer: '/trainer/dashboard',
      consultant: '/consultant/dashboard',
      learner: '/learner/dashboard',
    };
    return dashboards[user.role] || '/';
  };

  return (
    <MediaControlProvider>
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={getDashboardPath()} replace /> : <Login />}
      />

      {/* Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/register-head"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <RegisterHead />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/manage-heads"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ManageHeads />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/edit-head/:headId"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <EditHead />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/learning-content"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ManageLearningContent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/learning-goals"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ManageLearningGoals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/view-learners"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ViewLearners />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/view-trainers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ViewTrainers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/vlogs"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ManageVlogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/vlogs/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <EditVlog />
          </ProtectedRoute>
        }
      />

      {/* Head Routes */}
      <Route
        path="/head/dashboard"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <HeadDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/manage-trainers"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <ManageTrainers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/manage-learners"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <ManageLearners />
          </ProtectedRoute>
        }
      />

      <Route
        path="/head/register-trainer"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <RegisterTrainer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/register-learner"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <RegisterLearner />
          </ProtectedRoute>
        }
      />

      <Route
        path="/head/edit-trainer/:trainerId"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <EditTrainer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/edit-learner/:learnerId"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <EditLearner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/schedule-session"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <ScheduleSession />
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/manage-sessions"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <ManageSessions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/head/vlogs"
        element={
          <ProtectedRoute allowedRoles={['head']}>
            <ViewVlogs />
          </ProtectedRoute>
        }
      />
      <Route path="/head/manage-assigned-programs"
        element={<ManageAssignedPrograms
        />}
      />
      <Route path="/head/manage-assigned-learning-content"
        element={<ManageAssignedLearningContent
        />}
      />

      {/* Trainer Routes */}
      <Route
        path="/trainer/dashboard"
        element={
          <ProtectedRoute allowedRoles={['trainer']}>
            <TrainerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trainer/session/:sessionId"
        element={
          <ProtectedRoute allowedRoles={['trainer']}>
            <TrainerSession />
          </ProtectedRoute>
        }
      />

      {/* Consultant Routes */}
      <Route
        path="/consultant/dashboard"
        element={
          <ProtectedRoute allowedRoles={['consultant']}>
            <ConsultantDashboard />
          </ProtectedRoute>
        }
      />

      {/* Learner Routes */}
      <Route
        path="/learner/dashboard"
        element={
          <ProtectedRoute allowedRoles={['learner']}>
            <LearnerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learner/session/:sessionId"
        element={
          <ProtectedRoute allowedRoles={['learner']}>
            <LearnerSession />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learner/learning-programs"
        element={
          <ProtectedRoute roles={['learner']}>
            <ViewAssignedPrograms />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learner/learning-program/:id"
        element={<LearningProgramDetails />}
      />



      {/* 404 - Redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </MediaControlProvider>
  );
}

export default App;
