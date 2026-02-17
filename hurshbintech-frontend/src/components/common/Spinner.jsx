import React from 'react';
import '../../styles/components/common/Loader.css';

/**
 * Spinner Component
 * 
 * Simple loading spinner without layout (Navbar/Footer)
 * Use this inside pages that are already wrapped in MainLayout
 * 
 * @param {string} message - Optional custom loading message (default: "Loading...")
 */
const Spinner = ({ message = "Loading..." }) => {
  return (
    <div className="loader-main">
      <div className="loader-content">
        <div className="loader-spinner"></div>
        <p className="loader-message">{message}</p>
      </div>
    </div>
  );
};

export default Spinner;
