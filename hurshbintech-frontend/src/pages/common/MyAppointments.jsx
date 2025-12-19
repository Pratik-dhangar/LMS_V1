import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, AlertCircle, FileText, MapPin, Phone } from 'lucide-react';
import { toast } from 'react-toastify';
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import bookingService from "../../api/services/bookingService";
import "../../styles/Pages.css";
import "../../styles/BookAppointment.css";

const MyAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const formatSessionType = (notes) => {
    if (!notes) return 'N/A';
    const match = notes.match(/Session Type: ([^\n]+)/);
    if (match) {
      return match[1].split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    return 'N/A';
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

          {/* Appointments Grid */}
          <div className="appointments-grid">
            {appointments.length === 0 ? (
              <div className="empty-state text-center py-12">
                <Calendar className="empty-state-icon mx-auto mb-4" style={{ width: '64px', height: '64px', color: '#9ca3af' }} />
                <p className="empty-state-title text-lg font-semibold mb-2">No appointments yet</p>
                <p className="empty-state-description text-gray-600 mb-4">
                  You haven't booked any appointments with coaches
                </p>
                <a href="/book-appointment" className="btn-primary inline-block">
                  Book Your First Appointment
                </a>
              </div>
            ) : (
              appointments.map(apt => (
                <div key={apt.id} className="appointment-card">
                  {/* Status Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(apt.status)}`}>
                      {formatStatus(apt.status)}
                    </span>
                    <span className="text-xs text-gray-500">
                      ID: #{apt.id}
                    </span>
                  </div>

                  {/* Coach Info */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">Coach</span>
                    </div>
                    <p className="text-gray-700 ml-7">Coach (ID: {apt.coach_id})</p>
                  </div>

                  {/* Date & Time */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Date</p>
                        <p className="text-gray-900 font-medium">{formatDate(apt.scheduled_date)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Time</p>
                        <p className="text-gray-900 font-medium">{formatTime(apt.scheduled_time)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Session Type</p>
                        <p className="text-gray-900 font-medium">{formatSessionType(apt.notes)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {apt.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 mb-2">Notes</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                        {apt.notes}
                      </p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Booked on: {new Date(apt.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
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
