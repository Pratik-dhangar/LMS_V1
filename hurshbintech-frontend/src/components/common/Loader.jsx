import React from 'react';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';

/**
 * Loader Component
 * 
 * Full-page loading screen with spinner and custom message
 * Maintains the app layout with Navbar and Footer
 * 
 * @param {string} message - Optional custom loading message (default: "Loading...")
 */
const Loader = ({ message = "Loading..." }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">{message}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Loader;
