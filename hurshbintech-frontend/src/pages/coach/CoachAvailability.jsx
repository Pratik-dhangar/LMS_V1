import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import AvailabilityManager from '../../components/coach/AvailabilityManager';
import '../../styles/coach/CoachAvailability.css';

const CoachAvailability = () => {
  const { user } = useAuth();

  return (
    <div className="coach-availability-container">
      <Navbar />
      <main className="coach-availability-main">
        <div className="coach-availability-content-wrapper">
          {/* Header */}
          <div className="coach-availability-header">
            <h1 className="coach-availability-title">My Availability</h1>
            <p className="coach-availability-subtitle">
              Set your availability and manage time slots for appointments
            </p>
          </div>

          {/* Availability Manager Component */}
          <div className="coach-availability-content">
            <AvailabilityManager />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CoachAvailability;
