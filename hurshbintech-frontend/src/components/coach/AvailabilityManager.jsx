import React, { useState, useEffect } from 'react';
import { updateCoachAvailability, getCoachAvailability } from '../../api/coach/coachApi';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Dashboards.css';

const AvailabilityManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [availabilityStatus, setAvailabilityStatus] = useState('available'); // 'available' or 'unavailable'
  const [unavailableFrom, setUnavailableFrom] = useState('');
  const [unavailableUntil, setUnavailableUntil] = useState('');
  const [unavailableReason, setUnavailableReason] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedTimes, setSelectedTimes] = useState([]);

  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TIME_SLOTS = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm'];

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const data = await getCoachAvailability();
      setAvailabilityStatus(data.is_available ? 'available' : 'unavailable');
      if (data.unavailable_from) {
        setUnavailableFrom(data.unavailable_from.split('T')[0]);
      }
      if (data.unavailable_until) {
        setUnavailableUntil(data.unavailable_until.split('T')[0]);
      }
      setUnavailableReason(data.unavailable_reason || '');
      if (data.availability_days) {
        const days = data.availability_days.split(',').map(d => d.trim());
        setSelectedDays(days);
      }
      if (data.time_slots) {
        const times = data.time_slots.split(',').map(t => t.trim());
        setSelectedTimes(times);
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
    }
  };

  const handleDayToggle = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b))
    );
  };

  const handleTimeToggle = (time) => {
    setSelectedTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const handleAvailabilityChange = async (status) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const isAvailable = status === 'available';
      const payload = {
        is_available: isAvailable,
        unavailable_from: status === 'unavailable' ? unavailableFrom : null,
        unavailable_until: status === 'unavailable' ? unavailableUntil : null,
        unavailable_reason: status === 'unavailable' ? unavailableReason : null,
        availability_days: selectedDays.length > 0 ? selectedDays.join(', ') : null,
        time_slots: selectedTimes.length > 0 ? selectedTimes.join(', ') : null,
      };

      await updateCoachAvailability(payload);
      setAvailabilityStatus(status);
      setSuccess(
        isAvailable
          ? 'You are now available for appointments!'
          : 'You are marked as unavailable'
      );

      if (isAvailable) {
        setUnavailableFrom('');
        setUnavailableUntil('');
        setUnavailableReason('');
      }
    } catch (err) {
      setError(err.detail || 'Failed to update availability');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    try {
      // Validation based on status
      if (availabilityStatus === 'available') {
        if (selectedDays.length === 0) {
          setError('Please select at least one working day');
          return;
        }
        if (selectedTimes.length === 0) {
          setError('Please select at least one available time slot');
          return;
        }
      } else {
        // unavailable status
        if (!unavailableFrom || !unavailableUntil) {
          setError('Please select both start and end dates for unavailability');
          return;
        }
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      const payload = {
        is_available: availabilityStatus === 'available',
        unavailable_from: availabilityStatus === 'unavailable' ? unavailableFrom : null,
        unavailable_until: availabilityStatus === 'unavailable' ? unavailableUntil : null,
        unavailable_reason: availabilityStatus === 'unavailable' ? unavailableReason : null,
        availability_days: availabilityStatus === 'available' ? selectedDays.join(', ') : null,
        time_slots: availabilityStatus === 'available' ? selectedTimes.join(', ') : null,
      };

      await updateCoachAvailability(payload);
      setSuccess('Availability settings updated successfully!');
    } catch (err) {
      setError(err.detail || 'Failed to update availability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="consultant-card">
      <h3 className="consultant-card-title">Manage Your Availability</h3>

      {error && (
        <div className="stat-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#d1fae5',
          border: '1px solid #6ee7b7',
          borderRadius: '0.5rem',
          color: '#065f46',
          marginBottom: '1rem',
        }}>
          {success}
        </div>
      )}

      {/* Status Selection */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
      }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>What's Your Status?</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            padding: '1rem',
            border: `2px solid ${availabilityStatus === 'available' ? '#41A67E' : '#e0e0e0'}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backgroundColor: availabilityStatus === 'available' ? '#f0f8f5' : 'white',
          }}>
            <input
              type="radio"
              name="availability"
              value="available"
              checked={availabilityStatus === 'available'}
              onChange={(e) => setAvailabilityStatus(e.target.value)}
              style={{
                marginRight: '1rem',
                marginTop: '0.25rem',
                width: '20px',
                height: '20px',
                cursor: 'pointer',
                accentColor: '#41A67E',
              }}
            />
            <div>
              <span style={{ fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>✓ I'm Available</span>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>I'm accepting appointments. (Select my working days & times below)</span>
            </div>
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            padding: '1rem',
            border: `2px solid ${availabilityStatus === 'unavailable' ? '#ef4444' : '#e0e0e0'}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backgroundColor: availabilityStatus === 'unavailable' ? '#fef2f2' : 'white',
          }}>
            <input
              type="radio"
              name="availability"
              value="unavailable"
              checked={availabilityStatus === 'unavailable'}
              onChange={(e) => setAvailabilityStatus(e.target.value)}
              style={{
                marginRight: '1rem',
                marginTop: '0.25rem',
                width: '20px',
                height: '20px',
                cursor: 'pointer',
                accentColor: '#ef4444',
              }}
            />
            <div>
              <span style={{ fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>✗ I'm Unavailable</span>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>Temporarily blocking my calendar. (Select dates below)</span>
            </div>
          </label>
        </div>
      </div>

      {/* AVAILABLE - Show days and times selection */}
      {availabilityStatus === 'available' && (
        <>
          {/* Working Days Section */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
          }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>Which Days Do You Work?</h4>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
              Select the days you're available for appointments:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1rem',
            }}>
              {DAYS_OF_WEEK.map(day => (
                <label key={day} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: selectedDays.includes(day) ? '#d1fae5' : 'white',
                  borderColor: selectedDays.includes(day) ? '#10b981' : '#e0e0e0',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(day)}
                    onChange={() => handleDayToggle(day)}
                    style={{
                      marginRight: '0.75rem',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#41A67E',
                    }}
                  />
                  <span style={{ fontWeight: '500', color: '#333' }}>{day}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time Slots Section */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
          }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>What Times Are You Available?</h4>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
              Select the times you can conduct appointments:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '1rem',
            }}>
              {TIME_SLOTS.map(time => (
                <label key={time} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  border: '2px solid #e0e0e0',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: selectedTimes.includes(time) ? '#d1fae5' : 'white',
                  borderColor: selectedTimes.includes(time) ? '#10b981' : '#e0e0e0',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedTimes.includes(time)}
                    onChange={() => handleTimeToggle(time)}
                    style={{
                      marginRight: '0.75rem',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#41A67E',
                    }}
                  />
                  <span style={{ fontWeight: '500', color: '#333' }}>{time}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* UNAVAILABLE - Show date range selection only */}
      {availabilityStatus === 'unavailable' && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#fef2f2',
          border: '2px solid #fca5a5',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
        }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', color: '#7f1d1d' }}>When Are You Unavailable?</h4>
          <p style={{ fontSize: '0.875rem', color: '#991b1b', marginBottom: '1rem' }}>
            Clients won't be able to book appointments during this period.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Unavailable From
            </label>
            <input
              type="date"
              value={unavailableFrom}
              onChange={(e) => setUnavailableFrom(e.target.value)}
              required={availabilityStatus === 'unavailable'}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Unavailable Until
            </label>
            <input
              type="date"
              value={unavailableUntil}
              onChange={(e) => setUnavailableUntil(e.target.value)}
              min={unavailableFrom}
              required={availabilityStatus === 'unavailable'}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Reason (Optional)
            </label>
            <textarea
              value={unavailableReason}
              onChange={(e) => setUnavailableReason(e.target.value)}
              placeholder="e.g., On annual leave, Personal matter, Fully booked"
              rows="2"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      )}

      {/* Summary Section */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.5rem',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bfdbfe',
        borderRadius: '0.5rem',
      }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', color: '#1e40af' }}>
          Your Availability Summary
        </h4>
        <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: '600' }}>Status:</span> {availabilityStatus === 'available' ? '✅ Available' : '❌ Unavailable'}
          </div>
          {availabilityStatus === 'available' ? (
            <>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: '600' }}>Working Days:</span> {selectedDays.length > 0 ? selectedDays.join(', ') : 'None selected'}
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>Available Times:</span> {selectedTimes.length > 0 ? selectedTimes.join(', ') : 'None selected'}
              </div>
            </>
          ) : (
            <>
              {unavailableFrom && unavailableUntil && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: '600' }}>Blocked Period:</span> {unavailableFrom} to {unavailableUntil}
                </div>
              )}
              {unavailableReason && (
                <div>
                  <span style={{ fontWeight: '600' }}>Reason:</span> {unavailableReason}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: '#41A67E',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.3s ease',
          }}
        >
          {loading ? 'Saving...' : 'Save Availability Settings'}
        </button>
      </div>
    </div>
  );
};

export default AvailabilityManager;
