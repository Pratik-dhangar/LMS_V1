import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import AppointmentsManager from '../../components/coach/AppointmentsManager';
import '../../styles/coach/CoachAppointments.css';

const CoachAppointments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="page-container">
      <Navbar />
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
              <h1 className="page-title">
                Manage Appointments
              </h1>
              <p className="page-description">
                View and manage your scheduled appointments
              </p>
            </div>
          </div>

          {/* Appointments Manager Component */}
          <div className="coach-appointments-content">
            <AppointmentsManager />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CoachAppointments;
