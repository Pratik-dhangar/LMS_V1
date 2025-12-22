import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Search, Star, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import bookingService from '../../api/services/bookingService';
import { getCoachAvailabilityPublic } from '../../api/coach/coachApi';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/BookAppointment.css';

const BookAppointment = () => {
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState([]);
  const [filteredCoaches, setFilteredCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [coachAvailability, setCoachAvailability] = useState({}); // Track availability by coach ID

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
      setCoaches(data || []);
      setFilteredCoaches(data || []);
      
      // Fetch availability for each coach
      if (data && data.length > 0) {
        await fetchAllCoachAvailability(data);
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
    navigate(`/book-appointment/${coach.id}`, { state: { coach } });
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
        <Navbar />
        <main className="page-main">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading coaches...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Book an Appointment</h1>
              <p className="page-description">Choose from our experienced coaches</p>
            </div>
            <button 
              onClick={() => navigate('/my-appointments')}
              className="btn-primary flex items-center gap-2"
              style={{ alignSelf: 'flex-start' }}
            >
              <Calendar className="w-4 h-4" />
              My Appointments
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search by name or specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
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
                const isUnavailable = availability && !availability.is_available;
                
                return (
                  <div key={coach.id} className={`coach-card ${isUnavailable ? 'coach-card-unavailable' : ''}`}>
                    {/* Availability Badge - Always show */}
                    <div className={`availability-badge ${isUnavailable ? 'badge-unavailable' : 'badge-available'}`}>
                      {isUnavailable ? (
                        <>
                          <AlertCircle className="badge-icon" />
                          <span className="badge-text">Unavailable</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="badge-icon" />
                          <span className="badge-text">Available</span>
                        </>
                      )}
                    </div>
                    
                    <div className="coach-card-content">
                      {/* Profile Picture */}
                      <div className={`coach-avatar-wrapper ${isUnavailable ? 'greyscale' : ''}`}>
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
                        
                        {coach.specialization && (
                          <p className="coach-specialization">
                            <span className="label">Specialization:</span> {coach.specialization}
                          </p>
                        )}

                        {coach.years_of_experience && (
                          <p className="coach-experience">
                            {coach.years_of_experience} years experience
                          </p>
                        )}

                        {/* Rating */}
                        <div className="coach-rating">
                          <div className="stars">
                            {renderStars(coach.rating)}
                          </div>
                          <span className="rating-text">
                            ({coach.rating || '4.5'}/5)
                          </span>
                          {coach.total_reviews && (
                            <span className="reviews-count">
                              - {coach.total_reviews} reviews
                            </span>
                          )}
                        </div>

                        {/* Session Fee */}
                        {coach.session_fee && (
                          <p className="coach-fee">
                            Session Fee: ₹{coach.session_fee}
                          </p>
                        )}
                      </div>

                      {/* Book Button or Unavailable Message */}
                      {isUnavailable ? (
                        <button
                          disabled
                          className="btn-book-appointment"
                          style={{ opacity: 0.5, cursor: 'not-allowed' }}
                        >
                          <Calendar className="w-5 h-5" />
                          Unavailable
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBookAppointment(coach)}
                          className="btn-book-appointment"
                        >
                          <Calendar className="w-5 h-5" />
                          Book Appointment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BookAppointment;
