import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader, Lock } from 'lucide-react';
import { toast } from 'react-toastify';
import bookingService from '../../api/services/bookingService';
import '../../styles/GuestBooking.css';
import '../../styles/ManageUsersLayout.css';

const GuestBookingStep1 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const coach = location.state?.coach; // Get pre-selected coach from state
  const [step, setStep] = useState('email'); // 'email' or 'otp'
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailCheckResult, setEmailCheckResult] = useState(null); // null | 'existing' | 'new'
  const [bookingType, setBookingType] = useState(null); // null | 'follow_up' | 'new'
  const otpInputs = useRef([]);
  const emailCheckTimeout = useRef(null);

  // Timer for resend OTP countdown
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((time) => time - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Debounced email check against Appointments table
  useEffect(() => {
    setEmailCheckResult(null);
    setBookingType(null);

    // Validate email format before hitting the API
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!email || !validEmail) return;

    if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);

    emailCheckTimeout.current = setTimeout(async () => {
      try {
        setCheckingEmail(true);
        const result = await bookingService.checkGuestEmail(email);
        setEmailCheckResult(result.exists ? 'existing' : 'new');
      } catch {
        setEmailCheckResult('new'); // Fallback: treat as new on error
      } finally {
        setCheckingEmail(false);
      }
    }, 600);

    return () => {
      if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);
    };
  }, [email]);

  // Step 1: Send OTP to email
  const handleSendOTP = async (e, type = null) => {
    if (e) e.preventDefault();

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (type) setBookingType(type);

    try {
      setLoading(true);
      await bookingService.sendGuestOTP({ email });
      setStep('otp');
      setResendTimer(60); // 1 minute countdown
      toast.success('OTP sent! Check your email.');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.detail || 'Failed to send OTP';
      toast.error(errorMsg);
      console.error('Error sending OTP:', err);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP function
  const handleResendOTP = async () => {
    if (resendTimer > 0) return; // Prevent resend if timer active

    try {
      setLoading(true);
      await bookingService.sendGuestOTP({ email });
      setResendTimer(60); // Reset 1 minute countdown
      toast.success('OTP resent! Check your email.');
      // Clear existing OTP digits
      setOtpDigits(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.detail || 'Failed to resend OTP';
      toast.error(errorMsg);
      console.error('Error resending OTP:', err);
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

      // Store email, otp, coach, and booking type in state for Step 2
      setTimeout(() => {
        navigate('/guest-booking/details', {
          state: { email, otp, otpVerified: true, coach, bookingType }
        });
      }, 1500);
    } catch (err) {
      // Extract error message from response
      const errorMsg = err.response?.data?.detail || err.detail || 'Invalid or expired OTP';
      toast.error(errorMsg);
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

  // Handle paste functionality
  const handleOtpPaste = (e) => {
    e.preventDefault();

    // Get pasted text from clipboard
    const pastedText = e.clipboardData.getData('text');

    // Extract only digits from pasted text
    const digits = pastedText.replace(/\D/g, '').slice(0, 6);

    // If we have digits, fill the OTP fields
    if (digits.length > 0) {
      const newOtpDigits = ['', '', '', '', '', ''];

      // Fill the digits array with pasted digits
      for (let i = 0; i < digits.length; i++) {
        newOtpDigits[i] = digits[i];
      }

      setOtpDigits(newOtpDigits);

      // Auto-focus the next empty field or last field if complete
      const nextIndex = Math.min(digits.length, 5);
      if (digits.length === 6) {
        // All digits filled, focus on last field
        otpInputs.current[5]?.focus();
      } else {
        // Focus on the next empty field
        otpInputs.current[nextIndex]?.focus();
      }
    }
  };

  return (
    <>
      <div className="guest-booking-flow page-container">
        <div className="page-main-guest">
          <div className="page-header">
            <h1 className="page-title">Guest Booking - Email Verification</h1>
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

              <div className="guest-booking-form centered">
                {step === 'email' ? (
                  <>
                    <form onSubmit={(e) => handleSendOTP(e, emailCheckResult === 'existing' ? null : 'new')}>
                      <div className="form-group">
                        <label htmlFor="email">Email Address *</label>
                        <div className="email-input-wrapper">
                          <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            disabled={loading}
                            required
                          />
                          {checkingEmail && (
                            <span className="email-checking-spinner">
                              <Loader size={14} className="spinner" />
                            </span>
                          )}
                        </div>
                        <small>We'll send an OTP to this email</small>

                        {/* Existing email — show follow-up / new booking choice */}
                        {emailCheckResult === 'existing' && !loading && (
                          <div className="returning-guest-box">
                            <h3 className="returning-guest-title">🔁 Previous Booking Found</h3>
                            <p className="returning-guest-desc">
                              This email has been used for a booking before. Choose how you'd like to proceed:
                            </p>
                            <div className="returning-guest-actions">
                              <button
                                type="button"
                                className="btn btn-followup"
                                disabled={loading || checkingEmail}
                                onClick={() => handleSendOTP(null, 'follow_up')}
                              >
                                {loading ? <><Loader size={16} className="spinner" /> Sending OTP...</> : '🔁 Book Follow-up Session'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-new-session"
                                disabled={loading || checkingEmail}
                                onClick={() => handleSendOTP(null, 'new')}
                              >
                                {loading ? <><Loader size={16} className="spinner" /> Sending OTP...</> : '➕ Book New Session'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* New email — show normal Send OTP button */}
                        {emailCheckResult !== 'existing' && (
                          <button
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={loading || checkingEmail}
                          >
                            {loading ? (
                              <><Loader size={16} className="spinner" /> Sending OTP...</>
                            ) : checkingEmail ? (
                              <><Loader size={16} className="spinner" /> Checking email...</>
                            ) : (
                              <>Send OTP</>
                            )}
                          </button>
                        )}
                      </div>
                    </form>

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
                  </>
                ) : (
                  <>
                    <form onSubmit={handleVerifyOTP}>
                      <div className="form-group">
                        <label>Enter OTP *</label>
                        <p className="otp-sent-hint">
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
                              onPaste={handleOtpPaste}
                              className="otp-input-box"
                              placeholder="0"
                              disabled={loading}
                              required
                            />
                          ))}
                        </div>

                        {/* Resend OTP Section */}
                        <div style={{ marginTop: '15px', textAlign: 'center' }}>
                          {resendTimer > 0 ? (
                            <small style={{ color: '#666' }}>
                              Resend OTP in {resendTimer} seconds
                            </small>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResendOTP}
                              disabled={loading}
                              className="btn btn-link"
                              style={{ fontSize: '14px', padding: '5px 10px' }}
                            >
                              Resend OTP
                            </button>
                          )}
                        </div>
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
                    <div className="instruction-box">
                      <h3>🔐 Enter OTP</h3>
                      <p>
                        A 6-digit OTP has been sent to <strong>{email}</strong>
                      </p>
                      <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                        Didn't receive it? Check your spam folder or try again.
                      </p>
                    </div>


                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuestBookingStep1;
