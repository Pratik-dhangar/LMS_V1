import React, { useEffect } from 'react';
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
import RegisterCoach from './pages/admin/RegisterCoach';
import EditCoach from './pages/admin/EditCoach';
import ManageLearningGoals from './pages/admin/ManageLearningGoals';
import ManageLearningContent from './pages/admin/ManageLearningContent';
import ViewLearners from './pages/admin/ViewLearners';
import ViewTrainers from './pages/admin/ViewTrainers';
import ManageCoaches from './pages/admin/ManageCoaches';
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
import ReportCard from './pages/head/ReportCard';
import LearnerReports from './pages/head/LearnerReports';
import LearnerProgramsView from './pages/head/LearnerProgramsView';
import ProgramGraphView from './pages/head/ProgramGraphView';


// Trainer Pages
import TrainerDashboard from './pages/trainer/Dashboard';
import TrainerSession from './pages/trainer/TrainerSession';

// Coach Pages
import CoachDashboard from './pages/coach/Dashboard';

// Learner Pages
import LearnerDashboard from './pages/learner/Dashboard';
import LearnerSession from './pages/learner/LearnerSession';
import ViewAssignedPrograms from "./pages/learner/ViewAssignedPrograms";
import LearningProgramDetails from "./pages/learner/LearningProgramDetails";

// Common Pages
import BookAppointment from './pages/common/BookAppointment';
import BookAppointmentForm from './pages/common/BookAppointmentForm';



// Components
import ProtectedRoute from './components/ProtectedRoute';
import useNetworkSpeedNotifier from './hooks/useNetworkSpeedNotifier';

import './App.css';

function App() {
  const { isAuthenticated, user } = useAuth();

  useNetworkSpeedNotifier();

  // Lock orientation to landscape on mobile and tablet devices
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        // Check if Screen Orientation API is supported
        if (screen.orientation && screen.orientation.lock) {
          // Attempt to lock to landscape
          await screen.orientation.lock('landscape-primary').catch(() => {
            // Fallback to 'landscape' if 'landscape-primary' is not supported
            return screen.orientation.lock('landscape');
          });
          console.log('✅ Orientation locked to landscape');
        } else if (screen.lockOrientation) {
          // Older API fallback
          screen.lockOrientation('landscape-primary') || screen.lockOrientation('landscape');
          console.log('✅ Orientation locked to landscape (legacy API)');
        } else {
          console.log('ℹ Screen orientation lock not supported on this device');
        }
      } catch (error) {
        // Orientation lock may fail if not in fullscreen or not supported
        console.log('ℹ Could not lock orientation:', error.message);
      }
    };

    // Only lock on mobile/tablet (not desktop)
    const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth <= 1366);

    if (isMobileOrTablet) {
      lockOrientation();
    }
  }, []);

  // Determine dashboard based on user role
  const getDashboardPath = () => {
    if (!user) return '/';
    const dashboards = {
      admin: '/admin/dashboard',
      head: '/head/dashboard',
      trainer: '/trainer/dashboard',
      coach: '/coach/dashboard',
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
          path="/admin/manage-coaches"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ManageCoaches />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/register-coach"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RegisterCoach />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/edit-coach/:coachId"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <EditCoach />
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
        <Route
          path="/head/reports"
          element={
            <ProtectedRoute allowedRoles={['head']}>
              <ReportCard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/head/learner-reports/:learnerId"
          element={
            <ProtectedRoute allowedRoles={['head']}>
              <LearnerProgramsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/head/learner/:learnerId/program/:programName"
          element={
            <ProtectedRoute allowedRoles={['head']}>
              <ProgramGraphView />
            </ProtectedRoute>
          }
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

        {/* Coach Routes */}
        <Route
          path="/coach/dashboard"
          element={
            <ProtectedRoute allowedRoles={['coach']}>
              <CoachDashboard />
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
          path="/book-appointment"
          element={
            <ProtectedRoute allowedRoles={['head', 'trainer', 'learner']}>
              <BookAppointment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/book-appointment/:coachId"
          element={
            <ProtectedRoute allowedRoles={['head', 'trainer', 'learner']}>
              <BookAppointmentForm />
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
