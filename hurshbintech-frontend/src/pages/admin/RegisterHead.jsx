import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import adminService from '../../api/services/adminService';
import BasicInfoSection from '../../components/admin/EditHead/BasicInfoSection';
import ProfessionalInfoSection from '../../components/admin/EditHead/ProfessionalInfoSection';
import PersonalDetailsSection from '../../components/admin/EditHead/PersonalDetailsSection';
import PerformanceFeedbackSection from '../../components/admin/EditHead/PerformanceFeedbackSection';
import NotesSection from '../../components/admin/EditHead/NotesSection';
import '../../styles/Pages.css';

const RegisterHead = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    address: '',
    contact_no: '',
    qualification: '',
    experience: '',
    date_of_joining: '',
    experience_with_hurshbin: '',
    interest: '',
    self_description: '',
    future_vision: '',
    number_of_sessions_done: 0,
    head_description: '',
    learners_guardian_description: '',
    input_at_hurshbin: '',
    note_box: '',
    message_box: ''
  });

  const [referenceFiles, setReferenceFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setReferenceFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setReferenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.contact_no.trim()) {
      newErrors.contact_no = 'Contact number is required';
    } else if (!/^\+?[\d\s\-()]+$/.test(formData.contact_no)) {
      newErrors.contact_no = 'Invalid contact number format';
    }

    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (isNaN(formData.age) || formData.age < 18 || formData.age > 100) {
      newErrors.age = 'Age must be between 18 and 100';
    }

    if (!formData.date_of_joining) {
      newErrors.date_of_joining = 'Date of joining is required';
    } else if (new Date(formData.date_of_joining) > new Date()) {
      newErrors.date_of_joining = 'Date of joining cannot be in the future';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setSubmitError('');
    setErrors({});

    // Validate form
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      // Scroll to first error
      const firstErrorField = Object.keys(validationErrors)[0];
      const errorElement = document.getElementsByName(firstErrorField)[0];
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errorElement.focus();
      }

      // Show error toast
      toast.error('Please fill in all required fields correctly', {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });

      return;
    }

    setLoading(true);
    setSuccessData(null);

    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        number_of_sessions_done: parseInt(formData.number_of_sessions_done) || 0
      };

      // Create head
      const result = await adminService.createHead(submitData);

      // Set success data to show in overlay
      setSuccessData(result);

      // Show success toast with passcode
      toast.success(
        `Head registered successfully! Passcode: ${result.passcode}`,
        {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "colored",
        }
      );

      // Redirect after showing the success state
      setTimeout(() => {
        setLoading(false);
        navigate('/admin/manage-heads');
      }, 3500);

    } catch (error) {
      console.error('Error registering head:', error);
      setLoading(false);

      // Handle validation errors from backend (422)
      if (error.response?.status === 422) {
        const backendErrors = {};
        const validationDetails = error.response.data?.detail;

        if (Array.isArray(validationDetails)) {
          // FastAPI validation error format
          validationDetails.forEach(err => {
            const fieldName = err.loc?.[1]; // loc is like ['body', 'field_name']
            if (fieldName) {
              backendErrors[fieldName] = err.msg || 'Invalid value';
            }
          });
          setErrors(backendErrors);

          // Show general error message
          const errorMessage = 'Please check the form for validation errors';
          setSubmitError(errorMessage);
          toast.error(errorMessage, {
            position: "top-center",
            autoClose: 4000,
            theme: "colored",
          });
        } else if (typeof validationDetails === 'string') {
          setSubmitError(validationDetails);
          toast.error(validationDetails, {
            position: "top-center",
            autoClose: 4000,
            theme: "colored",
          });
        }
      } else {
        // Handle other errors
        const errorMessage = error.response?.data?.detail ||
          error.message ||
          'Failed to register head. Please try again.';
        setSubmitError(errorMessage);
        toast.error(errorMessage, {
          position: "top-center",
          autoClose: 5000,
          theme: "colored",
        });
      }
    }
  };

  return (
    <div className="page-container">
      <Navbar />

      {/* Loading/Success Overlay */}
      {loading && (
        <div className="modal-overlay">
          <div className="modal-content modal-sm modal-loading">
            {!successData ? (
              // Loading State
              <>
                <div className="loading-spinner-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-spinner-inner"></div>
                </div>
                <p className="modal-title modal-title-success">Registering Head...</p>
                <p className="modal-message">Please wait while we process your request</p>
              </>
            ) : (
              // Success State
              <>
                <div className="success-icon-container">
                  <div className="success-icon">
                    <svg className="success-icon-svg" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <p className="modal-title modal-title-success">Head Registered Successfully!</p>
                <div className="passcode-display">
                  <p className="passcode-label">Generated Passcode:</p>
                  <p className="passcode-value">{successData.passcode}</p>
                </div>
                <p className="modal-message">Redirecting to dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}

      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">

            <h1 className="page-title">
              Register New Head
            </h1>
            <p className="page-description">Fill in the details to register a new HurshBin Head</p>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="error-message">
              <div className="error-message-content">
                <svg className="error-icon" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p>{submitError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="form-container">

            {/* Basic Information */}
            <BasicInfoSection
              formData={formData}
              errors={errors}
              handleChange={handleChange}
            />

            {/* Professional Information */}
            <ProfessionalInfoSection
              formData={formData}
              handleChange={handleChange}
            />

            {/* Personal Details */}
            <PersonalDetailsSection
              formData={formData}
              handleChange={handleChange}
            />

            {/* Performance & Feedback */}
            <PerformanceFeedbackSection
              formData={formData}
              handleChange={handleChange}
            />

            {/* Reference Data Upload */}
            <div className="form-section">
              <h2 className="form-section-title">
                Reference Data
              </h2>
              <div>
                <label htmlFor="reference_files" className="form-label">
                  Upload Reference Data (Documents, Images, Videos, Links)
                </label>
                <input
                  type="file"
                  id="reference_files"
                  multiple
                  onChange={handleFileChange}
                  className="form-file-input"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
                />
                <p className="form-help-text">
                  Supported formats: PDF, DOCX, Images, Videos
                </p>

                {/* File List */}
                {referenceFiles.length > 0 && (
                  <div className="file-list">
                    {referenceFiles.map((file, index) => (
                      <div key={index} className="file-item">
                        <span className="file-name">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="file-remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Messages */}
            <NotesSection
              formData={formData}
              handleChange={handleChange}
            />

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Registering...' : 'Register Head'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RegisterHead;
