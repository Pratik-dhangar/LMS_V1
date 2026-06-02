import React, { useState, useEffect, useCallback } from 'react';
import contactService from '../../api/services/contactService';
import { toast } from 'react-toastify';
import '../../styles/components/common/FreeAppointmentModal.css';

const FreeAppointmentModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    child_name: '',
    age: '',
    concerns: '',
    diagnosis: '',
    address: '',
    contact_number: '',
    reference_by: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setFormData({
      child_name: '',
      age: '',
      concerns: '',
      diagnosis: '',
      address: '',
      contact_number: '',
      reference_by: '',
    });
    setErrors({});
    setSubmitted(false);
    onClose();
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // For age — allow only digits
    if (name === 'age') {
      const numericOnly = value.replace(/\D/g, '');
      setFormData((prev) => ({ ...prev, [name]: numericOnly }));
    }
    // For contact_number — allow only digits, +, -, and spaces
    else if (name === 'contact_number') {
      const phoneOnly = value.replace(/[^0-9+\- ]/g, '');
      setFormData((prev) => ({ ...prev, [name]: phoneOnly }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.child_name.trim()) {
      newErrors.child_name = 'Child name is required';
    }

    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (parseInt(formData.age, 10) < 0 || parseInt(formData.age, 10) > 18) {
      newErrors.age = 'Age must be between 0 and 18';
    }

    if (!formData.contact_number.trim()) {
      newErrors.contact_number = 'Contact number is required';
    } else if (formData.contact_number.replace(/[^0-9]/g, '').length < 10) {
      newErrors.contact_number = 'Enter a valid contact number (min 10 digits)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      await contactService.submitFreeAppointment(formData);
      setSubmitted(true);
      toast.success('Appointment request submitted successfully!');
    } catch (error) {
      console.error('Error submitting free appointment:', error);
      const errorMessage =
        error.response?.data?.detail || 'Failed to submit appointment. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="free-appointment-overlay" onClick={handleClose}>
      <div className="free-appointment-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="free-appointment-header">
          <button className="free-appointment-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
          <h2>📅 Free Appointment</h2>
          <p>Fill in the details below and we'll get back to you</p>
        </div>

        {submitted ? (
          /* Success State */
          <div className="free-appointment-success">
            <div className="free-appointment-success-icon">✓</div>
            <h3>Request Submitted!</h3>
            <p>
              Thank you for your interest. Our team will review your request and contact you
              shortly to schedule your free appointment.
            </p>
            <button className="free-appointment-success-close" onClick={handleClose}>
              Close
            </button>
          </div>
        ) : (
          /* Form */
          <form className="free-appointment-body" onSubmit={handleSubmit} noValidate>
            {/* Child Name */}
            <div className={`free-appointment-field ${errors.child_name ? 'has-error' : ''}`}>
              <label>
                Child Name <span className="required-star">*</span>
              </label>
              <input
                type="text"
                name="child_name"
                value={formData.child_name}
                onChange={handleChange}
                placeholder="Enter child's name"
                maxLength={255}
                autoFocus
              />
              {errors.child_name && <span className="field-error">⚠ {errors.child_name}</span>}
            </div>

            {/* Age */}
            <div className={`free-appointment-field ${errors.age ? 'has-error' : ''}`}>
              <label>
                Age <span className="required-star">*</span>
              </label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="Enter age (0-18)"
                min={0}
                max={18}
              />
              {errors.age && <span className="field-error">⚠ {errors.age}</span>}
            </div>

            {/* Concerns */}
            <div className="free-appointment-field">
              <label>Concerns</label>
              <textarea
                name="concerns"
                value={formData.concerns}
                onChange={handleChange}
                placeholder="Describe any concerns..."
                rows={2}
              />
            </div>

            {/* Diagnosis */}
            <div className="free-appointment-field">
              <label>Diagnosis</label>
              <input
                type="text"
                name="diagnosis"
                value={formData.diagnosis}
                onChange={handleChange}
                placeholder="Any existing diagnosis"
              />
            </div>

            {/* Address */}
            <div className="free-appointment-field">
              <label>Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter address"
                rows={2}
              />
            </div>

            {/* Contact Number */}
            <div className={`free-appointment-field ${errors.contact_number ? 'has-error' : ''}`}>
              <label>
                Contact Number <span className="required-star">*</span>
              </label>
              <input
                type="tel"
                name="contact_number"
                value={formData.contact_number}
                onChange={handleChange}
                placeholder="Enter contact number"
                maxLength={20}
              />
              {errors.contact_number && (
                <span className="field-error">⚠ {errors.contact_number}</span>
              )}
            </div>

            {/* Reference By */}
            <div className="free-appointment-field">
              <label>Reference By</label>
              <input
                type="text"
                name="reference_by"
                value={formData.reference_by}
                onChange={handleChange}
                placeholder="Who referred you?"
                maxLength={255}
              />
            </div>

            {/* Submit */}
            <button type="submit" className="free-appointment-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="free-appointment-spinner"></span>
                  Submitting...
                </>
              ) : (
                'Submit Appointment Request'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default FreeAppointmentModal;
