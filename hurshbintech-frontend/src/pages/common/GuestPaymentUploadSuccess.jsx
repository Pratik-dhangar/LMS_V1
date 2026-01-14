import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Mail, ArrowRight, Home } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/GuestBooking.css';

const GuestPaymentUploadSuccess = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/');
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, navigate]);

  return (
    <>
      <Navbar />
      <div className="guest-booking-flow page-container">
        <div className="page-main">
          <div className="page-content">
            <div className="guest-booking-card">
              <div className="success-container">
                <div className="success-icon-large">
                  <CheckCircle size={80} />
                </div>

                <h2 className="success-title">Payment Uploaded Successfully!</h2>

                <div className="success-message">
                  <p>Your payment receipt has been received and uploaded.</p>
                </div>

                <div className="instruction-box" style={{ marginTop: '2rem' }}>
                  <div className="instruction-header">
                    <Mail size={20} />
                    <h4>Next Steps</h4>
                  </div>
                  <ol className="instruction-list">
                    <li>Your coach will review your payment receipt</li>
                    <li>You'll receive a confirmation email once approved</li>
                    <li>Session details will be confirmed with you</li>
                    <li>Get ready for your coaching session!</li>
                  </ol>
                </div>

                <div className="info-box">
                  <CheckCircle size={20} />
                  <div>
                    <p><strong>You're all set!</strong> Check your email for further updates from your coach.</p>
                  </div>
                </div>

                <div className="action-buttons">
                  <button 
                    className="btn app-modal-btn app-modal-btn--primary"
                    onClick={() => navigate('/')}
                  >
                    <Home size={16} />
                    Return to Home
                  </button>
                </div>

                <p className="countdown-text">
                  Redirecting in {countdown}s...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default GuestPaymentUploadSuccess;
