import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import AppointmentsManager from '../../components/coach/AppointmentsManager';
import '../../styles/coach/CoachAppointments.css';

const CoachAppointments = () => {
  const { user } = useAuth();

  return (
    <div className="coach-appointments-container">
      <Navbar />
      <main className="coach-appointments-main">
        <div className="coach-appointments-content-wrapper">
          {/* Header */}
          <div className="coach-appointments-header">
            <h1 className="coach-appointments-title">My Appointments</h1>
            <p className="coach-appointments-subtitle">
              Appointments are scheduled by other users (Heads, Trainers, Learners). You cannot create appointments yourself.
            </p>
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