import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Phone, Shield, Loader } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import bookingService from '../../api/services/bookingService';
import { getCoachAvailabilityPublic } from '../../api/coach/coachApi';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/GuestBooking.css';
import '../../styles/ManageUsersLayout.css';

const GuestBookingStep2 = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const otp = location.state?.otp;
  const otpVerified = location.state?.otpVerified;
  const preSelectedCoach = location.state?.coach; // Get pre-selected coach

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
  const [coachAvailability, setCoachAvailability] = useState({}); // Track availability by coach ID

  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    coach_id: preSelectedCoach ? String(preSelectedCoach.id) : '',
    scheduled_date: '',
    scheduled_time: '',
    session_type: '',
    notes: '',
  });

 const sessionTypes = [
    { value: 'Online consultation', label: 'Online consultation', duration: '60 min', fee: 1800 },
    { value: 'Offline consultation /functional assessment ', label: 'Offline consultation /functional assessment', duration: '90 min', fee: 2700 },
  ];

  // Auto-select session type when coach has a dedicated package
  useEffect(() => {
    const selected = coaches.find(c => c.id === parseInt(formData.coach_id));
    if (selected?.dedicated_package) {
      setFormData(prev => ({
        ...prev,
        session_type: selected.dedicated_package.package_name,
      }));
    }
  }, [formData.coach_id, coaches]);

  // Fetch coaches on mount
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        // Always fetch from API to get latest data (including dedicated_package)
        const data = await bookingService.getAvailableCoaches();

        if (preSelectedCoach) {
          // Find the fresh version of the pre-selected coach from API
          const freshCoach = data?.find(c => c.id === preSelectedCoach.id) || preSelectedCoach;
          setCoaches([freshCoach]);
          await fetchAllCoachAvailability([freshCoach]);
        } else {
          setCoaches(data || []);

          // Fetch availability for each coach
          if (data && data.length > 0) {
            await fetchAllCoachAvailability(data);
          }
        }
      } catch (err) {
        console.error('Error fetching coaches:', err);
        toast.error('Failed to load coaches');
      }
    };
    fetchCoaches();
  }, []);

  const fetchAllCoachAvailability = async (coachesList) => {
    try {
      const availabilityMap = {};

      // Fetch availability for each coach in parallel
      const promises = coachesList.map(coach =>
        getCoachAvailabilityPublic(coach.id)
          .then(data => {
            availabilityMap[coach.id] = data;
          })
          .catch(error => {
            console.error(`Failed to fetch availability for coach ${coach.id}:`, error);
            // Set default available if fetch fails
            availabilityMap[coach.id] = { is_available: true };
          })
      );

      await Promise.all(promises);
      setCoachAvailability(availabilityMap);
    } catch (error) {
      console.error('Error fetching coach availability:', error);
    }
  };

  const formatDateToIso = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCoachAvailableDays = (coachId) => {
    if (!coachId) return [];

    const availability = coachAvailability[coachId];
    const availabilityDaysRaw = availability?.availability_days;
    if (!availabilityDaysRaw) return [];

    return availabilityDaysRaw
      .split(',')
      .map((day) => day.trim().toLowerCase())
      .filter(Boolean);
  };

  const isDateAllowedByCoachWeekdays = (date, coachId) => {
    if (!date || !coachId) return true;

    const availableDays = getCoachAvailableDays(coachId);
    if (availableDays.length === 0) {
      return true;
    }

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return availableDays.includes(dayName);
  };

  // Check if a date falls within coach's unavailable period
  const isDateUnavailable = (date, coachId) => {
    if (!date || !coachId) return false;

    const availability = coachAvailability[coachId];
    if (!availability || availability.is_available) return false;

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    if (availability.unavailable_from && availability.unavailable_until) {
      const unavailableFrom = new Date(availability.unavailable_from);
      unavailableFrom.setHours(0, 0, 0, 0);
      const unavailableUntil = new Date(availability.unavailable_until);
      unavailableUntil.setHours(0, 0, 0, 0);

      return selectedDate >= unavailableFrom && selectedDate <= unavailableUntil;
    }

    return false;
  };

  const isDateSelectableForCoach = (date, coachId) => {
    if (!date || !coachId) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return false;
    }

    return isDateAllowedByCoachWeekdays(selectedDate, coachId) && !isDateUnavailable(date, coachId);
  };

  const getDateUnavailableReason = (date, coachId) => {
    if (!date || !coachId) return '';

    if (isDateUnavailable(date, coachId)) {
      return `Coach is unavailable on this date. Slots available from ${getNextAvailableDate(coachId)}.`;
    }

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    if (!isDateAllowedByCoachWeekdays(selectedDate, coachId)) {
      const availableDays = getCoachAvailableDays(coachId);
      if (availableDays.length > 0) {
        return `Coach is not available on ${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}. Available on: ${availableDays.map((day) => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}.`;
      }
      return 'Coach is not available on this day.';
    }

    return '';
  };

  // Get next available date after unavailable period
  const getNextAvailableDate = (coachId) => {
    if (!coachId) return null;

    const availability = coachAvailability[coachId];
    if (!availability || availability.is_available || !availability.unavailable_until) return null;

    const unavailableUntil = new Date(availability.unavailable_until);
    unavailableUntil.setHours(0, 0, 0, 0);

    // Add 1 day to get next available date
    const nextAvailable = new Date(unavailableUntil);
    nextAvailable.setDate(nextAvailable.getDate() + 1);

    return nextAvailable.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Fetch available slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!formData.scheduled_date || !formData.coach_id) return;

      if (!isDateSelectableForCoach(formData.scheduled_date, formData.coach_id)) {
        setAvailableSlots([]);
        return;
      }

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

  useEffect(() => {
    if (!formData.scheduled_date || !formData.coach_id) return;

    if (!isDateSelectableForCoach(formData.scheduled_date, formData.coach_id)) {
      setFormData(prev => ({
        ...prev,
        scheduled_date: '',
        scheduled_time: '',
      }));
      setAvailableSlots([]);
    }
  }, [formData.coach_id, coachAvailability]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'scheduled_date' ? { scheduled_time: '' } : {}),
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

    if (!isDateSelectableForCoach(formData.scheduled_date, formData.coach_id)) {
      toast.error(getDateUnavailableReason(formData.scheduled_date, formData.coach_id) || 'Selected date is unavailable. Please choose another date.');
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
        <div className="page-container">
          <div className="page-content">
            <div className="error-message">
              <p>Invalid session. Please start from <a href="/guest-booking/step1">Step 1</a>.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const selectedCoach = coaches.find(c => c.id === parseInt(formData.coach_id));

  return (
    <>
      <div className="guest-booking-flow page-container">
        <div className="page-main-guest">
          <div className="page-header">

            <h1 className="page-title">Guest Booking - Step 2</h1>
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

                  {/* Show coach selection only if not pre-selected */}
                  {!preSelectedCoach ? (
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
                            {coach.profile_picture_url ? (
                              <img
                                src={getFileUrl(coach.profile_picture_url)}
                                alt={coach.name}
                                className="coach-card-image"
                              />
                            ) : (
                              <div className="coach-card-image coach-card-image-placeholder">
                                <User size={36} color="#9ca3af" />
                              </div>
                            )}
                            <div className="coach-card-info">
                              <h4 className="coach-card-name">{coach.name}</h4>
                              <div className="coach-card-details-grid">
                                {coach.age && (
                                  <div className="coach-card-detail-pill">
                                    <span className="coach-detail-label">Age</span>
                                    <span className="coach-detail-value">{coach.age}</span>
                                  </div>
                                )}
                                {coach.qualification && (
                                  <div className="coach-card-detail-pill">
                                    <span className="coach-detail-label">Qualification</span>
                                    <span className="coach-detail-value">{coach.qualification}</span>
                                  </div>
                                )}
                                {coach.experience_with_hurshbin && (
                                  <div className="coach-card-detail-pill">
                                    <span className="coach-detail-label">Exp. with Hurshbin</span>
                                    <span className="coach-detail-value">{coach.experience_with_hurshbin}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* {formData.coach_id === String(coach.id) && (
                              <div className="coach-card-checkmark">✓</div>
                            )} */}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="form-group full">
                      <label>Selected Coach</label>
                      <div className="coach-card selected coach-card-horizontal" style={{ cursor: 'default' }}>
                        <div className="coach-card-avatar-wrap">
                          {preSelectedCoach.profile_picture_url ? (
                            <img
                              src={getFileUrl(preSelectedCoach.profile_picture_url)}
                              alt={preSelectedCoach.name}
                              className="coach-card-image"
                            />
                          ) : (
                            <div className="coach-card-image coach-card-image-placeholder">
                              <User size={36} color="#9ca3af" />
                            </div>
                          )}
                        </div>
                        <div className="coach-card-info">
                          <h4 className="coach-card-name">{preSelectedCoach.name}</h4>
                          <div className="coach-card-details-grid">
                            {preSelectedCoach.age && (
                              <div className="coach-card-detail-pill">
                                <span className="coach-detail-label">Age</span>
                                <span className="coach-detail-value">{preSelectedCoach.age}</span>
                              </div>
                            )}
                            {preSelectedCoach.qualification && (
                              <div className="coach-card-detail-pill">
                                <span className="coach-detail-label">Qualification</span>
                                <span className="coach-detail-value">{preSelectedCoach.qualification}</span>
                              </div>
                            )}
                            {preSelectedCoach.experience_with_hurshbin && (
                              <div className="coach-card-detail-pill">
                                <span className="coach-detail-label">Exp. with Hurshbin</span>
                                <span className="coach-detail-value">{preSelectedCoach.experience_with_hurshbin}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* <div className="coach-card-checkmark">✓</div> */}
                      </div>
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="scheduled_date">Date *</label>
                      <DatePicker
                        selected={formData.scheduled_date ? new Date(`${formData.scheduled_date}T00:00:00`) : null}
                        onChange={(date) => {
                          const isoDate = date ? formatDateToIso(date) : '';
                          setFormData(prev => ({
                            ...prev,
                            scheduled_date: isoDate,
                            scheduled_time: '',
                          }));
                        }}
                        filterDate={(date) => {
                          if (!formData.coach_id) return false;
                          return isDateSelectableForCoach(formatDateToIso(date), formData.coach_id);
                        }}
                        minDate={new Date()}
                        dateFormat="MM/dd/yyyy"
                        placeholderText="mm/dd/yyyy"
                        className="guest-date-picker-input"
                        id="scheduled_date"
                        name="scheduled_date"
                        disabled={loading || !formData.coach_id}
                        required
                      />
                      {formData.scheduled_date && formData.coach_id && getDateUnavailableReason(formData.scheduled_date, formData.coach_id) && (
                        <small style={{ color: '#ef4444', display: 'block', marginTop: '4px' }}>
                          ⚠️ {getDateUnavailableReason(formData.scheduled_date, formData.coach_id)}
                        </small>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="scheduled_time">Time *</label>
                      <select
                        id="scheduled_time"
                        name="scheduled_time"
                        value={formData.scheduled_time}
                        onChange={handleInputChange}
                        disabled={loading || availableSlots.length === 0 || (formData.scheduled_date && formData.coach_id && !isDateSelectableForCoach(formData.scheduled_date, formData.coach_id))}
                        required
                      >
                        <option value="">Select time...</option>
                        {sortTimeSlots(availableSlots).map(slot => (
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
                    {selectedCoach?.dedicated_package ? (
                      <>
                        <input
                          type="text"
                          id="session_type"
                          value={`${selectedCoach.dedicated_package.package_name} - 1 Hour (60 min)`}
                          disabled
                          style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                        />
                        <small style={{ color: '#10b981', marginTop: '4px', display: 'block', fontSize: '0.95rem', fontWeight: '600' }}>
                          Fees for this session: ₹{selectedCoach.dedicated_package.price}
                        </small>
                      </>
                    ) : (
                      <>
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
                        {formData.session_type && (
                          <small style={{ color: '#10b981', marginTop: '4px', display: 'block', fontSize: '0.95rem', fontWeight: '600' }}>
                            Fees for this session: ₹{sessionTypes.find(t => t.value === formData.session_type)?.fee || 0}
                          </small>
                        )}
                      </>
                    )}
                  </div>

                  {/* Contact note for coach appointment */}
                  <div className="form-group full">
                    <p style={{ fontSize: '0.95rem', fontWeight: '600', color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      Contact us for assistance regarding appointments&nbsp;
                      <a
                        href="https://wa.me/+918928765220"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Chat on WhatsApp"
                        style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, textDecoration: 'none', transition: 'transform 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true">
                          <path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.668 4.61 1.832 6.504L4 29l7.697-1.816A11.94 11.94 0 0016 27c6.627 0 12-5.373 12-12S22.627 3 16 3z" fill="#25D366" />
                          <path d="M16 5.5C10.753 5.5 6.5 9.753 6.5 15c0 2.127.676 4.097 1.83 5.706l-1.2 4.412 4.527-1.185A9.462 9.462 0 0016 24.5c5.247 0 9.5-4.253 9.5-9.5S21.247 5.5 16 5.5zm5.414 13.583c-.225.633-1.322 1.211-1.816 1.258-.465.044-.9.208-3.033-.633-2.578-1.018-4.23-3.647-4.357-3.816-.127-.169-1.034-1.376-1.034-2.625s.654-1.865.886-2.12c.232-.253.506-.317.674-.317.169 0 .337.002.485.008.155.007.363-.059.568.433.211.507.716 1.75.779 1.878.063.127.105.274.021.443-.084.169-.127.274-.253.422-.127.148-.266.33-.38.443-.127.127-.258.264-.111.518.148.253.656 1.082 1.408 1.751.966.86 1.782 1.125 2.035 1.252.253.127.4.105.548-.063.148-.169.634-.739.803-.992.169-.253.337-.211.568-.127.232.084 1.472.695 1.724.822.253.127.422.19.485.295.063.106.063.612-.162 1.244z" fill="#fff" />
                        </svg>
                      </a>
                    </p>
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
    </>
  );
};

export default GuestBookingStep2;
