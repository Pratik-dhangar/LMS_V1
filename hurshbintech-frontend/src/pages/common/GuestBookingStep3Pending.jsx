import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, Mail, AlertCircle, RotateCw, Loader } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/GuestBooking.css';

const GuestBookingStep3Pending = () => {
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

                <h2 className="success-title">Booking Request Submitted!</h2>

                <div className="success-message">
                  <p>Your guest booking request has been successfully submitted.</p>
                </div>

                <div className="instruction-box" style={{ marginTop: '2rem' }}>
                  <div className="instruction-header">
                    <Mail size={20} />
                    <h4>What happens next?</h4>
                  </div>
                  <ol className="instruction-list">
                    <li><strong>Coach Review:</strong> Your selected coach will review your booking request</li>
                    <li><strong>Payment Link:</strong> If approved, you'll receive an email with a secure payment upload link</li>
                    <li><strong>Upload Payment:</strong> Submit your payment receipt (screenshot or PDF)</li>
                    <li><strong>Confirmation:</strong> Coach will verify and confirm your session</li>
                  </ol>
                </div>

                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-check">✓</div>
                    <div className="timeline-content">
                      <p className="timeline-title">Email Verified</p>
                      <p className="timeline-desc">OTP successfully verified</p>
                    </div>
                  </div>

                  <div className="timeline-item">
                    <div className="timeline-check">✓</div>
                    <div className="timeline-content">
                      <p className="timeline-title">Booking Submitted</p>
                      <p className="timeline-desc">Details sent to coach</p>
                    </div>
                  </div>

                  <div className="timeline-item pending">
                    <div className="timeline-loader">
                      <Loader size={20} />
                    </div>
                    <div className="timeline-content">
                      <p className="timeline-title">Awaiting Coach Approval</p>
                      <p className="timeline-desc">Coach will review your request</p>
                    </div>
                  </div>

                  <div className="timeline-item">
                    <div className="timeline-check">→</div>
                    <div className="timeline-content">
                      <p className="timeline-title">Payment Upload</p>
                      <p className="timeline-desc">Upload payment receipt</p>
                    </div>
                  </div>

                  <div className="timeline-item">
                    <div className="timeline-check">→</div>
                    <div className="timeline-content">
                      <p className="timeline-title">Session Confirmed</p>
                      <p className="timeline-desc">Ready to start your session</p>
                    </div>
                  </div>
                </div>

                <div className="info-box">
                  <AlertCircle size={20} />
                  <div>
                    <p><strong>Check your email</strong> for updates from the coach and payment upload link.</p>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>If you don't receive an email within the next hour, please check your spam folder.</p>
                  </div>
                </div>

                <div className="action-buttons">
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/guest-booking')}
                  >
                    Start Another Booking
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => navigate('/')}
                  >
                    Return to Home
                  </button>
                </div>

                <p className="countdown-text">
                  Redirecting to home in {countdown}s...
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

export default GuestBookingStep3Pending;
