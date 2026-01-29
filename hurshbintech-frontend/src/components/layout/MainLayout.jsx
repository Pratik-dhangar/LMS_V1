import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import MessagingWidget from '../chat/MessagingWidget';
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

  // Hide messaging widget on session pages
  const isSessionPage = location.pathname.includes('/session/') || 
                        location.pathname.includes('/guest-session/') || 
                        location.pathname.includes('/observer-session/');

  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
      {/* LinkedIn-style messaging widget - hidden on session pages */}
      {user && !isSessionPage && <MessagingWidget />}
    </>
  );
};

export default MainLayout;
