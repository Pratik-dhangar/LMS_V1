import React from 'react';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import '../../styles/components/common/Loader.css';

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
    <div className="loader-container">
      <Navbar />
      <main className="loader-main">
        <div className="loader-content">
          <div className="loader-spinner"></div>
          <p className="loader-message">{message}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Loader;
