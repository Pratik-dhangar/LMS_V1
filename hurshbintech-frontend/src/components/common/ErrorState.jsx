import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import '../../styles/components/common/ErrorState.css';

/**
 * ErrorState Component
 * 
 * Full-page error display with icon, message, and action button
 * Maintains the app layout with Navbar and Footer
 * 
 * @param {string} title - Error title/heading
 * @param {string} message - Detailed error message
 * @param {string} buttonText - Text for the action button
 * @param {string} buttonPath - Navigation path for the action button
 */
const ErrorState = ({
  title = "Error",
  message = "Something went wrong",
  buttonText = "Go Back",
  buttonPath = "/"
}) => {
  const navigate = useNavigate();

  return (
    <div className="error-state-container">
      <Navbar />
      <main className="error-state-main">
        <div className="error-state-content">
          <svg className="error-state-icon" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h2 className="error-state-title">{title}</h2>
          <p className="error-state-message">{message}</p>
          <button
            onClick={() => navigate(buttonPath)}
            className="error-state-button"
          >
            {buttonText}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ErrorState;
