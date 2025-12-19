import React, { useState, useEffect } from 'react';
import coachService from '../../api/services/coachService';
import { Calendar, Clock, User, AlertCircle, X, FileText, Check, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/Dashboards.css';
import '../../styles/Coach.css';

const AppointmentsManager = () => {
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

  const formatSessionType = (type) => {
    if (!type) return 'N/A';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
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
                    <span className="text-gray-700 font-medium">{apt.user_name || 'Unknown User'}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{apt.user_role}</span>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="mt-2">
                    <span className={`status-badge status-${apt.status || 'scheduled'}`}>
                      {apt.status || 'scheduled'}
                    </span>
                  </div>
                </div>
                
                {/* View Details Button */}
                <button
                  onClick={() => handleViewDetails(apt)}
                  className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
                >
                  View Details
                </button>
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
              {/* Client Name */}
              <div className="detail-row">
                <label className="detail-label">
                  <User className="icon-sm" />
                  Client Name
                </label>
                <p className="detail-value">{selectedAppointment.user_name || 'Unknown User'}</p>
              </div>

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
              {(selectedAppointment.status === 'PENDING' || selectedAppointment.status === 'pending') && (
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
                    {updating ? 'Updating...' : 'Accept'}
                  </button>
                </>
              )}
              {selectedAppointment.status !== 'PENDING' && selectedAppointment.status !== 'pending' && (
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
