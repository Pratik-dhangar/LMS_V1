import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Phone, Shield, Loader } from 'lucide-react';
import { toast } from 'react-toastify';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import bookingService from '../../api/services/bookingService';
import '../../styles/GuestBooking.css';

const GuestBookingStep2 = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const otp = location.state?.otp;
  const otpVerified = location.state?.otpVerified;

  // Redirect to Step 1 if no verified OTP
  useEffect(() => {
    if (!otpVerified || !email || !otp) {
      toast.error('Please verify your email first');
      navigate('/guest-booking');
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);

  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    coach_id: '',
    scheduled_date: '',
    scheduled_time: '',
    session_type: '',
    notes: '',
  });

  const sessionTypes = [
    { value: 'initial_consultation', label: 'Initial Consultation', duration: '60 min' },
    { value: 'follow_up', label: 'Follow-up Session', duration: '45 min' },
    { value: 'extended', label: 'Extended Session', duration: '90 min' },
  ];

  // Fetch coaches on mount
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const data = await bookingService.getAvailableCoaches();
        setCoaches(data || []);
      } catch (err) {
        console.error('Error fetching coaches:', err);
        toast.error('Failed to load coaches');
      }
    };
    fetchCoaches();
  }, []);

  // Fetch available slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!formData.scheduled_date || !formData.coach_id) return;
      try {
        const data = await bookingService.getAvailableSlots(formData.coach_id, formData.scheduled_date);
        setAvailableSlots(data.available_slots || []);
      } catch (err) {
        console.error('Error fetching slots:', err);
        toast.error('Failed to load available slots');
        setAvailableSlots([]);
      }
    };
    fetchSlots();
  }, [formData.scheduled_date, formData.coach_id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'scheduled_date' ? { scheduled_time: '' } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.guest_name || !formData.guest_phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.coach_id || !formData.scheduled_date || !formData.scheduled_time || !formData.session_type) {
      toast.error('Please select booking details');
      return;
    }

    try {
      setLoading(true);

      // Create FormData for submission
      const submitData = new FormData();
      submitData.append('email', email);
      submitData.append('otp', otp);
      submitData.append('guest_name', formData.guest_name);
      submitData.append('guest_phone', formData.guest_phone);
      submitData.append('coach_id', formData.coach_id);
      submitData.append('scheduled_date', formData.scheduled_date);
      submitData.append('scheduled_time', formData.scheduled_time);
      submitData.append('session_type', formData.session_type);
      if (formData.notes) submitData.append('notes', formData.notes);

      const response = await bookingService.createGuestIntent(
        email,
        submitData
      );

      toast.success('Booking request submitted! Coach will review shortly.');
      
      // Navigate to confirmation/waiting page
      setTimeout(() => {
        navigate('/guest-booking/pending', { state: { appointment: response } });
      }, 1500);
    } catch (err) {
      toast.error(err.detail || 'Failed to submit booking');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <>
        <Navbar />
        <div className="page-container">
          <div className="page-content">
            <div className="error-message">
              <p>Invalid session. Please start from <a href="/guest-booking/step1">Step 1</a>.</p>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const selectedCoach = coaches.find(c => c.id === parseInt(formData.coach_id));

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-main">
          <div className="page-header">
            <button className="btn-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} /> Back
            </button>
            <h1 className="page-title">Guest Booking - Step 2</h1>
            <p className="page-subtitle">Verify OTP and provide booking details</p>
          </div>

          <div className="page-content">
            <div className="guest-booking-card">
              <div className="progress-indicator">
                <div className="progress-step completed">
                  <div className="step-number">✓</div>
                  <div className="step-label">Verify Email</div>
                </div>
                <div className="progress-line completed"></div>
                <div className="progress-step active">
                  <div className="step-number">2</div>
                  <div className="step-label">Booking Details</div>
                </div>
                <div className="progress-line"></div>
                <div className="progress-step">
                  <div className="step-number">3</div>
                  <div className="step-label">Payment</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="guest-booking-form">
                {/* Personal Details Section */}
                <div className="form-section">
                  <div className="section-header-guest">
                    <User size={20} />
                    <h3>Your Details</h3>
                  </div>

                  <div className="form-row">
                    <div className="form-group full">
                      <label htmlFor="guest_name">Full Name *</label>
                      <input
                        type="text"
                        id="guest_name"
                        name="guest_name"
                        value={formData.guest_name}
                        onChange={handleInputChange}
                        placeholder="John Doe"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group full">
                      <label htmlFor="guest_phone">Phone Number *</label>
                      <input
                        type="tel"
                        id="guest_phone"
                        name="guest_phone"
                        value={formData.guest_phone}
                        onChange={handleInputChange}
                        placeholder="+91 98765 43210"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Coach & Date Section */}
                <div className="form-section">
                  <div className="section-header-guest">
                    <Calendar size={20} />
                    <h3>Booking Details</h3>
                  </div>

                  <div className="form-group full">
                    <label>Select Coach *</label>
                    <div className="coach-cards-grid">
                      {coaches.map(coach => (
                        <div 
                          key={coach.id}
                          className={`coach-card ${formData.coach_id === String(coach.id) ? 'selected' : ''}`}
                          onClick={() => handleInputChange({ 
                            target: { name: 'coach_id', value: String(coach.id) } 
                          })}
                        >
                          {coach.profile_picture_url && (
                            <img 
                              src={coach.profile_picture_url} 
                              alt={coach.user_name}
                              className="coach-card-image"
                            />
                          )}
                          <div className="coach-card-info">
                            <h4 className="coach-card-name">{coach.user_name || 'Coach'}</h4>
                            {coach.specialization && (
                              <p className="coach-card-specialization">{coach.specialization}</p>
                            )}
                          </div>
                          {formData.coach_id === String(coach.id) && (
                            <div className="coach-card-checkmark">✓</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="scheduled_date">Date *</label>
                      <input
                        type="date"
                        id="scheduled_date"
                        name="scheduled_date"
                        value={formData.scheduled_date}
                        onChange={handleInputChange}
                        min={new Date().toISOString().split('T')[0]}
                        disabled={loading}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="scheduled_time">Time *</label>
                      <select
                        id="scheduled_time"
                        name="scheduled_time"
                        value={formData.scheduled_time}
                        onChange={handleInputChange}
                        disabled={loading || availableSlots.length === 0}
                        required
                      >
                        <option value="">Select time...</option>
                        {availableSlots.map(slot => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                      {availableSlots.length === 0 && formData.scheduled_date && (
                        <small style={{ color: '#f59e0b' }}>No slots available on this date</small>
                      )}
                    </div>
                  </div>

                  <div className="form-group full">
                    <label htmlFor="session_type">Session Type *</label>
                    <select
                      id="session_type"
                      name="session_type"
                      value={formData.session_type}
                      onChange={handleInputChange}
                      disabled={loading}
                      required
                    >
                      <option value="">Select session type...</option>
                      {sessionTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.duration}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full">
                    <label htmlFor="notes">Additional Notes (Optional)</label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Tell the coach about your needs, concerns, or goals..."
                      rows="3"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary btn-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader size={16} className="spinner" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Booking Request'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default GuestBookingStep2;
