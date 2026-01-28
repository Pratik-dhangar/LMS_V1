import React from 'react';
import { Outlet } from 'react-router-dom';
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

  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
      {/* LinkedIn-style messaging widget - only shown for authenticated users */}
      {user && <MessagingWidget />}
    </>
  );
};

export default MainLayout;
