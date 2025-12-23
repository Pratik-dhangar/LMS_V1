import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, Loader, Lock } from 'lucide-react';
import { toast } from 'react-toastify';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import bookingService from '../../api/services/bookingService';
import '../../styles/GuestBooking.css';

const GuestBookingStep1 = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // 'email' or 'otp'
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const otpInputs = useRef([]);

  // Step 1: Send OTP to email
  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      await bookingService.sendGuestOTP({ email });
      setStep('otp');
      toast.success('OTP sent! Check your email.');
    } catch (err) {
      toast.error(err.detail || 'Failed to send OTP');
      console.error('Error sending OTP:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and proceed to booking details
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    const otp = otpDigits.join('');
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      // Call backend to verify OTP
      await bookingService.verifyGuestOTP({ email, otp });
      
      toast.success('Email verified! Proceeding to booking details...');
      
      // Store email and otp in state for Step 2
      setTimeout(() => {
        navigate('/guest-booking/details', { 
          state: { email, otp, otpVerified: true } 
        });
      }, 1500);
    } catch (err) {
      toast.error(err.detail || 'Invalid or expired OTP');
      console.error('Error verifying OTP:', err);
      // Clear OTP fields on error
      setOtpDigits(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit input
  const handleOtpDigitChange = (index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '');
    
    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = digit;
    setOtpDigits(newOtpDigits);
    
    // Auto-focus next input
    if (digit && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="page-main">
          <div className="page-header">
            <h1 className="page-title">Guest Booking - Email Verification</h1>
            <p className="page-subtitle">Book a session with our coaches without an account</p>
          </div>

          <div className="page-content">
            <div className="guest-booking-card">
              <div className="progress-indicator">
                <div className="progress-step active">
                  <div className="step-number">1</div>
                  <div className="step-label">Email Verification</div>
                </div>
                <div className="progress-line"></div>
                <div className="progress-step">
                  <div className="step-number">2</div>
                  <div className="step-label">Booking Details</div>
                </div>
                <div className="progress-line"></div>
                <div className="progress-step">
                  <div className="step-number">3</div>
                  <div className="step-label">Payment</div>
                </div>
              </div>

              <div className="guest-booking-form">
                {step === 'email' ? (
                  <>
                    <div className="instruction-box">
                      <h3>📧 Verify Your Email</h3>
                      <p>
                        We'll send you a one-time password (OTP) to verify your email. 
                        This keeps your booking secure.
                      </p>
                      <ul>
                        <li>OTP valid for 10 minutes</li>
                        <li>One OTP per email</li>
                        <li>No account creation needed</li>
                      </ul>
                    </div>

                    <form onSubmit={handleSendOTP}>
                      <div className="form-group">
                        <label htmlFor="email">Email Address *</label>
                        <div className="input-with-icon">
                          <Mail size={18} />
                          <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            disabled={loading}
                            required
                          />
                        </div>
                        <small>We'll send an OTP to this email</small>
                      </div>

                      <button 
                        type="submit" 
                        className="btn btn-primary btn-full"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader size={16} className="spinner" />
                            Sending OTP...
                          </>
                        ) : (
                          <>Send OTP</>
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="instruction-box">
                      <h3>🔐 Enter OTP</h3>
                      <p>
                        A 6-digit OTP has been sent to <strong>{email}</strong>
                      </p>
                      <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                        Didn't receive it? Check your spam folder or try again.
                      </p>
                    </div>

                    <form onSubmit={handleVerifyOTP}>
                      <div className="form-group">
                        <label>Enter OTP *</label>
                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                          Enter the 6-digit code sent to <strong>{email}</strong>
                        </p>
                        
                        {/* OTP Input Boxes */}
                        <div className="otp-input-container">
                          {otpDigits.map((digit, index) => (
                            <input
                              key={index}
                              ref={(el) => otpInputs.current[index] = el}
                              type="text"
                              inputMode="numeric"
                              maxLength="1"
                              value={digit}
                              onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(index, e)}
                              className="otp-input-box"
                              placeholder="0"
                              disabled={loading}
                              required
                            />
                          ))}
                        </div>
                        
                        <small style={{ marginTop: '10px', display: 'block', color: '#666' }}>
                          Didn't receive the code? Check your spam folder
                        </small>
                      </div>

                      <button 
                        type="submit" 
                        className="btn btn-primary btn-full"
                        disabled={loading || otpDigits.join('').length !== 6}
                      >
                        {loading ? (
                          <>
                            <Loader size={16} className="spinner" />
                            Verifying...
                          </>
                        ) : (
                          <>Verify & Continue</>
                        )}
                      </button>

                      <button 
                        type="button" 
                        className="btn btn-link"
                        onClick={() => setStep('email')}
                        disabled={loading}
                      >
                        ← Back to email entry
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default GuestBookingStep1;
