import React, { useState, useEffect } from 'react';
import coachService from '../../api/services/coachService';
import { Calendar, Clock, User, AlertCircle } from 'lucide-react';
import '../../styles/Dashboards.css';

const AppointmentsManager = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await coachService.getMyAppointments();
      setAppointments(data || []);
      setError(null);
    } catch (err) {
      setError(err.detail || 'Failed to fetch appointments');
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="stat-loading">Loading appointments...</div>;
  }

  return (
    <div className="appointments-manager">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">My Appointments</h2>
        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
          <AlertCircle className="icon-sm" />
          <p className="text-sm">
            Appointments are scheduled by other users (Heads, Trainers, Learners). You cannot create appointments yourself.
          </p>
        </div>
      </div>

      {error && (
        <div className="stat-error mb-4 flex items-center gap-2">
          <AlertCircle className="icon-sm" />
          <p>{error}</p>
        </div>
      )}

      {/* Appointments List */}
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <div className="empty-state text-center py-12">
            <Calendar className="empty-state-icon mx-auto mb-4" style={{ width: '64px', height: '64px', color: '#9ca3af' }} />
            <p className="empty-state-title text-lg font-semibold mb-2">No appointments scheduled yet</p>
            <p className="empty-state-description text-gray-600">
              When other users schedule appointments with you, they will appear here
            </p>
          </div>
        ) : (
          appointments.map(apt => (
            <div key={apt.id} className="session-card">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="icon-sm text-blue-600" />
                    <span className="font-semibold">
                      {new Date(apt.scheduled_date).toLocaleDateString()}
                    </span>
                    <Clock className="icon-sm text-gray-500 ml-2" />
                    <span>{apt.scheduled_time}</span>
                  </div>
                  
                  {apt.user_name && (
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <User className="icon-sm" />
                      <span>With: {apt.user_name}</span>
                    </div>
                  )}
                  
                  <div className="mt-2">
                    <span className={`status-badge status-${apt.status || 'scheduled'}`}>
                      {apt.status || 'scheduled'}
                    </span>
                  </div>
                  
                  {apt.notes && (
                    <p className="text-sm text-gray-600 mt-3 p-3 bg-gray-50 rounded">
                      <strong>Notes:</strong> {apt.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AppointmentsManager;
