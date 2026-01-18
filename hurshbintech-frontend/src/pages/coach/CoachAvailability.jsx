import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AvailabilityManager from '../../components/coach/AvailabilityManager';
import '../../styles/coach/CoachAvailability.css';

const CoachAvailability = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/coach/dashboard")}
              className="back-button"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>
            <div>
              <h1 className="page-title">Manage Availability</h1>
              <p className="page-description">
                Manage your coaching availability and time slots
              </p>
            </div>
          </div>

          {/* Availability Manager Component */}
          <div className="coach-availability-content">
            <AvailabilityManager />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachAvailability;
