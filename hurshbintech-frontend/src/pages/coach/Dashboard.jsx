import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import { Calendar, Clock, User, AlertCircle, X, FileText, Check, XCircle } from 'lucide-react';
import Footer from '../../components/layout/Footer';
import AppointmentsManager from '../../components/coach/AppointmentsManager';
import SessionsManager from '../../components/coach/SessionsManager';
import AvailabilityManager from '../../components/coach/AvailabilityManager';
import coachService from '../../api/services/coachService';
import { toast } from 'react-toastify';
import '../../styles/Dashboards.css';
import '../../styles/Coach.css';

const CoachDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [appointmentsData, sessionsData] = await Promise.all([
        coachService.getMyAppointments(),
        coachService.getMySessions()
      ]);
      setAppointments(appointmentsData);
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const sessionStats = [
    { label: 'Total Sessions', value: sessions.length },
    { label: 'Completed', value: sessions.filter(s => s.status === 'completed').length },
    { label: 'Scheduled', value: sessions.filter(s => s.status === 'scheduled').length },
  ];

  return (
    <div className="dashboard-container">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <div className="consultant-page">
          <div className="consultant-content">
            {/* Header */}
            <div className="dashboard-header-flex">
              <h1 className="dashboard-title">Coach Dashboard</h1>
              <div className="dashboard-welcome">
                Welcome back, <span className="dashboard-welcome-name">{user?.name}</span>!
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="coach-tabs">
              <button
                className={`coach-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`coach-tab ${activeTab === 'appointments' ? 'active' : ''}`}
                onClick={() => setActiveTab('appointments')}
              >
                Appointments
              </button>
              <button
                className={`coach-tab ${activeTab === 'sessions' ? 'active' : ''}`}
                onClick={() => setActiveTab('sessions')}
              >
                Sessions
              </button>
              <button
                className={`coach-tab ${activeTab === 'availability' ? 'active' : ''}`}
                onClick={() => setActiveTab('availability')}
              >
                Availability
              </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Stats Grid */}
                <div className="stats-grid">
                  {sessionStats.map((stat, index) => (
                    <div key={index} className="stat-card">
                      <div className="stat-label">{stat.label}</div>
                      <div className={`stat-value stat-value-${index === 0 ? 'blue' : index === 1 ? 'green' : 'blue'}`}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upcoming Appointments */}
                <div className="consultant-card">
                  <h3 className="consultant-card-title">Upcoming Appointments</h3>
                  <p className="text-sm text-gray-600 mb-4">Appointments scheduled by other users (read-only)</p>
                  <div className="consultant-list">
                    {loading ? (
                      <p className="text-gray-500">Loading appointments...</p>
                    ) : appointments.length === 0 ? (
                      <p className="text-gray-500">No upcoming appointments</p>
                    ) : (
                      appointments.slice(0, 5).map((appointment, index) => (
                        <div key={index} className="consultant-list-item consultant-list-item-green">
                           <div className="flex items-center gap-2 mb-2">
                    <Calendar className="icon-sm text-blue-600" />
                    <span className="font-semibold">
                      {new Date(appointment.scheduled_date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short',
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                          <div className="consultant-client">
                            {appointment.user_name || 'User'} - Appointment
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="consultant-card">
                  <h3 className="consultant-search-title">Quick Actions</h3>
                  <div className="consultant-library-grid">
                    <button
                      onClick={() => setActiveTab('sessions')}
                      className="consultant-library-item cursor-pointer hover:bg-gray-50"
                    >
                      <h4 className="consultant-library-title">Create Session</h4>
                      <p className="consultant-library-desc">Schedule group coaching session with learners, trainers, and heads</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('availability')}
                      className="consultant-library-item cursor-pointer hover:bg-gray-50"
                    >
                      <h4 className="consultant-library-title">My Availability</h4>
                      <p className="consultant-library-desc">Set availability & time slots</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('appointments')}
                      className="consultant-library-item cursor-pointer hover:bg-gray-50"
                    >
                      <h4 className="consultant-library-title">View Appointments</h4>
                      <p className="consultant-library-desc">See all scheduled appointments</p>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Appointments Tab */}
            {activeTab === 'appointments' && <AppointmentsManager />}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && <SessionsManager />}

            {/* Availability Tab */}
            {activeTab === 'availability' && <AvailabilityManager />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CoachDashboard;
