import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SessionsManager from '../../components/coach/SessionsManager';
import '../../styles/coach/CoachSessions.css';

const CoachSessions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate('/coach/dashboard')}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>
            <div>
              <h1 className="page-title">Manage Sessions</h1>
              <p className="page-description">
                Create and manage group coaching sessions with learners, trainers, and heads
              </p>
            </div>
          </div>

          {/* Sessions Manager Component */}
          <div className="coach-sessions-content">
            <SessionsManager />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoachSessions;
