import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, AlertCircle, FileText, MapPin, Phone, Download, Video } from 'lucide-react';
import { toast } from 'react-toastify';
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import bookingService from "../../api/services/bookingService";
import coachSessionService from "../../api/services/coachSessionService";
import { getFileUrl } from "../../utils/urlHelper";
import "../../styles/Pages.css";
import "../../styles/BookAppointment.css";

const MyAppointments = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [joiningSession, setJoiningSession] = useState(false);

  useEffect(() => {
    fetchMyAppointments();
  }, []);

  const fetchMyAppointments = async () => {
    try {
      setLoading(true);
      const data = await bookingService.getMyAppointments();
      setAppointments(data || []);
      setError(null);
    } catch (err) {
      setError(err.detail || 'Failed to fetch appointments');
      console.error('Error fetching appointments:', err);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const normalizedStatus = status?.toUpperCase();
    const statusColors = {
      'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'CONFIRMED': 'bg-green-100 text-green-800 border-green-200',
      'CANCELLED': 'bg-red-100 text-red-800 border-red-200',
      'COMPLETED': 'bg-blue-100 text-blue-800 border-blue-200',
      'REJECTED': 'bg-red-100 text-red-800 border-red-200',
      'NO_SHOW': 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatStatus = (status) => {
    return status?.toUpperCase().replace(/_/g, ' ') || 'Unknown';
  };

  const formatSessionType = (session_type) => {
    const sessionTypeMap = {
      'initial_consultation': 'Initial Consultation',
      'follow_up': 'Follow-up Session',
      'extended': 'Extended Session',
    };
    
    if (!session_type) return 'General Coaching Session';
    return sessionTypeMap[session_type] || session_type;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    // If already formatted, return as is
    if (timeString.includes(':')) return timeString;
    // Convert "10am" to "10:00 AM"
    const match = timeString.match(/(\d+)(am|pm)/i);
    if (match) {
      const hour = match[1];
      const period = match[2].toUpperCase();
      return `${hour}:00 ${period}`;
    }
    return timeString;
  };

  const handleJoinSession = async (appointment) => {
    try {
      setJoiningSession(true);
      
      // Get client sessions to check if session already exists
      const sessions = await coachSessionService.getClientSessions();
      const existingSession = sessions.find(s => s.appointment_id === appointment.id);
      
      if (existingSession) {
        // Session exists, join it
        await coachSessionService.joinSession(existingSession.session_id);
        navigate(`/client/session/${existingSession.session_id}`);
      } else {
        toast.error('Session not started by coach yet');
      }
    } catch (err) {
      console.error('Error joining session:', err);
      toast.error(err.response?.data?.detail || 'Failed to join session');
    } finally {
      setJoiningSession(false);
    }
  };

  const isSessionJoinable = (appointment) => {
    // Session can be joined if:
    // 1. Appointment is CONFIRMED
    // 2. Coach has started the session (we'll check this when clicking join)
    return appointment.status?.toUpperCase() === 'CONFIRMED';
  };

  // Filter appointments based on selected filters
  const filteredAppointments = appointments.filter(apt => {
    // Filter by date
    if (filterDate) {
      const appointmentDate = new Date(apt.scheduled_date).toISOString().split('T')[0];
      if (appointmentDate !== filterDate) return false;
    }

    // Filter by time
    if (filterTime) {
      const appointmentTime = apt.scheduled_time?.replace(/\s/g, '').toLowerCase();
      const filterTimeNorm = filterTime.replace(/\s/g, '').toLowerCase();
      if (!appointmentTime?.includes(filterTimeNorm)) return false;
    }

    // Filter by status
    if (filterStatus) {
      if (apt.status?.toUpperCase() !== filterStatus) return false;
    }

    return true;
  });

  const clearFilters = () => {
    setFilterDate('');
    setFilterTime('');
    setFilterStatus('');
  };

  const hasActiveFilters = filterDate || filterTime || filterStatus;

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <main className="page-main">
          <div className="page-content">
            <div className="stat-loading">Loading your appointments...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">My Appointments</h1>
            <p className="page-subtitle">View and manage your scheduled coaching appointments</p>
          </div>

          {error && (
            <div className="stat-error mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          )}

          {/* Filter Section */}
          <div className="appointments-filter-section">
            <div className="filter-controls">
              <div className="filter-group">
                <label htmlFor="filter-date" className="filter-label">Date</label>
                <input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="filter-time" className="filter-label">Time</label>
                <input
                  id="filter-time"
                  type="text"
                  placeholder="e.g., 10am, 2:30 PM"
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status" className="filter-label">Status</label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-input"
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="filter-clear-btn"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <div className="filter-results-info">
                Showing {filteredAppointments.length} of {appointments.length} appointments
              </div>
            )}
          </div>

          {/* Appointments Grid - 2 Columns */}
          <div className="appointments-grid">
            {filteredAppointments.length === 0 ? (
              <div className="empty-state text-center py-12 col-span-2">
                <Calendar className="empty-state-icon mx-auto mb-4" style={{ width: '64px', height: '64px', color: '#9ca3af' }} />
                <p className="empty-state-title text-lg font-semibold mb-2">
                  {appointments.length === 0 ? 'No appointments yet' : 'No appointments match your filters'}
                </p>
                <p className="empty-state-description text-gray-600 mb-4">
                  {appointments.length === 0 
                    ? "You haven't booked any appointments with coaches"
                    : 'Try adjusting your filter criteria'
                  }
                </p>
                {appointments.length === 0 && (
                  <a href="/book-appointment" className="btn-primary inline-block">
                    Book Your First Appointment
                  </a>
                )}
                {appointments.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="btn-primary inline-block"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              filteredAppointments.map(apt => (
                <div key={apt.id} className="appointment-card">
                  {/* Card Header with Status */}
                  <div className="appointment-card-header">
                    <span className={`appointment-status-badge ${getStatusColor(apt.status)}`}>
                      {formatStatus(apt.status)}
                    </span>
                    <span className="appointment-id">
                      #{apt.id}
                    </span>
                  </div>

                  {/* Coach Info */}
                  <div className="appointment-coach-section">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-5 h-5 text-blue-600" />
                      <span className="appointment-label">Coach</span>
                    </div>
                    <p className="appointment-coach-name">Coach (ID: {apt.coach_id})</p>
                  </div>

                  {/* Date & Time */}
                  <div className="appointment-details">
                    <div className="appointment-detail-item">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="appointment-detail-label">Date</p>
                        <p className="appointment-detail-value">{formatDate(apt.scheduled_date)}</p>
                      </div>
                    </div>

                    <div className="appointment-detail-item">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="appointment-detail-label">Time</p>
                        <p className="appointment-detail-value">{formatTime(apt.scheduled_time)}</p>
                      </div>
                    </div>

                    <div className="appointment-detail-item">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="appointment-detail-label">Session Type</p>
                        <p className="appointment-detail-value">{formatSessionType(apt.session_type)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {apt.notes && (
                    <div className="appointment-notes-section">
                      <p className="appointment-detail-label">Notes</p>
                      <p className="appointment-notes-content">
                        {apt.notes}
                      </p>
                    </div>
                  )}

                  {/* Rejection Reason - For Rejected Appointments */}
                  {apt.status?.toUpperCase() === 'REJECTED' && apt.rejection_reason && (
                    <div className="appointment-rejection-section" style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
                      <p className="appointment-detail-label" style={{ color: '#991b1b', fontWeight: '600' }}>Rejection Reason</p>
                      <p className="appointment-notes-content" style={{ color: '#7f1d1d', marginTop: '6px' }}>
                        {apt.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Refund Receipt - For Rejected Appointments */}
                  {apt.status?.toUpperCase() === 'REJECTED' && apt.refund_receipt_url && (
                    <div className="appointment-refund-section" style={{ marginBottom: '12px' }}>
                      <p className="appointment-detail-label" style={{ marginBottom: '8px' }}>Refund Receipt</p>
                      <a
                        href={getFileUrl(apt.refund_receipt_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Download className="w-4 h-4" />
                        View Refund Receipt
                      </a>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="appointment-footer">
                    <p className="appointment-timestamp">
                      Booked on: {new Date(apt.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Join Session Button - Only for CONFIRMED appointments */}
                  {apt.status?.toUpperCase() === 'CONFIRMED' && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleJoinSession(apt)}
                        disabled={!isSessionJoinable(apt) || joiningSession}
                        className={`w-full px-4 py-3 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                          isSessionJoinable(apt) && !joiningSession
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={!isSessionJoinable(apt) ? 'Wait for coach to start the session' : 'Join video session'}
                      >
                        <Video className="w-5 h-5" />
                        {joiningSession ? 'Joining...' : 'Join Session'}
                      </button>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Session will be available when coach starts it
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MyAppointments;
