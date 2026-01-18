import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Calendar, Clock, Upload, X, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import bookingService from '../../api/services/bookingService';
import { getCoachAvailabilityPublic } from '../../api/coach/coachApi';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/BookAppointment.css';
import '../../styles/ManageUsersLayout.css';

const BookAppointmentForm = () => {
  const { coachId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const coach = location.state?.coach;

  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [coachAvailability, setCoachAvailability] = useState(null);
  const [formData, setFormData] = useState({
    appointment_date: '',
    appointment_time: '',
    session_type: '',
    payment_screenshot: null,
  });
  const [previewImage, setPreviewImage] = useState(null);

  const sessionTypes = [
    { value: 'initial_consultation', label: 'Initial Consultation', duration: '60 min', fee: 2500 },
    { value: 'follow_up', label: 'Follow-up Session', duration: '45 min', fee: 2000 },
    { value: 'extended', label: 'Extended Session', duration: '90 min', fee: 3500 },
  ];

  // Fetch coach availability on mount
  useEffect(() => {
    const fetchCoachAvailability = async () => {
      if (!coachId) return;
      try {
        const data = await getCoachAvailabilityPublic(coachId);
        console.log('[BookAppointment] Coach Availability Data:', data);
        setCoachAvailability(data);
      } catch (error) {
        console.error('Error fetching coach availability:', error);
        setCoachAvailability({ is_available: true });
      }
    };
    fetchCoachAvailability();
  }, [coachId]);

  // Check if a date falls within coach's unavailable period
  const isDateUnavailable = (date) => {
    if (!date || !coachAvailability) return false;
    if (coachAvailability.is_available) return false;
    
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (coachAvailability.unavailable_from && coachAvailability.unavailable_until) {
      const unavailableFrom = new Date(coachAvailability.unavailable_from);
      unavailableFrom.setHours(0, 0, 0, 0);
      const unavailableUntil = new Date(coachAvailability.unavailable_until);
      unavailableUntil.setHours(0, 0, 0, 0);
      
      return selectedDate >= unavailableFrom && selectedDate <= unavailableUntil;
    }
    
    return false;
  };

  // Check if selected date's day is in coach's availability days
  const isDateDayUnavailable = (date) => {
    if (!date || !coachAvailability?.availability_days) return false;
    
    const selectedDate = new Date(date);
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const availableDays = coachAvailability.availability_days.split(',').map(day => day.trim());
    
    console.log('[BookAppointment] Day Check:', { 
      selectedDate: date, 
      dayName, 
      availableDays, 
      isUnavailable: !availableDays.includes(dayName) 
    });
    
    return !availableDays.includes(dayName);
  };

  // Check if selected time slot is not in coach's available time slots
  const isTimeSlotUnavailable = (timeSlot) => {
    if (!timeSlot || !coachAvailability?.time_slots) return false;
    
    const availableSlots = coachAvailability.time_slots.split(',').map(slot => slot.trim());
    return !availableSlots.includes(timeSlot);
  };

  // Get next available date after unavailable period
  const getNextAvailableDate = () => {
    if (!coachAvailability || coachAvailability.is_available || !coachAvailability.unavailable_until) return null;
    
    const unavailableUntil = new Date(coachAvailability.unavailable_until);
    unavailableUntil.setHours(0, 0, 0, 0);
    
    // Add 1 day to get next available date
    const nextAvailable = new Date(unavailableUntil);
    nextAvailable.setDate(nextAvailable.getDate() + 1);
    
    return nextAvailable.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get next available date based on coach's availability days
  const getNextAvailableDayOfWeek = (fromDate) => {
    if (!coachAvailability?.availability_days) return null;
    
    const availableDays = coachAvailability.availability_days.split(',').map(day => day.trim());
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Get indices of available days
    const availableDayIndices = availableDays.map(day => daysOfWeek.indexOf(day)).filter(i => i !== -1);
    if (availableDayIndices.length === 0) return null;
    
    // Start from tomorrow or the provided date
    const startDate = fromDate ? new Date(fromDate) : new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    
    // Find next available day (within next 14 days to avoid infinite loop)
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + i);
      const dayIndex = checkDate.getDay();
      
      if (availableDayIndices.includes(dayIndex)) {
        // Also check if this date is not in unavailable period
        if (!isDateUnavailable(checkDate.toISOString().split('T')[0])) {
          return {
            date: checkDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            dateString: checkDate.toISOString().split('T')[0],
            dayName: daysOfWeek[dayIndex]
          };
        }
      }
    }
    
    return null;
  };

  // Fetch available slots when date changes
  useEffect(() => {
    const fetchAvailableSlotsForDate = async () => {
      if (!formData.appointment_date || !coachId) return;
      
      try {
        setLoadingSlots(true);
        const slotsData = await bookingService.getAvailableSlots(coachId, formData.appointment_date);
        setAvailableSlots(slotsData.available_slots || []);
      } catch (error) {
        console.error('Error fetching available slots:', error);
        toast.error('Failed to load available time slots');
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    
    fetchAvailableSlotsForDate();
  }, [formData.appointment_date, coachId]);

  // Format time slot for display (e.g., "10am" -> "10:00 AM")
  const formatTimeSlot = (slot) => {
    if (!slot) return '';
    // If already formatted, return as is
    if (slot.includes(':')) return slot;
    // Convert "10am" to "10:00 AM"
    const match = slot.match(/(\d+)(am|pm)/i);
    if (match) {
      const hour = match[1];
      const period = match[2].toUpperCase();
      return `${hour}:00 ${period}`;
    }
    return slot;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset time when date changes
      ...(name === 'appointment_date' ? { appointment_time: '' } : {})
    }));
  };

  // Sort time slots in chronological order (AM to PM)
  const sortTimeSlots = (slots) => {
    return [...slots].sort((a, b) => {
      // Parse time strings like "10am", "1pm", "3:30pm", etc.
      const parseTime = (timeStr) => {
        const str = timeStr.toLowerCase().trim();
        const isPM = str.includes('pm');
        const isAM = str.includes('am');
        
        // Extract numeric part (handle both "10am" and "10:30am" formats)
        const numericPart = str.replace(/[apm\s]/g, '');
        const [hours, minutes = '0'] = numericPart.split(':');
        
        let hour = parseInt(hours);
        const minute = parseInt(minutes);
        
        // Convert to 24-hour format
        if (isPM && hour !== 12) {
          hour += 12;
        } else if (isAM && hour === 12) {
          hour = 0;
        }
        
        return hour * 60 + minute; // Return total minutes for comparison
      };
      
      return parseTime(a) - parseTime(b);
    });
  };

  const handleFileChange = (e) => {
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

      setFormData(prev => ({
        ...prev,
        payment_screenshot: file
      }));

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      payment_screenshot: null
    }));
    setPreviewImage(null);
  };

  const getSelectedSessionType = () => {
    return sessionTypes.find(type => type.value === formData.session_type);
  };

  const getTotalAmount = () => {
    const sessionType = getSelectedSessionType();
    return sessionType ? sessionType.fee : 0;
  };

  const isFormComplete = () => {
    return (
      formData.appointment_date &&
      formData.appointment_time &&
      formData.session_type &&
      formData.payment_screenshot
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Restrict admin and coach users from booking appointments
    if (user && (user.role === 'admin' || user.role === 'coach')) {
      toast.error('Admin and Coach users cannot book appointments. Only Head, Trainer, and Learner users can book appointments.');
      return;
    }

    if (!formData.appointment_date || !formData.appointment_time || !formData.session_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.payment_screenshot) {
      toast.error('Please upload payment screenshot');
      return;
    }

    // Check if selected date is in coach's unavailable period
    if (isDateUnavailable(formData.appointment_date)) {
      toast.error('Selected date is unavailable. Please choose another date.');
      return;
    }

    // Check if selected date's day is in coach's availability days
    if (isDateDayUnavailable(formData.appointment_date)) {
      toast.error('Coach is not available on the selected day. Please choose another date.');
      return;
    }

    // Check if selected time slot is in coach's available time slots
    if (isTimeSlotUnavailable(formData.appointment_time)) {
      toast.error('Selected time slot is not available. Please choose another time.');
      return;
    }

    try {
      setLoading(true);

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('coach_id', coachId);
      submitData.append('scheduled_date', formData.appointment_date);
      submitData.append('scheduled_time', formData.appointment_time);
      submitData.append('session_type', formData.session_type);
      
      // Add payment screenshot if uploaded
      if (formData.payment_screenshot) {
        submitData.append('payment_screenshot', formData.payment_screenshot);
      }
      
      // Add notes with total amount
      const notes = `Total Amount: ₹${getTotalAmount()}`;
      submitData.append('notes', notes);

      // Call booking API
      await bookingService.bookAppointment(submitData);
      
      toast.success('Appointment booked successfully!');
      navigate(-1); // Go back to coaches list
    } catch (error) {
      console.error('Error booking appointment:', error);
      
      // Handle 409 Conflict (double-booking)
      if (error.response?.status === 409) {
        toast.error(error.response.data.detail || 'This time slot was just booked by someone else. Please select another slot.');
        
        // Refresh available slots
        if (formData.appointment_date) {
          try {
            const slotsData = await bookingService.getAvailableSlots(coachId, formData.appointment_date);
            setAvailableSlots(slotsData.available_slots || []);
            // Reset selected time
            setFormData(prev => ({ ...prev, appointment_time: '' }));
          } catch (err) {
            console.error('Error refreshing slots:', err);
          }
        }
      } else {
        toast.error(error.response?.data?.detail || 'Failed to book appointment');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            {/* Back Button */}
            <button onClick={() => navigate(-1)} className="back-button">
              <ArrowLeft className="w-5 h-5" />
              Back to Coaches
            </button>

            {/* Title */}
            <h1 className="page-title">Book Appointment</h1>
          </div>

          {/* Warning for Admin and Coach users */}
          {user && (user.role === 'admin' || user.role === 'coach') && (
            <div style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertCircle className="w-5 h-5" style={{ color: '#F59E0B', flexShrink: 0 }} />
              <p style={{ margin: 0, color: '#92400E', fontSize: '0.95rem' }}>
                <strong>View-Only Mode:</strong> As an {user.role === 'admin' ? 'Admin' : 'Coach'} user, you can view this page but cannot book appointments. Only Head, Trainer, and Learner users can book appointments.
              </p>
            </div>
          )}

          {/* Coach Info */}
          {coach && (
            <div className="selected-coach-info">
              <div className="coach-avatar-sm">
                {coach.profile_picture_url ? (
                  <img 
                    src={getFileUrl(coach.profile_picture_url)}
                    alt={coach.name}
                    onError={(e) => {
                      console.error(`[BookAppointmentForm] Failed to load image for ${coach.name}: ${e.target.src}`);
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span style={{ display: coach.profile_picture_url ? 'none' : 'flex' }}>
                  {coach.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="coach-name-sm">{coach.name}</p>
                {coach.specialization && (
                  <p className="coach-spec-sm">{coach.specialization}</p>
                )}
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="appointment-form-card">
            <form onSubmit={handleSubmit}>
              
              {/* Date & Time Section */}
              <div className="form-section">
                <h3 className="section-heading">
                  <Calendar className="w-5 h-5" />
                  Date & Time
                </h3>
                <div className="app-modal-form-grid">
                  <div className="app-modal-form-field">
                    <label className="field-label">Appointment Date *</label>
                    <input
                      type="date"
                      name="appointment_date"
                      value={formData.appointment_date}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="field-input"
                      required
                    />
                    {formData.appointment_date && isDateUnavailable(formData.appointment_date) && (
                      <small style={{ color: '#ef4444', display: 'block', marginTop: '4px' }}>
                        ⚠️ Coach is unavailable on this date. Slots available from {getNextAvailableDate()}
                      </small>
                    )}
                    {formData.appointment_date && !isDateUnavailable(formData.appointment_date) && isDateDayUnavailable(formData.appointment_date) && (
                      <small style={{ color: '#ef4444', display: 'block', marginTop: '4px' }}>
                        ⚠️ Coach is not available on {new Date(formData.appointment_date).toLocaleDateString('en-US', { weekday: 'long' })}s. 
                        {coachAvailability?.availability_days && ` Available on: ${coachAvailability.availability_days}`}
                        {(() => {
                          const nextDay = getNextAvailableDayOfWeek(formData.appointment_date);
                          return nextDay ? `. Next available: ${nextDay.dayName}, ${nextDay.date}` : '';
                        })()}
                      </small>
                    )}
                  </div>

                  <div className="app-modal-form-field">
                    <label className="field-label">Time Slot *</label>
                    {loadingSlots ? (
                      <div className="field-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
                        <div className="spinner-sm"></div>
                        Loading available slots...
                      </div>
                    ) : (
                      <>
                        <select
                          name="appointment_time"
                          value={formData.appointment_time}
                          onChange={handleInputChange}
                          className="field-input"
                          required
                          disabled={!formData.appointment_date || availableSlots.length === 0 || isDateUnavailable(formData.appointment_date) || isDateDayUnavailable(formData.appointment_date)}
                        >
                          <option value="">
                            {!formData.appointment_date 
                              ? "Select a date first" 
                              : isDateUnavailable(formData.appointment_date) || isDateDayUnavailable(formData.appointment_date)
                                ? "Selected date is unavailable"
                              : availableSlots.length === 0 
                                ? "No slots available on this date" 
                                : "Select a time slot"
                            }
                          </option>
                          {sortTimeSlots(availableSlots).map(slot => (
                            <option key={slot} value={slot}>{formatTimeSlot(slot)}</option>
                          ))}
                        </select>
                        
                        {/* Show message if no slots available */}
                        {formData.appointment_date && availableSlots.length === 0 && !isDateUnavailable(formData.appointment_date) && !isDateDayUnavailable(formData.appointment_date) && (
                          <small style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#ef4444', display: 'block' }}>
                            ⚠️ All time slots are booked for this date. 
                            {(() => {
                              const nextDay = getNextAvailableDayOfWeek(formData.appointment_date);
                              return nextDay ? ` Next available: ${nextDay.dayName}, ${nextDay.date}` : ' Please choose another date.';
                            })()}
                          </small>
                        )}
                        
                        {/* Show available slots count - only if date is not unavailable */}
                        {formData.appointment_date && availableSlots.length > 0 && !isDateUnavailable(formData.appointment_date) && !isDateDayUnavailable(formData.appointment_date) && (
                          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#10b981' }}>
                            {availableSlots.length} slot{availableSlots.length !== 1 ? 's' : ''} available
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Session Type Section */}
              <div className="form-section">
                <h3 className="section-heading">
                  <Clock className="w-5 h-5" />
                  Session Type <span style={{ color: '#ef4444' }}>*</span>
                </h3>
                <div className="session-types-grid">
                  {sessionTypes.map(type => (
                    <label
                      key={type.value}
                      className={`session-type-card ${formData.session_type === type.value ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="session_type"
                        value={type.value}
                        checked={formData.session_type === type.value}
                        onChange={handleInputChange}
                        className="session-type-radio"
                        required
                      />
                      <div className="session-type-content">
                        <p className="session-type-label">{type.label}</p>
                        <p className="session-type-duration">{type.duration}</p>
                        <p className="session-type-fee">₹{type.fee}</p>
                      </div>
                      {formData.session_type === type.value && (
                        <Check className="check-icon" />
                      )}
                    </label>
                  ))}
                </div>
                {!formData.session_type && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
                    Please select a session type
                  </p>
                )}
              </div>

              {/* Payment Section */}
              <div className="form-section">
                <h3 className="section-heading">
                  <Upload className="w-5 h-5" />
                  Payment Details
                </h3>
                
                {/* Total Amount */}
                <div className="payment-summary">
                  <div className="payment-row">
                    <span className="payment-label">Session Fee:</span>
                    <span className="payment-value">₹{getTotalAmount()}</span>
                  </div>
                  <div className="payment-row total">
                    <span className="payment-label">Total Amount:</span>
                    <span className="payment-value">₹{getTotalAmount()}</span>
                  </div>
                </div>

                {/* Payment Instructions */}
                <div className="payment-instructions">
                  <p className="instruction-title">Payment Instructions:</p>
                  <ol className="instruction-list">
                    <li>Transfer the amount to: UPI ID: <strong>coach@upi</strong></li>
                    <li>Take a screenshot of the payment confirmation</li>
                    <li>Upload the screenshot below</li>
                  </ol>
                </div>

                {/* File Upload */}
                <div className="app-modal-form-field">
                  <label className="field-label">Upload Payment Screenshot *</label>
                  
                  {!previewImage ? (
                    <label className="file-upload-area">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="file-input-hidden"
                        required
                      />
                      <Upload className="upload-icon" />
                      <p className="upload-text">Click to upload or drag and drop</p>
                      <p className="upload-hint">PNG, JPG up to 5MB</p>
                    </label>
                  ) : (
                    <div className="image-preview-container">
                      <img src={previewImage} alt="Payment screenshot" className="image-preview" />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="remove-image-btn"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  {!previewImage && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
                      Payment screenshot is required
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn-cancel"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || !isFormComplete()}
                  title={!isFormComplete() ? 'Please fill in all required fields' : 'Confirm your booking'}
                >
                  {loading ? (
                    <>
                      <div className="spinner-sm"></div>
                      Booking...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Confirm Booking
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        
      </main>
    </div>
  );
};

export default BookAppointmentForm;
