import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Clock, CheckCircle, AlertCircle, Loader, Download, X, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import bookingService from '../../api/services/bookingService';
import '../../styles/GuestBooking.css';
import '../../styles/ManageUsersLayout.css';

const GuestPaymentUpload = () => {
  const { uploadToken } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [expiryTime, setExpiryTime] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [copiedField, setCopiedField] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        setValidating(true);
        // Attempt to fetch appointment details with token
        const data = await bookingService.validatePaymentToken(uploadToken);
        console.log('[GuestPaymentUpload] Token validation response:', data);
        console.log('[GuestPaymentUpload] upload_token_expires_at:', data.upload_token_expires_at);
        setAppointment(data);
        const expiryDate = new Date(data.upload_token_expires_at);
        console.log('[GuestPaymentUpload] Parsed expiry date:', expiryDate);
        console.log('[GuestPaymentUpload] Is valid date?', !isNaN(expiryDate.getTime()));
        setExpiryTime(expiryDate);
        setTokenValid(true);
      } catch (err) {
        console.error('Token validation error:', err);
        setTokenValid(false);
        toast.error('Invalid or expired payment link');
      } finally {
        setValidating(false);
      }
    };

    if (uploadToken) {
      validateToken();
    }
  }, [uploadToken]);

  // Token expiry countdown - updates every second
  useEffect(() => {
    if (!expiryTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = expiryTime - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        setTokenValid(false);
        toast.error('Payment link has expired');
        return false; // Stop the interval
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      return true; // Continue the interval
    };

    // Update immediately
    const shouldContinue = updateCountdown();

    if (!shouldContinue) return;

    // Then update every second
    const timer = setInterval(() => {
      const shouldContinue = updateCountdown();
      if (!shouldContinue) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryTime]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload JPG, PNG, or PDF files only');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success(`${field} copied!`);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error('Please select a payment receipt file');
      return;
    }

    try {
      setUploading(true);

      const response = await bookingService.uploadGuestPayment(uploadToken, selectedFile);

      toast.success('Payment uploaded successfully! Coach will review shortly.');

      // Show success message
      setTimeout(() => {
        navigate('/guest-payment/success', {
          state: {
            appointmentId: response.appointment_id,
            message: response.message
          }
        });
      }, 1500);
    } catch (err) {
      toast.error(err.detail || 'Failed to upload payment');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  if (validating) {
    return (
      <>
        <div className="page-container">
          <div className="page-main">
            <div className="page-content">
              <div className="guest-booking-card">
                <div className="loading-container">
                  <Loader size={40} className="spinner" />
                  <p>Validating payment link...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!tokenValid) {
    return (
      <>
        <div className="page-container">
          <div className="page-main">
            <div className="page-content">
              <div className="guest-booking-card">
                <div className="error-container">
                  <AlertCircle size={60} color="#ef4444" />
                  <h2>Payment Link Invalid or Expired</h2>
                  <p>This payment upload link is no longer valid.</p>

                  <div className="instruction-box" style={{ marginTop: '2rem' }}>
                    <p>
                      <strong>Next steps:</strong> Contact your coach to request a new payment upload link,
                      or reply to the email you received with your booking confirmation.
                    </p>
                  </div>

                  <button
                    className="btn app-modal-btn app-modal-btn--primary"
                    onClick={() => navigate('/')}
                  >
                    Return to Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="guest-booking-flow page-container">
        <div className="page-main-guest">
          <div className="page-header">
            <h1 className="page-title">Payment Receipt Upload</h1>
            <p className="page-subtitle">Complete your booking by uploading payment proof</p>
          </div>

          <div className="page-content">
            <div className="guest-booking-card">
              {/* Appointment Summary */}
              {appointment && (
                <div className="appointment-summary">
                  <h3>Booking Details</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Coach:</span>
                      <span className="summary-value">{appointment.coach_name || 'Assigned Coach'}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Date:</span>
                      <span className="summary-value">{new Date(appointment.scheduled_date).toLocaleDateString()}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Time:</span>
                      <span className="summary-value">{appointment.scheduled_time}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Session Type:</span>
                      <span className="summary-value">
                        {appointment.session_type?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Token Expiry Warning */}
              <div className="token-expiry-box">
                <Clock size={20} />
                <div>
                  <p><strong>Link expires in:</strong> {timeRemaining || 'Calculating...'}</p>
                  <p style={{ fontSize: '0.875rem' }}>Upload your payment receipt before this link expires</p>
                </div>
              </div>

              {/* Payment Methods Section */}
              <div>
                <h3 style={{ marginBottom: '1.5rem', color: '#1f2937', fontSize: '1.125rem', fontWeight: '600' }}>Payment Methods</h3>
                <div className="payment-methods-grid">
                  {/* UPI QR Code */}
                  <div className="payment-method-card">
                    <h4>📱 UPI Payment</h4>
                    <p style={{ marginBottom: '1rem' }}>Scan this QR code to pay instantly</p>
                    <div
                      className="qr-code-container"
                      onClick={() => setShowQRModal(true)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view larger QR code"
                    >
                      <img
                        src="/upi-qr.jpeg"
                        alt="UPI QR Code"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          console.warn('QR code image not found');
                        }}
                      />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>Click to view larger | Scan with any UPI app</p>
                  </div>

                  {/* Bank Details */}
                  <div className="payment-method-card">
                    <h4>🏦 Bank Transfer</h4>
                    <p style={{ marginBottom: '1rem' }}>Use these details for direct transfer</p>

                    <div className="bank-details-section">
                      {/* Account Name */}
                      <div className="bank-detail-item">
                        <span className="bank-detail-label">Account Name</span>
                        <span className="bank-detail-value">HurshBin</span>
                        <button
                          type="button"
                          className="copy-button"
                          onClick={() => copyToClipboard('HurshBin', 'Account Name')}
                          title="Copy to clipboard"
                        >
                          <Copy size={16} />
                        </button>
                      </div>

                      {/* Account Number */}
                      <div className="bank-detail-item">
                        <span className="bank-detail-label">Account No.</span>
                        <span className="bank-detail-value">50200034124439</span>
                        <button
                          type="button"
                          className="copy-button"
                          onClick={() => copyToClipboard('50200034124439', 'Account Number')}
                          title="Copy to clipboard"
                        >
                          <Copy size={16} />
                        </button>
                      </div>

                      {/* IFSC Code */}
                      <div className="bank-detail-item">
                        <span className="bank-detail-label">IFSC Code</span>
                        <span className="bank-detail-value">HDFC0000538</span>
                        <button
                          type="button"
                          className="copy-button"
                          onClick={() => copyToClipboard('HDFC0000538', 'IFSC Code')}
                          title="Copy to clipboard"
                        >
                          <Copy size={16} />
                        </button>
                      </div>

                      {/* Bank Name */}
                      <div className="bank-detail-item">
                        <span className="bank-detail-label">Bank</span>
                        <span className="bank-detail-value">HDFC Bank</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Form */}
              <form onSubmit={handleUpload} className="guest-booking-form">
                <div className="form-section">
                  <div className="section-header-guest">
                    <Upload size={20} />
                    <h3>Upload Payment Receipt</h3>
                  </div>

                  <div className="instruction-box">
                    <p>
                      Upload a screenshot or PDF of your payment receipt.
                      <br />
                      Supported formats: JPG, PNG, PDF (Max 5MB)
                    </p>
                  </div>

                  {/* File Preview */}
                  {previewUrl && (
                    <div className="file-preview-container">
                      <div className="file-preview">
                        <img src={previewUrl} alt="Preview" />
                        <button
                          type="button"
                          className="btn-remove-file"
                          onClick={clearFileSelection}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedFile && !previewUrl && (
                    <div className="file-selected-box">
                      <div className="file-info">
                        <Download size={20} />
                        <div>
                          <p className="file-name">{selectedFile.name}</p>
                          <p className="file-size">
                            {(selectedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={clearFileSelection}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* File Input */}
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      id="payment-file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="file-input-hidden"
                    />
                    <label htmlFor="payment-file" className="file-input-label">
                      <Upload size={24} />
                      <p>Click to upload or drag and drop</p>
                      <small>JPG, PNG or PDF (max 5MB)</small>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader size={16} className="spinner" />
                      Uploading...
                    </>
                  ) : (
                    'Upload Payment Receipt'
                  )}
                </button>
              </form>

              {/* Instructions */}
              <div className="instruction-box">
                <h4>Payment Upload Tips:</h4>
                <ul className="tips-list">
                  <li>Take a clear screenshot of your payment confirmation</li>
                  <li>Include payment amount, date, and transaction ID</li>
                  <li>Ensure the document is clearly readable</li>
                  <li>You'll receive a confirmation email after upload</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQRModal && (
          <div className="qr-modal-overlay" onClick={() => setShowQRModal(false)}>
            <div className="qr-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="qr-modal-header">
                <h2>UPI QR Code</h2>
                <button
                  className="qr-modal-close"
                  onClick={() => setShowQRModal(false)}
                  title="Close"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="qr-modal-content">
                <img
                  src="/upi-qr.jpeg"
                  alt="UPI QR Code - Full Size"
                  className="qr-modal-image"
                />
                <p className="qr-modal-instructions">📱 Scan this QR code with your UPI app to make payment</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GuestPaymentUpload;
