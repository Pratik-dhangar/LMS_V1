import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import headService from "../../api/services/headService";
import BasicInfoSection from "../../components/admin/EditHead/BasicInfoSection";
import ProfessionalInfoSection from "../../components/admin/EditHead/ProfessionalInfoSection";
import PersonalDetailsSection from "../../components/admin/EditHead/PersonalDetailsSection";
import PerformanceFeedbackSection from "../../components/admin/EditHead/PerformanceFeedbackSection";
import NotesSection from "../../components/admin/EditHead/NotesSection";
import FormSection from "../../components/common/FormSection";
import FormFileUpload from "../../components/common/FormFileUpload";
import TextAreaField from "../../components/common/TextAreaField";
import "../../styles/components/common/ModernForm.css";
import "../../styles/ManageUsersLayout.css";

const RegisterCoach = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    age: "",
    address: "",
    contact_no: "",
    qualification: "",
    experience: "",
    date_of_joining: "",
    experience_with_hurshbin: "",
    interest: "",
    self_description: "",
    future_vision: "",
    number_of_sessions_done: 0,
    head_description: "",
    learners_guardian_description: "",
    input_at_hurshbin: "",
    note_box: "",
    message_box: "",
    availability_days: [],
    time_slots: [],
    specialization: "",
    profile_picture_url: null,
  });

  const [referenceFiles, setReferenceFiles] = useState([]);
  const DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const TIME_SLOT_OPTIONS = ["10am", "1pm", "3pm", "5pm"];

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successData, setSuccessData] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleMultiSelect = (name, value) => {
    setFormData((prev) => {
      const currentArray = Array.isArray(prev[name]) ? prev[name] : [];
      const isSelected = currentArray.includes(value);
      return {
        ...prev,
        [name]: isSelected
          ? currentArray.filter((item) => item !== value)
          : [...currentArray, value],
      };
    });
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setReferenceFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setReferenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        profile_picture_url: file,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.contact_no.trim()) {
      newErrors.contact_no = "Contact number is required";
    } else if (!/^\d{10}$/.test(formData.contact_no.replace(/\D/g, ""))) {
      newErrors.contact_no = "Please enter a valid 10-digit phone number";
    }

    if (!formData.date_of_joining) {
      newErrors.date_of_joining = "Date of joining is required";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill Mandatory fields correctly");
      return;
    }

    try {
      setLoading(true);
      setSubmitError("");

      // Prepare form data for submission
      const submitData = new FormData();

      // Add all text fields
      Object.keys(formData).forEach((key) => {
        if (key === "availability_days" || key === "time_slots") {
          // Convert arrays to comma-separated strings for backend
          submitData.append(
            key,
            Array.isArray(formData[key]) ? formData[key].join(",") : ""
          );
        } else if (key === "profile_picture_url") {
          // Handle profile picture file
          if (formData[key] instanceof File) {
            submitData.append(key, formData[key]);
          }
        } else if (key === "number_of_sessions_done") {
          submitData.append(key, parseInt(formData[key]) || 0);
        } else if (key === "age") {
          if (formData[key]) submitData.append(key, parseInt(formData[key]));
        } else {
          submitData.append(key, formData[key] || "");
        }
      });

      // Add reference files
      referenceFiles.forEach((file) => {
        submitData.append("reference_files", file);
      });

      // Call the API to create a new coach
      const newCoach = await headService.createCoach(submitData);

      // Set success data to show in overlay
      setSuccessData(newCoach);

      toast.success(
        `Coach registered successfully! Passcode: ${newCoach.passcode}`,
        {
          position: "top-center",
          autoClose: 5000,
        }
      );

      // Redirect after showing the success state
      setTimeout(() => {
        setLoading(false);
        navigate("/admin/manage-coaches");
      }, 3500);
    } catch (err) {
      console.error("Error registering coach:", err);
      setLoading(false);
      let errorMessage = "Failed to register coach. Please try again.";

      if (err.response?.status === 422) {
        // Handle validation errors
        const validationErrors = err.response.data?.detail;
        if (Array.isArray(validationErrors)) {
          errorMessage = validationErrors
            .map((e) => `${e.loc?.[1] || "Field"}: ${e.msg}`)
            .join("; ");
        } else if (typeof validationErrors === "string") {
          errorMessage = validationErrors;
        }
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setSubmitError(errorMessage);
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 5000,
      });
    }
  };

  const handleCancel = () => {
    navigate("/admin/manage-coaches");
  };

  return (
    <div className="page-container">
      {/* Loading/Success Overlay */}
      {loading && (
        <div className="app-modal-overlay">
          <div className="app-modal-content modal-sm modal-loading">
            {!successData ? (
              // Loading State
              <>
                <div className="loading-spinner-container">
                  <div className="loading-spinner"></div>
                </div>
                <p className="app-modal-title modal-title-success">
                  Registering Coach...
                </p>
                <p className="modal-message">
                  Please wait while we process your request
                </p>
              </>
            ) : (
              // Success State
              <>
                <div className="success-icon-container">
                  <div className="success-icon">
                    <svg
                      className="success-icon-svg"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <p className="app-modal-title modal-title-success">
                  Coach Registered Successfully!
                </p>
                <div className="passcode-display">
                  <p className="passcode-label">Generated Passcode:</p>
                  <p className="passcode-value">{successData.passcode}</p>
                </div>
                <p className="modal-message">
                  Redirecting to manage coaches...
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/admin/manage-coaches")}
              className="back-button"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Manage Coaches
            </button>
            <div>
              <h1 className="page-title">Register New Coach</h1>
              <p className="page-description">
                Add a new coach to the HurshBin system
              </p>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="modern-form-error-alert">
              <svg
                className="modern-form-error-icon"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="modern-form-error-text">{submitError}</p>
            </div>
          )}

          {/* Form Card */}
          <div className="modern-form-card">
            <form onSubmit={handleSubmit}>
            <BasicInfoSection
              formData={formData}
              errors={errors}
              handleChange={handleChange}
              section="coach"
            />

            <ProfessionalInfoSection
              formData={formData}
              errors={errors}
              handleChange={handleChange}
            />

            <PersonalDetailsSection
              formData={formData}
              errors={errors}
              handleChange={handleChange}
            />

            {/* Coach-Specific Information */}
            <FormSection
              title="Coach-Specific Information"
              description="Availability, specialization, and profile details"
            >
              <div className="modern-form-grid">
                {/* Availability Days */}
                <div>
                  <label className="input-field-label">
                    Availability Days <span className="input-field-required">*</span>
                  </label>
                  <div className="modern-form-checkbox-group">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day} className="modern-form-checkbox-item">
                        <input
                          type="checkbox"
                          id={`day_${day}`}
                          checked={formData.availability_days.includes(day)}
                          onChange={() =>
                            handleMultiSelect("availability_days", day)
                          }
                          className="modern-form-checkbox-input"
                        />
                        <label
                          htmlFor={`day_${day}`}
                          className="modern-form-checkbox-label"
                        >
                          {day}
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.availability_days.length > 0 && (
                    <p className="form-hint" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      Selected: {formData.availability_days.join(", ")}
                    </p>
                  )}
                </div>

                {/* Time Slots */}
                <div>
                  <label className="input-field-label">
                    Time Slots <span className="input-field-required">*</span>
                  </label>
                  <div className="modern-form-checkbox-group">
                    {TIME_SLOT_OPTIONS.map((slot) => (
                      <div key={slot} className="modern-form-checkbox-item">
                        <input
                          type="checkbox"
                          id={`slot_${slot}`}
                          checked={formData.time_slots.includes(slot)}
                          onChange={() => handleMultiSelect("time_slots", slot)}
                          className="modern-form-checkbox-input"
                        />
                        <label
                          htmlFor={`slot_${slot}`}
                          className="modern-form-checkbox-label"
                        >
                          {slot}
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.time_slots.length > 0 && (
                    <p className="form-hint" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      Selected: {formData.time_slots.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Specialization */}
              <div className="modern-form-grid-full">
                <TextAreaField
                  label="Specialization"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Coach's area of specialization"
                />
              </div>

              {/* Profile Picture */}
              <div className="modern-form-grid-full">
                <FormFileUpload
                  label="Profile Picture"
                  name="profile_picture_url"
                  files={formData.profile_picture_url ? [formData.profile_picture_url] : []}
                  onChange={handleProfileImageChange}
                  onRemove={() => setFormData(prev => ({ ...prev, profile_picture_url: null }))}
                  accept="image/*"
                  multiple={false}
                  helpText="Supported formats: JPG, PNG, GIF"
                />
              </div>

              {/* Reference Data */}
              <div className="modern-form-grid-full">
                <FormFileUpload
                  label="Reference Data"
                  name="reference_files"
                  files={referenceFiles}
                  onChange={handleFileChange}
                  onRemove={removeFile}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
                  multiple={true}
                  helpText="Documents, Images, Videos (PDF, DOCX, Images, Videos)"
                />
              </div>
            </FormSection>

            <PerformanceFeedbackSection
              formData={formData}
              errors={errors}
              handleChange={handleChange}
            />

            <NotesSection
              formData={formData}
              errors={errors}
              handleChange={handleChange}
            />

            {/* Submit Actions */}
            <div className="modern-form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="modern-form-btn modern-form-btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="modern-form-btn modern-form-btn-primary" 
                disabled={loading}
              >
                {loading ? "Registering..." : "Register Coach"}
              </button>
            </div>
          </form>
        </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterCoach;
