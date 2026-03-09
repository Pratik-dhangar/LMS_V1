import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AuthProvider } from './context/AuthContext';
import { MediaControlProvider } from './context/MediaControlContext';
import GoogleOAuthProvider from './components/GoogleOAuthProvider';
import { registerSW } from 'virtual:pwa-register';

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
import ManageLearningMaterials from './pages/admin/ManageLearningMaterials';
import PaymentVerification from './pages/admin/PaymentVerification';
import ViewTrainers from './pages/admin/ViewTrainers';
import ManageCoaches from './pages/admin/ManageCoaches';
import ManageVlogs from './pages/admin/ManageVlogs';
import EditVlog from './pages/admin/EditVlog';
import ManageBlogs from './pages/admin/ManageBlogs';
import CreateEditBlog from './pages/admin/CreateEditBlog';
import AdminAboutUs from './pages/admin/AdminAboutUs';
import AdminAssignedTrainings from './pages/admin/AdminAssignedTrainings';
import CreateAssignedTraining from './pages/admin/CreateAssignedTraining';
import AdminTrainingDetail from './pages/admin/AdminTrainingDetail';
import AdminContacts from './pages/admin/AdminContacts';
import AdminProfile from './pages/admin/AdminProfile';
import AdminVendors from './pages/admin/AdminVendors';
import AdminManageLearners from './pages/admin/AdminManageLearners';
import AdminLearnerProgramsView from './pages/admin/AdminLearnerProgramsView';
import AdminProgramGraphView from './pages/admin/AdminProgramGraphView';


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
import ObserverSession from './pages/head/ObserverSession';
import ViewVlogs from './pages/head/ViewVlogs';
import ManageProgramAssignments from './pages/head/ManageProgramAssignments';
import ReportCard from './pages/head/ReportCard';
import LearnerReports from './pages/head/LearnerReports';
import LearnerProgramsView from './pages/head/LearnerProgramsView';
import ProgramGraphView from './pages/head/ProgramGraphView';


// Trainer Pages
import TrainerDashboard from './pages/trainer/Dashboard';
import TrainerSession from './pages/trainer/TrainerSession';
import TodaysSchedule from './pages/trainer/TodaysSchedule';

// Coach Pages
import CoachDashboard from './pages/coach/Dashboard';
import CoachManageLearningReports from './pages/coach/CoachManageLearningReports';
import CoachSession from './pages/coach/CoachSession';
import CoachAppointments from './pages/coach/CoachAppointments';
import CoachSessions from './pages/coach/CoachSessions';
import CreateSession from './pages/coach/CreateSession';
import CoachAvailability from './pages/coach/CoachAvailability';

// Learner Pages
import LearnerDashboard from './pages/learner/Dashboard';
import LearnerSession from './pages/learner/LearnerSession';
import ViewAssignedPrograms from "./pages/learner/ViewAssignedPrograms";
import LearningProgramDetails from "./pages/learner/LearningProgramDetails";
import LearnerProgramAssignmentDetails from "./pages/learner/LearnerProgramAssignmentDetails";
import FeedbackPage from "./pages/learner/FeedbackPage";
import MySessions from "./pages/learner/MySessions";
import AssignedPrograms from "./pages/learner/AssignedPrograms";
import LearningContent from "./pages/learner/LearningContent";
import LearnerMyReports from "./pages/learner/LearnerMyReports";
import LearnerProgramGraphView from "./pages/learner/LearnerProgramGraphView";

// Client Pages
import ClientSession from './pages/client/ClientSession';
import GuestSession from './pages/guest/GuestSession';

// Common Pages
import BookAppointment from './pages/common/BookAppointment';
import BookAppointmentForm from './pages/common/BookAppointmentForm';
import MyAppointments from './pages/common/MyAppointments';
import ContactUs from './pages/common/ContactUs';
import BlogList from './pages/common/BlogList';
import BlogDetail from './pages/common/BlogDetail';
import VlogList from './pages/common/VlogList';
import VlogDetail from './pages/common/VlogDetail';
import AssignedTrainingsList from './pages/common/AssignedTrainingsList';
import TrainingDetailView from './pages/common/TrainingDetailView';
import ProfileAndOrderHistory from './pages/common/ProfileAndOrderHistory';

