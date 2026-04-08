import React from 'react';
import '../../styles/components/common/Loader.css';

/**
 * Loader Component
 * 
 * Full-page loading screen with spinner and custom message.
 * Note: This loader is used within MainLayout-wrapped pages, so navbar/footer are provided by the layout.
 * 
 * @param {string} message - Optional custom loading message (default: "Loading...")
 */
const Loader = ({ message = "Loading..." }) => {
  return (
    <div className="loader-container">
      <main className="loader-main">
        <div className="loader-content">
          <div className="loader-spinner"></div>
          <p className="loader-message">{message}</p>
        </div>
      </main>
    </div>
  );
};

export default Loader;
