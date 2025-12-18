import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Calendar, Clock, Upload, X, ArrowLeft, Check } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import bookingService from '../../api/services/bookingService';
import '../../styles/BookAppointment.css';

const BookAppointmentForm = () => {
  const { coachId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const coach = location.state?.coach;

  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
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

  useEffect(() => {
    if (coachId) {
      fetchAvailableSlots();
    }
  }, [coachId]);

  const fetchAvailableSlots = async () => {
    try {
      // Use coach's time_slots if available, otherwise use default
      if (coach && coach.time_slots) {
        // time_slots is a comma-separated string like "10am,1pm,3pm,5pm"
        const slots = coach.time_slots.split(',').map(slot => slot.trim());
        setAvailableSlots(slots);
      } else {
        // Fallback to default time slots
        const defaultSlots = [
          '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
          '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
        ];
        setAvailableSlots(defaultSlots);
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      toast.error('Failed to load available time slots');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.appointment_date || !formData.appointment_time || !formData.session_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.payment_screenshot) {
      toast.error('Please upload payment screenshot');
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
      toast.error(error.response?.data?.detail || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content" style={{maxWidth: '900px'}}>
          {/* Back Button */}
          <button onClick={() => navigate(-1)} className="back-button">
            <ArrowLeft className="w-5 h-5" />
            Back to Coaches
          </button>

          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">Book Appointment</h1>
            {coach && (
              <div className="selected-coach-info">
                <div className="coach-avatar-sm">
                  {coach.profile_picture_url ? (
                    <img 
                      src={`http://127.0.0.1:8000${coach.profile_picture_url}`} 
                      alt={coach.name}
                      onError={(e) => {
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
          </div>

          {/* Form Card */}
          <div className="appointment-form-card">
            <form onSubmit={handleSubmit}>
              
              {/* Date & Time Section */}
              <div className="form-section">
                <h3 className="section-heading">
                  <Calendar className="w-5 h-5" />
                  Date & Time
                </h3>
                <div className="form-grid">
                  <div className="form-field">
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
                  </div>

                  <div className="form-field">
                    <label className="field-label">Time Slot *</label>
                    <select
                      name="appointment_time"
                      value={formData.appointment_time}
                      onChange={handleInputChange}
                      className="field-input"
                      required
                    >
                      <option value="">Select time slot</option>
                      {availableSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Session Type Section */}
              <div className="form-section">
                <h3 className="section-heading">
                  <Clock className="w-5 h-5" />
                  Session Type
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
                <div className="form-field">
                  <label className="field-label">Upload Payment Screenshot *</label>
                  
                  {!previewImage ? (
                    <label className="file-upload-area">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="file-input-hidden"
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
                  className="btn-confirm"
                  disabled={loading}
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
      <Footer />
    </div>
  );
};

export default BookAppointmentForm;