// Guest Booking Pages
import GuestBookingStep1 from './pages/common/GuestBookingStep1';
import GuestBookingStep2 from './pages/common/GuestBookingStep2';
import GuestBookingStep3Pending from './pages/common/GuestBookingStep3Pending';
import GuestPaymentUpload from './pages/common/GuestPaymentUpload';
import GuestPaymentUploadSuccess from './pages/common/GuestPaymentUploadSuccess';

// Store Pages (E-commerce)
import StoreCatalog from './pages/store/StoreCatalog';
import ProductDetail from './pages/store/ProductDetail';
import Cart from './pages/store/Cart';
import Checkout from './pages/store/Checkout';


// Communication Pages
import WebinarPage from './pages/communication/webinar/WebinarPage';


// Subscription Pages
import ManageSubscriptionPackages from './pages/admin/ManageSubscriptionPackages';
import LearnerSubscriptionManager from './pages/head/LearnerSubscriptionManager';
import SubscriptionRecords from './pages/admin/SubscriptionRecords';
import DiscountCodeManager from './pages/admin/DiscountCodeManager';


// Components
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import useNetworkSpeedNotifier from './hooks/useNetworkSpeedNotifier';

// Chat Components
import { ChatProvider } from './context/chat/ChatContext';
import ChatIconWidget from './components/chat/ChatIconWidget';
import UnifiedChatPage from './pages/chat/UnifiedChatPage';

import './App.css';

