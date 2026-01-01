import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import coachService from '../../api/services/coachService';
import coachSessionService from '../../api/services/coachSessionService';
import { Calendar, Clock, User, AlertCircle, X, FileText, Check, XCircle, Mail, Phone, Video } from 'lucide-react';
import { toast } from 'react-toastify';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/Dashboards.css';
import '../../styles/Coach.css';

const AppointmentsManager = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [refundReceipt, setRefundReceipt] = useState(null);
  const [refundPreview, setRefundPreview] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAppointment(null);
  };

  const handleOpenRejectModal = () => {
    setShowRejectModal(true);
  };

  const handleCloseRejectModal = () => {
    setShowRejectModal(false);
    setRejectReason('');
    setRefundReceipt(null);
    setRefundPreview(null);
  };

  const handleRefundReceiptChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size should be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      setRefundReceipt(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefundPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeRefundReceipt = () => {
    setRefundReceipt(null);
    setRefundPreview(null);
  };

  const handleRejectAppointment = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setUpdating(true);

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('rejection_reason', rejectReason);
      
      if (refundReceipt) {
        submitData.append('refund_receipt', refundReceipt);
      }

      await coachService.rejectAppointment(selectedAppointment.id, submitData);

      // Update local state
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === selectedAppointment.id
            ? { ...apt, status: 'REJECTED', rejection_reason: rejectReason, refund_receipt_url: refundPreview }
            : apt
        )
      );

      // Update selected appointment
      if (selectedAppointment?.id) {
        setSelectedAppointment(prev => ({
          ...prev,
          status: 'REJECTED',
          rejection_reason: rejectReason,
          refund_receipt_url: refundPreview
        }));
      }

      toast.success('Appointment rejected successfully!');
      handleCloseRejectModal();
      closeModal();
    } catch (err) {
      console.error('Error rejecting appointment:', err);
      toast.error(err.response?.data?.detail || 'Failed to reject appointment');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      setUpdating(true);
      // Convert status to lowercase to match backend enum values
      const statusValue = newStatus.toLowerCase();
      await coachService.updateAppointmentStatus(appointmentId, statusValue);
      
      // Update local state with lowercase status
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId ? { ...apt, status: statusValue } : apt
        )
      );
      
      // Update selected appointment if modal is open
      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment(prev => ({ ...prev, status: statusValue }));
      }
      
      toast.success(`Appointment ${newStatus.toLowerCase()} successfully!`);
    } catch (err) {
      console.error('Error updating appointment status:', err);
      toast.error(err.response?.data?.detail || 'Failed to update appointment status');
    } finally {
      setUpdating(false);
    }
  };

  const handleStartSession = async (appointment) => {
    try {
      setUpdating(true);
      
      // First check if session already exists for this appointment
      console.log('Checking for existing session for appointment:', appointment.id);
      const coachSessions = await coachSessionService.getCoachSessions();
      const existingSession = coachSessions.find(s => s.appointment_id === appointment.id);
      
      let session;
      if (existingSession) {
        console.log('Found existing session:', existingSession);
        session = existingSession;
        
        // If session is scheduled, start it
        if (session.status === 'scheduled') {
          console.log('Starting existing session:', session.session_id);
          const startedSession = await coachSessionService.startSession(session.session_id);
          console.log('Session started:', startedSession);
          session = startedSession;
        } else {
          console.log('Session already in progress, status:', session.status);
        }
      } else {
        // Create new session from appointment
        console.log('Creating new session for appointment:', appointment.id);
        session = await coachSessionService.createSessionFromAppointment(appointment.id);
        console.log('Session created:', session);
        
        // Start the newly created session
        console.log('Starting session:', session.session_id);
        const startedSession = await coachSessionService.startSession(session.session_id);
        console.log('Session started:', startedSession);
        session = startedSession;
      }
      
      // Navigate to coach session page
      toast.success('Joining session...');
      navigate(`/coach/session/${session.session_id}`);
    } catch (err) {
      console.error('Error starting session:', err);
      console.error('Error response:', err.response);
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to start session';
      toast.error(errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  const isSessionStartable = (appointment) => {
    // Session can be started if:
    // 1. Appointment is CONFIRMED
    // 2. Current time is within appointment time range (e.g., ±30 minutes)
    if (appointment.status?.toUpperCase() !== 'CONFIRMED') return false;
    
    const now = new Date();
    const appointmentDate = new Date(appointment.scheduled_date);
    
    // Extract hour from time string (e.g., "10am" -> 10)
    const timeMatch = appointment.scheduled_time?.match(/(\d+)(am|pm)/i);
    if (!timeMatch) return false;
    
    let hour = parseInt(timeMatch[1]);
    const period = timeMatch[2].toLowerCase();
    
    // Convert to 24-hour format
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    
    appointmentDate.setHours(hour, 0, 0, 0);
    
    // Allow starting 30 minutes before and up to 2 hours after scheduled time
    const startWindow = new Date(appointmentDate.getTime() - 30 * 60 * 1000); // 30 min before
    const endWindow = new Date(appointmentDate.getTime() + 120 * 60 * 1000); // 2 hours after
    
    return now >= startWindow && now <= endWindow;
  };

  const formatSessionType = (type) => {
    if (!type) return 'N/A';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

      {/* Filter Section */}
      <div className="appointments-filter-section">
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="filter-date-coach" className="filter-label">Date</label>
            <input
              id="filter-date-coach"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="filter-time-coach" className="filter-label">Time</label>
            <input
              id="filter-time-coach"
              type="text"
              placeholder="e.g., 10am, 2:30 PM"
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="filter-status-coach" className="filter-label">Status</label>
            <select
              id="filter-status-coach"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-input"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>          
              <option value="REJECTED">Rejected</option>
              <option value="GUEST_INTENT">Guest Intent</option>
              <option value="VERIFICATION_PENDING">Payment Review</option>
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

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="empty-state text-center py-12">
            <Calendar className="empty-state-icon mx-auto mb-4" style={{ width: '64px', height: '64px', color: '#9ca3af' }} />
            <p className="empty-state-title text-lg font-semibold mb-2">
              {appointments.length === 0 ? 'No appointments scheduled yet' : 'No appointments match your filters'}
            </p>
            <p className="empty-state-description text-gray-600">
              {appointments.length === 0 
                ? 'When other users schedule appointments with you, they will appear here'
                : 'Try adjusting your filter criteria'
              }
            </p>
            {appointments.length > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          filteredAppointments.map(apt => (
            <div key={apt.id} className="session-card">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  {/* Guest Badge */}
                  {apt.guest_name && (
                    <div className="mb-2">
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-semibold">
                        GUEST BOOKING
                      </span>
                    </div>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="icon-sm text-blue-600" />
                    <span className="font-semibold">
                      {new Date(apt.scheduled_date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short',
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  
                  {/* Time */}
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="icon-sm text-gray-500" />
                    <span className="text-gray-700">{apt.scheduled_time}</span>
                  </div>
                  
                  {/* User Name */}
                  <div className="flex items-center gap-2 mb-3">
                    <User className="icon-sm text-green-600" />
                    <span className="text-gray-700 font-medium">{apt.guest_name || apt.user_name || 'Unknown User'}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{apt.user_role || (apt.guest_name ? 'Guest' : '')}</span>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="mt-2">
                    <span className={`status-badge status-${apt.status || 'scheduled'} text-xs bg-gray-300`}>
                      {apt.status || 'scheduled'}
                    </span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {/* Start Session Button - Only for CONFIRMED appointments */}
                  {apt.status?.toUpperCase() === 'CONFIRMED' && (
                    <button
                      onClick={() => handleStartSession(apt)}
                      disabled={!isSessionStartable(apt) || updating}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
                        isSessionStartable(apt) && !updating
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      title={!isSessionStartable(apt) ? 'Session can be started 30 minutes before scheduled time' : 'Start video session now'}
                    >
                      <Video className="w-4 h-4" />
                      {updating ? 'Starting...' : 'Start Session'}
                    </button>
                  )}
                  
                  {/* View Details Button */}
                  <button
                    onClick={() => handleViewDetails(apt)}
                    className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal for Appointment Details */}
      {showModal && selectedAppointment && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            {/* Modal Header */}
            <div className="modal-header">
              <h3 className="modal-title">Appointment Details</h3>
              <button onClick={closeModal} className="modal-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body space-y-4">
              {/* Guest Badge */}
              {selectedAppointment.guest_name && (
                <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                  <p className="text-sm font-semibold text-orange-900">Guest Booking</p>
                </div>
              )}

              {/* Client Name */}
              <div className="detail-row">
                <label className="detail-label">
                  <User className="icon-sm" />
                  {selectedAppointment.guest_name ? 'Guest Name' : 'Client Name'}
                </label>
                <p className="detail-value">{selectedAppointment.guest_name || selectedAppointment.user_name || 'Unknown User'}</p>
              </div>

              {/* Guest Contact Info */}
              {selectedAppointment.guest_name && (
                <>
                  <div className="detail-row">
                    <label className="detail-label">
                      <Mail className="icon-sm" />
                      Guest Email
                    </label>
                    <p className="detail-value">
                      <a href={`mailto:${selectedAppointment.guest_email}`} className="text-blue-600 hover:underline">
                        {selectedAppointment.guest_email}
                      </a>
                    </p>
                  </div>
                  <div className="detail-row">
                    <label className="detail-label">
                      <Phone className="icon-sm" />
                      Guest Phone
                    </label>
                    <p className="detail-value">
                      <a href={`tel:${selectedAppointment.guest_phone}`} className="text-blue-600 hover:underline">
                        {selectedAppointment.guest_phone}
                      </a>
                    </p>
                  </div>
                </>
              )}

              {/* Date */}
              <div className="detail-row">
                <label className="detail-label">
                  <Calendar className="icon-sm" />
                  Date
                </label>
                <p className="detail-value">
                  {new Date(selectedAppointment.scheduled_date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>

              {/* Time */}
              <div className="detail-row">
                <label className="detail-label">
                  <Clock className="icon-sm" />
                  Time
                </label>
                <p className="detail-value">{selectedAppointment.scheduled_time}</p>
              </div>

              {/* Session Type */}
              <div className="detail-row">
                <label className="detail-label">
                  <FileText className="icon-sm" />
                  Session Type
                </label>
                <p className="detail-value">{formatSessionType(selectedAppointment.session_type)}</p>
              </div>

              {/* Payment Screenshot */}
              {selectedAppointment.payment_screenshot_url && (
                <div className="detail-row">
                  <label className="detail-label">Payment Screenshot</label>
                  <div className="mt-2">
                    <a
                      href={getFileUrl(selectedAppointment.payment_screenshot_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Payment Screenshot
                    </a>
                  </div>
                </div>
              )}

              {/* Payment Receipt - Guest Booking */}
              {selectedAppointment.payment_receipt_url && selectedAppointment.guest_name && (
                <div className="detail-row">
                  <label className="detail-label">
                    <FileText className="icon-sm" />
                    Payment Receipt
                  </label>
                  <div className="mt-2">
                    <a
                      href={getFileUrl(selectedAppointment.payment_receipt_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Payment Receipt
                    </a>
                  </div>
                  {selectedAppointment.status === 'VERIFICATION_PENDING' && (
                    <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded text-sm text-yellow-900">
                      Review the payment receipt and confirm to complete the booking.
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="detail-row">
                  <label className="detail-label">Additional Notes</label>
                  <p className="detail-value text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="detail-row">
                <label className="detail-label">Status</label>
                <span className={`status-badge status-${selectedAppointment.status || 'scheduled'}`}>
                  {selectedAppointment.status || 'scheduled'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              {(selectedAppointment.status === 'PENDING' || selectedAppointment.status === 'pending' || selectedAppointment.status === 'GUEST_INTENT' || selectedAppointment.status === 'VERIFICATION_PENDING') && (
                <>
                  <button 
                    onClick={handleOpenRejectModal}
                    className="btn-secondary flex items-center gap-2"
                    disabled={updating}
                  >
                    <XCircle className="w-4 h-4" />
                    {updating ? 'Updating...' : 'Reject'}
                  </button>
                  <button 
                    onClick={() => handleStatusUpdate(selectedAppointment.id, 'CONFIRMED')}
                    className="btn-primary flex items-center gap-2"
                    disabled={updating}
                  >
                    <Check className="w-4 h-4" />
                    {updating ? 'Updating...' : selectedAppointment.status === 'GUEST_INTENT' ? 'Send Payment Link' : selectedAppointment.status === 'VERIFICATION_PENDING' ? 'Confirm Payment' : 'Accept'}
                  </button>
                </>
              )}
              {selectedAppointment.status !== 'PENDING' && selectedAppointment.status !== 'pending' && selectedAppointment.status !== 'GUEST_INTENT' && selectedAppointment.status !== 'VERIFICATION_PENDING' && (
                <button onClick={closeModal} className="btn-secondary">
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedAppointment && (
        <div className="modal-overlay" onClick={handleCloseRejectModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            {/* Modal Header */}
            <div className="modal-header">
              <h3 className="modal-title">Reject Appointment</h3>
              <button onClick={handleCloseRejectModal} className="modal-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body space-y-4">
              {/* Appointment Info */}
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600 mb-1">Appointment for:</p>
                <p className="font-semibold">{selectedAppointment.user_name || 'Unknown User'}</p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedAppointment.scheduled_date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric'
                  })} at {selectedAppointment.scheduled_time}
                </p>
              </div>

              {/* Rejection Reason */}
              <div className="form-field">
                <label className="field-label">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why you're rejecting this appointment..."
                  className="field-input"
                  rows="4"
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                  required
                />
                {rejectReason && (
                  <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {rejectReason.length} characters
                  </p>
                )}
              </div>

              {/* Refund Receipt Upload */}
              <div className="form-field">
                <label className="field-label">Refund Receipt (Optional)</label>
                
                {!refundPreview ? (
                  <label className="file-upload-area">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRefundReceiptChange}
                      className="file-input-hidden"
                    />
                    <FileText className="w-6 h-6" style={{ color: '#9ca3af' }} />
                    <p className="upload-text" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      Click to upload refund receipt
                    </p>
                    <p className="upload-hint">PNG, JPG up to 5MB</p>
                  </label>
                ) : (
                  <div className="image-preview-container">
                    <img src={refundPreview} alt="Refund receipt" className="image-preview" />
                    <button
                      type="button"
                      onClick={removeRefundReceipt}
                      className="remove-image-btn"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                onClick={handleCloseRejectModal}
                className="btn-secondary"
                disabled={updating}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectAppointment}
                className="btn-secondary flex items-center gap-2"
                disabled={updating || !rejectReason.trim()}
              >
                <XCircle className="w-4 h-4" />
                {updating ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsManager;
