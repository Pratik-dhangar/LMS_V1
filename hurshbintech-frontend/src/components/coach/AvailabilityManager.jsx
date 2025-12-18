import React, { useState, useEffect } from 'react';
import { updateCoachAvailability, getCoachAvailability } from '../../api/coach/coachApi';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Dashboards.css';

const AvailabilityManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [unavailableUntil, setUnavailableUntil] = useState('');
  const [unavailableReason, setUnavailableReason] = useState('');

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const data = await getCoachAvailability(user?.profile?.id);
      setIsAvailable(data.is_available);
      if (data.unavailable_until) {
        setUnavailableUntil(data.unavailable_until.split('T')[0]);
      }
      setUnavailableReason(data.unavailable_reason || '');
    } catch (err) {
      console.error('Error fetching availability:', err);
    }
  };

  const handleAvailabilityChange = async (available) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await updateCoachAvailability(
        available,
        available ? null : unavailableUntil,
        available ? null : unavailableReason
      );

      setIsAvailable(available);
      setSuccess(
        available
          ? 'You are now available for appointments!'
          : 'You are marked as unavailable'
      );

      if (available) {
        setUnavailableUntil('');
        setUnavailableReason('');
      }
    } catch (err) {
      setError(err.detail || 'Failed to update availability');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUnavailable = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await updateCoachAvailability(false, unavailableUntil, unavailableReason);
      setSuccess('Unavailability updated successfully!');
    } catch (err) {
      setError(err.detail || 'Failed to update unavailability');
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

      {/* Availability Status */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: isAvailable ? '#d1fae5' : '#fee2e2',
        border: `2px solid ${isAvailable ? '#6ee7b7' : '#fca5a5'}`,
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: isAvailable ? '#065f46' : '#7f1d1d' }}>
            Current Status: <span style={{ fontSize: '1.25rem' }}>{isAvailable ? '✓ Available' : '✗ Unavailable'}</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: isAvailable ? '#047857' : '#991b1b', margin: 0 }}>
            {isAvailable
              ? 'You are currently accepting new appointments and sessions.'
              : `You are unavailable${unavailableUntil ? ` until ${unavailableUntil}` : ''}.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => handleAvailabilityChange(true)}
            disabled={loading || isAvailable}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: isAvailable ? '#10b981' : '#d1d5db',
              color: isAvailable ? 'white' : '#4b5563',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: isAvailable || loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: isAvailable || loading ? 0.6 : 1,
            }}
          >
            Mark Available
          </button>
          <button
            onClick={() => handleAvailabilityChange(false)}
            disabled={loading || !isAvailable}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: !isAvailable ? '#ef4444' : '#d1d5db',
              color: !isAvailable ? 'white' : '#4b5563',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: !isAvailable || loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: !isAvailable || loading ? 0.6 : 1,
            }}
          >
            Mark Unavailable
          </button>
        </div>
      </div>

      {/* Unavailable Details Form */}
      {!isAvailable && (
        <form onSubmit={handleUpdateUnavailable} style={{
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
        }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>Unavailability Details</h4>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Available Until (Date)
            </label>
            <input
              type="date"
              value={unavailableUntil}
              onChange={(e) => setUnavailableUntil(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Choose the date when you'll be available again
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Reason (Optional)
            </label>
            <select
              value={unavailableReason}
              onChange={(e) => setUnavailableReason(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <option value="">Select a reason</option>
              <option value="On leave">On Leave</option>
              <option value="Fully booked">Fully Booked</option>
              <option value="Personal">Personal Reasons</option>
              <option value="Training">Training/Development</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Updating...' : 'Update Unavailability'}
          </button>
        </form>
      )}

      {/* Availability Schedule Info */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bfdbfe',
        borderRadius: '0.5rem',
      }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600', color: '#1e40af' }}>
          Your Availability Schedule
        </h4>
        <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: '600' }}>Available Days:</span> Monday - Friday
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: '600' }}>Time Slots:</span> 10am, 1pm, 3pm, 5pm
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#1e3a8a' }}>
            Update your profile to change availability days and time slots.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityManager;