// Separate component for the actual app routes that uses AuthContext
function AppRoutes() {
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
      <ChatIconWidget />
      <Routes>
        {/* Routes WITHOUT Navbar/Footer (Login and Session pages) */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={getDashboardPath()} replace /> : <Login />}
        />
        <Route
          path="/trainer/session/:sessionId"
          element={
            <ProtectedRoute allowedRoles={['trainer']}>
              <TrainerSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach/session/:sessionId"
          element={
            <ProtectedRoute allowedRoles={['coach']}>
              <CoachSession />
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
          path="/client/session/:sessionId"
          element={
            <ProtectedRoute allowedRoles={['head', 'trainer', 'learner']}>
              <ClientSession />
            </ProtectedRoute>
          }
        />
        <Route path="/guest-session/:token" element={<GuestSession />} />

        {/* Routes WITH Navbar/Footer (all other pages) */}
        <Route element={<MainLayout />}>
          {/* Public Routes */}
          <Route path="" element={<Home />} />

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
            path="/admin/profile"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/vendors"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminVendors />
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
          <Route
            path="/admin/blogs"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ManageBlogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/blogs/create"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateEditBlog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/blogs/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateEditBlog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/about-us"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAboutUs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/manage-learning-materials"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ManageLearningMaterials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payment-verification"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PaymentVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assigned-trainings/create"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateAssignedTraining />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assigned-trainings/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateAssignedTraining />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assigned-trainings/:id"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminTrainingDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assigned-trainings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAssignedTrainings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/profile-order-history"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ProfileAndOrderHistory />
              </ProtectedRoute>
            }
          />

          {/* Admin Subscription Routes */}
          <Route
            path="/admin/subscriptions/packages"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ManageSubscriptionPackages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/subscriptions/discounts"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DiscountCodeManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/subscriptions/records"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SubscriptionRecords />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/contacts"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminContacts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/manage-learners"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminManageLearners />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/learner-programs/:learnerId"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLearnerProgramsView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/learner/:learnerId/program/:programName"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminProgramGraphView />
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
            path="/head/observer-session/:sessionId"
            element={
              <ProtectedRoute allowedRoles={['head']}>
                <ObserverSession />
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
          <Route
            path="/head/manage-program-assignments"
            element={
              <ProtectedRoute allowedRoles={['head']}>
                <ManageProgramAssignments />
              </ProtectedRoute>
            }
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
          <Route
            path="/head/profile-order-history"
            element={
              <ProtectedRoute allowedRoles={['head']}>
                <ProfileAndOrderHistory />
              </ProtectedRoute>
            }
          />

          {/* Head Subscription Routes */}

          <Route
            path="/head/subscriptions/learners"
            element={
              <ProtectedRoute allowedRoles={['head']}>
                <LearnerSubscriptionManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/head/subscriptions/records"
            element={
              <ProtectedRoute allowedRoles={['head']}>
                <SubscriptionRecords />
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
            path="/trainer/schedule"
            element={
              <ProtectedRoute allowedRoles={['trainer']}>
                <TodaysSchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainer/profile-order-history"
            element={
              <ProtectedRoute allowedRoles={['trainer']}>
                <ProfileAndOrderHistory />
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
          <Route
            path="/coach/appointments"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <CoachAppointments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/sessions"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <CoachSessions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/sessions/create"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <CreateSession />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/availability"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <CoachAvailability />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/profile-order-history"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <ProfileAndOrderHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/learning-reports"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <CoachManageLearningReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/learner-reports/:learnerId"
            element={
              <ProtectedRoute allowedRoles={['coach']}>
                <LearnerProgramsView />
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
            path="/learner/my-sessions"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <MySessions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/assigned-programs"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <AssignedPrograms />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/learning-content"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <LearningContent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/profile-order-history"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <ProfileAndOrderHistory />
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
          <Route
            path="/learner/program-assignment/:id"
            element={
              <ProtectedRoute allowedRoles={["learner"]}>
                <LearnerProgramAssignmentDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/feedback/:contentAssignmentId"
            element={
              <ProtectedRoute allowedRoles={["learner"]}>
                <FeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/learning-material"
            element={
              <ProtectedRoute allowedRoles={["learner"]}>
                <StoreCatalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/my-reports"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <LearnerMyReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/my-reports/:learnerId/program/:programName"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <LearnerProgramGraphView />
              </ProtectedRoute>
            }
          />

          {/* Common Routes */}
          <Route path="/contact-us" element={<ContactUs />} />
          <Route
            path="/my-appointments"
            element={
              <ProtectedRoute allowedRoles={['head', 'trainer', 'learner']}>
                <MyAppointments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book-appointment"
            element={<BookAppointment />}
          />
          <Route
            path="/book-appointment/:coachId"
            element={
              <ProtectedRoute allowedRoles={['head', 'trainer', 'learner', 'coach', 'admin']}>
                <BookAppointmentForm />
              </ProtectedRoute>
            }
          />

          {/* Guest Booking Routes */}
          <Route path="/guest-booking" element={<GuestBookingStep1 />} />
          <Route path="/guest-booking/details" element={<GuestBookingStep2 />} />
          <Route path="/guest-booking/pending" element={<GuestBookingStep3Pending />} />
          <Route path="/guest-payment/:uploadToken" element={<GuestPaymentUpload />} />
          <Route path="/guest-payment/success" element={<GuestPaymentUploadSuccess />} />

          {/* Public Blog Routes */}
          <Route path="/blogs" element={<BlogList />} />
          <Route path="/blogs/:slug" element={<BlogDetail />} />

          {/* Public Vlog Routes */}
          <Route path="/vlogs" element={<VlogList />} />
          <Route path="/vlogs/:id" element={<VlogDetail />} />

          {/* Assigned Trainings Routes */}
          <Route
            path="/assigned-trainings"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'coach', 'trainer', 'learner']}>
                <AssignedTrainingsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assigned-trainings/:id"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'coach', 'trainer', 'learner']}>
                <TrainingDetailView />
              </ProtectedRoute>
            }
          />

          {/* Store/E-commerce Routes */}
          <Route path="/store" element={<StoreCatalog />} />
          <Route path="/learning-materials" element={<StoreCatalog />} />
          <Route path="/store/product/:productId" element={<ProductDetail />} />
          <Route path="/store/cart" element={
            <ProtectedRoute allowedRoles={["learner", "trainer", "head", "admin", "coach"]}>
              <Cart />
            </ProtectedRoute>
          } />
          <Route path="/store/checkout" element={
            <ProtectedRoute allowedRoles={["learner", "trainer", "head", "admin", "coach"]}>
              <Checkout />
            </ProtectedRoute>
          } />

          {/* Communication Routes */}
          <Route
            path="/communication/webinar"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'coach', 'trainer', 'learner']}>
                <WebinarPage />
              </ProtectedRoute>
            }
          />

          {/* Chat Routes */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'coach', 'trainer', 'learner']}>
                <UnifiedChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:conversationId"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'coach', 'trainer', 'learner']}>
                <UnifiedChatPage />
              </ProtectedRoute>
            }
          />

          {/* 404 - Redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MediaControlProvider>
  );
}

function App() {
  // Register PWA Service Worker
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_PWA === 'true') {
      registerSW({
        onNeedRefresh() { },
        onOfflineReady() { },
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <GoogleOAuthProvider>
          <ChatProvider>
            <AppRoutes />
          </ChatProvider>
        </GoogleOAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
