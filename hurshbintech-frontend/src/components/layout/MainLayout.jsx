import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import MessagingWidget from '../chat/MessagingWidget';
import BuySubscriptionModal from '../common/BuySubscriptionModal';
import FreeAssessmentModal from '../common/FreeAssessmentModal';
import { useAuth } from '../../context/AuthContext';

/**
 * MainLayout Component
 * 
 * A layout wrapper that provides consistent Navbar and Footer across all pages.
 * Uses React Router's <Outlet /> to render child routes.
 * 
 * This follows the DRY principle by centralizing layout structure instead of
 * repeating Navbar and Footer imports in every page component.
 */
const MainLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);

  // Hide messaging widget on session pages
  const isSessionPage = location.pathname.includes('/session/') ||
    location.pathname.includes('/guest-session/') ||
    location.pathname.includes('/observer-session/');

  return (
    <>
      <Navbar
        setShowSubscriptionModal={setShowSubscriptionModal}
        setShowAssessmentModal={setShowAssessmentModal}
      />
      <Outlet />
      <Footer />
      {/* LinkedIn-style messaging widget - hidden on session pages */}
      {user && !isSessionPage && <MessagingWidget />}

      {/* Buy Learning Program Modal */}
      {showSubscriptionModal && (
        <BuySubscriptionModal onClose={() => setShowSubscriptionModal(false)} />
      )}

      {/* Free Assessment Modal */}
      {showAssessmentModal && (
        <FreeAssessmentModal
          isOpen={showAssessmentModal}
          onClose={() => setShowAssessmentModal(false)}
        />
      )}
    </>
  );
};

export default MainLayout;
