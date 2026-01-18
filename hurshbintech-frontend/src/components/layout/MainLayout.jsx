import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

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
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
};

export default MainLayout;
