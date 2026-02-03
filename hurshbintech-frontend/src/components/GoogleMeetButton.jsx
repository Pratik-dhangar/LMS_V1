import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Video } from 'lucide-react';
import { toast } from 'react-toastify';
import '../styles/components/GoogleMeetButton.css';

const GoogleMeetButton = ({ onMeetingCreated, disabled = false }) => {
  const [isCreating, setIsCreating] = useState(false);

  const createGoogleMeeting = async (accessToken) => {
    try {
      setIsCreating(true);
      
      // Call Google Meet API to create a new space
      const response = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            accessType: 'TRUSTED',  // Changed from 'OPEN' - requires host approval for participants
            entryPointAccess: 'ALL'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create Google Meet');
      }

      const data = await response.json();
      const meetingUrl = data.meetingUri;

      if (!meetingUrl) {
        throw new Error('No meeting URL received from Google');
      }

      toast.success('Google Meet link created successfully!');
      onMeetingCreated(meetingUrl);
    } catch (error) {
      console.error('Error creating Google Meet:', error);
      toast.error(error.message || 'Failed to create Google Meet link');
    } finally {
      setIsCreating(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      await createGoogleMeeting(tokenResponse.access_token);
    },
    onError: (error) => {
      console.error('Google OAuth Error:', error);
      toast.error('Google authentication failed. Please try again.');
      setIsCreating(false);
    },
    scope: 'https://www.googleapis.com/auth/meetings.space.created',
    flow: 'implicit', // Use implicit flow for access token
  });

  const handleClick = () => {
    if (!disabled && !isCreating) {
      googleLogin();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isCreating}
      className="google-meet-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.625rem 1.25rem',
        backgroundColor: isCreating ? '#9ca3af' : '#db9d32',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: disabled || isCreating ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isCreating) {
          e.currentTarget.style.backgroundColor = '#c27d0a';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isCreating) {
          e.currentTarget.style.backgroundColor = '#db9d32';
        }
      }}
    >
      <Video size={16} />
      {isCreating ? (
        <>
          <span className="google-meet-spinner" style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          Creating Meeting...
        </>
      ) : (
        'Generate Google Meet Link'
      )}
    </button>
  );
};

export default GoogleMeetButton;
