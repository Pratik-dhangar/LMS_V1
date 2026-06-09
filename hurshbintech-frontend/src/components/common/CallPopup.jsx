import React, { useState, useEffect } from 'react';
import { FaPhoneAlt, FaTimes } from 'react-icons/fa';
import '../../styles/components/common/CallPopup.css';

const CallPopup = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [showFloatBtn, setShowFloatBtn] = useState(false);

  const phoneNumber = '+918928765520'; 

  useEffect(() => {
    // Check if user already dismissed the popup in this session
    const hasDismissed = sessionStorage.getItem('callPopupDismissed');
    
    if (hasDismissed === 'true') {
      // If already dismissed previously, just show the float button
      setShowFloatBtn(true);
      return;
    }

    // Set timer to 5 seconds (5000 ms) for testing purposes.
    // CHANGE THIS BACK TO 300000 FOR 5 MINUTES IN PRODUCTION!
    const timer = setTimeout(() => {
      setShowPopup(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setShowPopup(false);
    setShowFloatBtn(true);
    sessionStorage.setItem('callPopupDismissed', 'true');
  };

  const handleCall = () => {
    window.location.href = `tel:${phoneNumber}`;
  };

  return (
    <>
      {/* Central Popup Modal */}
      {showPopup && (
        <div className="call-popup-overlay">
          <div className="call-popup-container">
            <button className="call-popup-close-btn" onClick={handleClose} aria-label="Close">
              <FaTimes />
            </button>
            <div className="call-popup-content">
              <div className="call-popup-icon-wrapper">
                <FaPhoneAlt className="call-popup-icon" />
              </div>
              <h3 className="call-popup-title">Need Help?</h3>
              <p className="call-popup-text">Speak directly with our experts now!</p>
              <button className="call-popup-action-btn" onClick={handleCall}>
                Call Us Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Call Button (above WhatsApp) */}
      {showFloatBtn && (
        <a
          href={`tel:${phoneNumber}`}
          className="call-float-btn"
          aria-label="Call Us Now"
          title="Call Us Now"
        >
          <div className="call-float-tooltip">Call Now</div>
          <FaPhoneAlt />
        </a>
      )}
    </>
  );
};

export default CallPopup;
