import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Search, Star, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import bookingService from '../../api/services/bookingService';
import { getCoachAvailabilityPublic } from '../../api/coach/coachApi';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/components/common/Modal.css';
import '../../styles/BookAppointment.css';
import '../../styles/ManageUsersLayout.css';

const BookAppointment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [coaches, setCoaches] = useState([]);
  const [filteredCoaches, setFilteredCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [coachAvailability, setCoachAvailability] = useState({}); // Track availability by coach ID
  const [selectedCoach, setSelectedCoach] = useState(null);

  // Helper function to get role-based dashboard URL
  const getDashboardUrl = () => {
    if (!user || !user.role) return '/dashboard';
    const dashboardMap = {
      'head': '/head/dashboard',
      'trainer': '/trainer/dashboard',
      'coach': '/coach/dashboard',
      'admin': '/admin/dashboard',
      'learner': '/learner/dashboard'
    };
    return dashboardMap[user.role] || '/dashboard';
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  useEffect(() => {
    filterCoaches();
  }, [searchQuery, coaches]);

  const fetchCoaches = async () => {
    try {
      setLoading(true);
      // Fetch all available coaches from booking service
      const data = await bookingService.getAvailableCoaches();
      console.log('Fetched coaches:', data);
      data?.forEach((coach, index) => {
        console.log(`Coach ${index}: ${coach.name}, profile_picture_url: ${coach.profile_picture_url}`);
        if (coach.profile_picture_url) {
          console.log(`  Full image URL would be: ${getFileUrl(coach.profile_picture_url)}`);
        }
      });
      const nonSpecialCoaches = (data || []).filter(coach => !coach.is_special);
      setCoaches(nonSpecialCoaches);
      setFilteredCoaches(nonSpecialCoaches);

      // Fetch availability for each coach
      if (nonSpecialCoaches.length > 0) {
        await fetchAllCoachAvailability(nonSpecialCoaches);
      }
    } catch (error) {
      console.error('Error fetching coaches:', error);
      toast.error('Failed to load coaches');
    } finally {
      setLoading(false);
    }
  };

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

  const filterCoaches = () => {
    if (!searchQuery.trim()) {
      setFilteredCoaches(coaches);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = coaches.filter(coach =>
      coach.name?.toLowerCase().includes(query) ||
      coach.specialization?.toLowerCase().includes(query)
    );
    setFilteredCoaches(filtered);
  };

  const handleBookAppointment = (coach) => {
    // For guest users, navigate to email verification with coach data
    if (!user) {
      navigate('/guest-booking', { state: { coach } });
    } else {
      // For registered users, go to appointment form
      navigate(`/book-appointment/${coach.id}`, { state: { coach } });
    }
  };

  const openCoachDetails = (coach) => {
    setSelectedCoach(coach);
  };

  const closeCoachDetails = () => {
    setSelectedCoach(null);
  };

  const getCoachDetailValue = (coach, keys) => {
    for (const key of keys) {
      const value = coach?.[key];
      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        const nonEmptyValues = value.filter((item) => String(item).trim());
        if (nonEmptyValues.length) {
          return nonEmptyValues.join(', ');
        }
      } else if (String(value).trim()) {
        return value;
      }
    }

    return 'Not available';
  };

  const renderStars = (rating) => {
    const stars = [];
    const ratingValue = rating || 4.5; // Default rating

    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`star-icon ${i <= Math.floor(ratingValue) ? 'filled' : ''}`}
          fill={i <= Math.floor(ratingValue) ? '#fbbf24' : 'none'}
        />
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="page-container">
        <main className="page-main">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading coaches...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container booking-page">
      <main className="page-main">
        <div className="page-content booking-page-content">
          {/* Header */}
          <div className="page-header booking-page-header">
            <button
              onClick={() => navigate(getDashboardUrl())}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Go Back to Dashboard
            </button>
            <div className="booking-page-header-copy">
              <h1 className="page-title booking-page-title">
                Book an Appointment
              </h1>
              <p className="page-description booking-page-description">
                Choose a coach and schedule your session
              </p>
            </div>
          </div>

          {/* Warning for Admin and Coach users */}
          {user && (user.role === 'admin' || user.role === 'coach') && (
            <div className="booking-alert booking-alert--warning">
              <AlertCircle className="booking-alert__icon" />
              <p className="booking-alert__text">
                <strong>View-Only Mode:</strong> As an {user.role === 'admin' ? 'Admin' : 'Coach'} user, you can view this page but cannot book appointments. Only Head, Trainer, and Learner users can book appointments.
              </p>
            </div>
          )}

          {/* Search Bar and Add Button */}
          <div className="search-section">
            <div className="search-input-shell">
              <Search className="search-icon booking-search-icon" />
              <input
                type="text"
                placeholder="Search by name or specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input search-input--with-icon"
              />
            </div>
            {/* Only show My Appointments button for roles that can book appointments */}
            {user && user.role !== 'admin' && user.role !== 'coach' && (
              <button
                onClick={() => navigate('/my-appointments')}
                className="app-modal-btn app-modal-btn--primary booking-action-btn flex items-center gap-2"
                style={{ alignSelf: 'flex-start' }}
              >
                <Calendar className="w-4 h-4" />
                My Appointments
              </button>
            )}
          </div>


          {/* Coaches Grid */}
          {filteredCoaches.length === 0 ? (
            <div className="empty-state">
              <Calendar className="empty-icon" />
              <p className="empty-title">No coaches found</p>
              <p className="empty-description">
                {searchQuery ? 'Try adjusting your search' : 'No coaches available at the moment'}
              </p>
            </div>
          ) : (
            <div className="coaches-grid">
              {filteredCoaches.map((coach) => {
                const availability = coachAvailability[coach.id];
                const hasUnavailablePeriod = availability && !availability.is_available && availability.unavailable_from && availability.unavailable_until;

                // Format unavailable dates for display
                const formatDate = (dateStr) => {
                  if (!dateStr) return '';
                  const date = new Date(dateStr);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                };

                return (
                  <div key={coach.id} className={`coach-card${hasUnavailablePeriod ? ' coach-card--unavailable' : ''}`}>
                    {/* Availability Badge - Show unavailable period if exists */}
                    {hasUnavailablePeriod ? (
                      <div className="availability-badge badge-warning">
                        <AlertCircle className="badge-icon" />
                        <span className="badge-text">
                          Unavailable {formatDate(availability.unavailable_from)} – {formatDate(availability.unavailable_until)}
                        </span>
                      </div>
                    ) : (
                      <div className="availability-badge badge-available">
                        <CheckCircle className="badge-icon" />
                        <span className="badge-text">Available</span>
                      </div>
                    )}

                    <div className="coach-card-content">
                      {/* Profile Picture */}
                      <div className="coach-avatar-wrapper">
                        {coach.profile_picture_url ? (
                          <img
                            src={getFileUrl(coach.profile_picture_url)}
                            alt={coach.name}
                            className="coach-avatar"
                            onError={(e) => {
                              console.error(`Failed to load image for ${coach.name}: ${e.target.src}`);
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="coach-avatar-placeholder" style={{ display: coach.profile_picture_url ? 'none' : 'flex' }}>
                          {coach.name?.charAt(0).toUpperCase() || 'C'}
                        </div>
                      </div>

                      {/* Coach Info */}
                      <div className="coach-info">
                        <h3 className="coach-name">{coach.name}</h3>

                        <div className="coach-detail-pills">
                          {coach.age && (
                            <div className="coach-detail-pill">
                              <span className="coach-detail-label">Age</span>
                              <span className="coach-detail-value">{coach.age}</span>
                            </div>
                          )}
                          {coach.qualification && (
                            <div className="coach-detail-pill">
                              <span className="coach-detail-label">Qualification</span>
                              <span className="coach-detail-value">{coach.qualification}</span>
                            </div>
                          )}
                          {coach.experience_with_hurshbin && (
                            <div className="coach-detail-pill">
                              <span className="coach-detail-label">Exp. with Hurshbin</span>
                              <span className="coach-detail-value">{coach.experience_with_hurshbin}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="coach-card-actions">
                        <button
                          type="button"
                          onClick={() => openCoachDetails(coach)}
                          className="btn-read-more"
                        >
                          Read More
                        </button>

                        {/* Book Button — disabled when coach is unavailable */}
                        <button
                          type="button"
                          onClick={hasUnavailablePeriod ? undefined : () => handleBookAppointment(coach)}
                          className={`btn-book-appointment${hasUnavailablePeriod ? ' btn-book-appointment--disabled' : ''}`}
                          disabled={hasUnavailablePeriod}
                          title={hasUnavailablePeriod ? `Unavailable until ${formatDate(availability.unavailable_until)}` : 'Book an appointment'}
                        >
                          <Calendar className="w-5 h-5" />
                          {hasUnavailablePeriod ? 'Unavailable' : 'Book Appointment'}
                        </button>
                      </div>
                      {hasUnavailablePeriod && (
                        <small className="availability-note">
                          {availability.unavailable_reason
                            ? `Reason: ${availability.unavailable_reason}`
                            : `Available again from ${formatDate(availability.unavailable_until)}`}
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {selectedCoach && (
        <div className="app-modal-overlay" onClick={closeCoachDetails}>
          <div
            className="app-modal-container app-modal-container--md booking-read-more-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">{selectedCoach.name} Details</h2>
              <button
                type="button"
                className="app-modal-close"
                onClick={closeCoachDetails}
                aria-label="Close coach details"
              >
                ×
              </button>
            </div>

            <div className="app-modal-content">
              <section className="coach-modal-section">
                <h3>Professional Information</h3>
                <p>
                  <strong>Qualification:</strong>{' '}
                  {getCoachDetailValue(selectedCoach, ['qualification'])}
                </p>
                <p>
                  <strong>Total Experience:</strong>{' '}
                  {getCoachDetailValue(selectedCoach, ['total_experience', 'experience', 'totalExperience'])}
                </p>
                <p>
                  <strong>Experience with Hurshbin:</strong>{' '}
                  {getCoachDetailValue(selectedCoach, ['experience_with_hurshbin'])}
                </p>
              </section>

              <section className="coach-modal-section">
                <h3>Personal Details</h3>
                <p>
                  <strong>Name:</strong> {getCoachDetailValue(selectedCoach, ['name'])}
                </p>
                <p>
                  <strong>Age:</strong> {getCoachDetailValue(selectedCoach, ['age'])}
                </p>
              </section>

              <section className="coach-modal-section">
                <h3>Specialization</h3>
                <p>{getCoachDetailValue(selectedCoach, ['specialization', 'specializations', 'expertise'])}</p>
              </section>
            </div>

            <div className="app-modal-footer">
              <button
                type="button"
                className="app-modal-btn app-modal-btn--secondary"
                onClick={closeCoachDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookAppointment;
