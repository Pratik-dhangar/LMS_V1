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
import "../../styles/components/common/ModernForm.css";
import "../../styles/ManageUsersLayout.css";

// register trainer
const RegisterTrainer = () => {
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
  });

  const [referenceFiles, setReferenceFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successData, setSuccessData] = useState(null);

  //   Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setReferenceFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setReferenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Validate form data before submission
  const validate = () => {
    const newErrors = {};

    // Required fields validation
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
    } else if (!/^[A-Za-z0-9\+\s\-()]+$/.test(formData.contact_no)) {
      newErrors.contact_no = "Invalid contact number format";
    }

    if (!formData.age) {
      newErrors.age = "Age is required";
    } else if (isNaN(formData.age) || formData.age < 18 || formData.age > 100) {
      newErrors.age = "Age must be between 18 and 100";
    }

    if (!formData.date_of_joining) {
      newErrors.date_of_joining = "Date of joining is required";
    } else if (new Date(formData.date_of_joining) > new Date()) {
      newErrors.date_of_joining = "Date of joining cannot be in the future";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    return newErrors;
  };

  //   Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setSubmitError("");
    setErrors({});

    // Validate form
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      // Scroll to first error
      const firstErrorField = Object.keys(validationErrors)[0];
      const errorElement = document.getElementsByName(firstErrorField)[0];
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        errorElement.focus();
      }

      // Show error toast
      toast.error("Please fill in all required fields correctly", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });

      return;
    }

    setLoading(true);
    setSuccessData(null);

    try {
      // Prepare FormData for submission (to support file uploads)
      const submitFormData = new FormData();

      // Append all form fields
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== "") {
          submitFormData.append(key, formData[key]);
        }
      });

      // Append reference files
      referenceFiles.forEach((file) => {
        submitFormData.append("reference_files", file);
      });

      // Create trainer
      const result = await headService.createTrainer(submitFormData);

      // Set success data to show in overlay
      setSuccessData(result);

      // Show success toast with passcode
      toast.success(
        `Trainer registered successfully! Passcode: ${result.passcode}`,
        {
          position: "top-center",
          autoClose: 4000,
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
        navigate("/admin/manage-heads");
      }, 3500);
    } catch (error) {
      console.error("Error registering trainer:", error);
      setLoading(false);

      // Handle validation errors from backend (422)
      if (error.response?.status === 422) {
        const backendErrors = {};
        const validationDetails = error.response.data?.detail;

        if (Array.isArray(validationDetails)) {
          // FastAPI validation error format
          validationDetails.forEach((err) => {
            const fieldName = err.loc?.[1]; // loc is like ['body', 'field_name']
            if (fieldName) {
              backendErrors[fieldName] = err.msg || "Invalid value";
            }
          });
          setErrors(backendErrors);

          // Show general error message
          const errorMessage = "Please check the form for validation errors";
          setSubmitError(errorMessage);
          toast.error(errorMessage, {
            position: "top-center",
            autoClose: 4000,
            theme: "colored",
          });
        } else if (typeof validationDetails === "string") {
          setSubmitError(validationDetails);
          toast.error(validationDetails, {
            position: "top-center",
            autoClose: 4000,
            theme: "colored",
          });
        }
      } else {
        // Handle other errors
        const errorMessage =
          error.response?.data?.detail ||
          error.message ||
          "Failed to register trainer. Please try again.";
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
      {/* Loading/Success Overlay */}
      {loading && (
        <div className="modern-form-overlay">
          <div className="modern-form-overlay-content">
            {!successData ? (
              // Loading State
              <>
                <div className="modern-form-spinner"></div>
                <p className="modern-form-overlay-title">
                  Registering Trainer...
                </p>
                <p className="modern-form-overlay-message">
                  Please wait while we process your request
                </p>
              </>
            ) : (
              // Success State
              <>
                <div className="modern-form-success-icon">
                  <svg
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
                <p className="modern-form-success-title">
                  Trainer Registered Successfully!
                </p>
                <div className="modern-form-passcode-display">
                  <p className="modern-form-passcode-label">Generated Passcode:</p>
                  <p className="modern-form-passcode-value">{successData.passcode}</p>
                </div>
                <p className="modern-form-overlay-message">Redirecting to dashboard...</p>
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
              onClick={() => navigate("/head/manage-trainers")}
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
              Back to Manage Trainers
            </button>
            <div>
              <h1 className="page-title">Register New Trainer</h1>
              <p className="page-description">
                Fill in the details to register a new HurshBin Trainer
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
              <FormSection
                title="Reference Data"
                description="Upload documents, images, videos, or other reference materials"
              >
                <div className="modern-form-grid-full">
                  <FormFileUpload
                    label="Upload Reference Data"
                    name="reference_files"
                    files={referenceFiles}
                    onChange={handleFileChange}
                    onRemove={removeFile}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
                    multiple={true}
                    helpText="Supported formats: PDF, DOCX, Images, Videos"
                  />
                </div>
              </FormSection>

              {/* Notes & Messages */}
              <NotesSection formData={formData} handleChange={handleChange} />

              {/* Submit Button */}
              <div className="modern-form-actions">
                <button
                  type="button"
                  onClick={() => navigate("/head/manage-trainers")}
                  className="modern-form-btn modern-form-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="modern-form-btn modern-form-btn-primary"
                >
                  {loading ? "Registering..." : "Register Trainer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterTrainer;
