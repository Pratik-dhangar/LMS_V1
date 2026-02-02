import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/components/FeaturedCoachCard.css';

const FeaturedCoachCard = ({ coach, floating = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!coach) return null;

  const handleBookAppointment = () => {
    if (!user) {
      // Guest user - redirect to email verification with coach data
      navigate('/guest-booking', { state: { coach } });
    } else {
      // Registered user - redirect to appointment form with coach pre-selected
      navigate(`/book-appointment/${coach.id}`, { state: { coach } });
    }
  };

  return (
    <div className={`featured-coach-card ${floating ? 'featured-coach-card-floating' : ''}`}>
      {/* Coach Profile Picture */}
      <div className="featured-coach-image-wrapper">
        {coach.profile_picture_url ? (
          <img
            src={getFileUrl(coach.profile_picture_url)}
            alt={coach.name}
            className="featured-coach-image"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className="featured-coach-image-placeholder" 
          style={{ display: coach.profile_picture_url ? 'none' : 'flex' }}
        >
          {coach.name?.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Coach Details */}
      <div className="featured-coach-content">
        <h3 className="featured-coach-title">
          Book Appointment with {coach.name}
        </h3>
        
        {coach.specialization && (
          <p className="featured-coach-specialization">
            <strong>Specialization:</strong> {coach.specialization}
          </p>
        )}

        <button
          onClick={handleBookAppointment}
          className="featured-coach-button"
        >
          <Calendar className="featured-coach-button-icon" />
          Book Appointment
        </button>
      </div>
    </div>
  );
};

export default FeaturedCoachCard;
