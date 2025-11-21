import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <button
            onClick={() => navigate(buttonPath)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
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
