import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import headService from "../../api/services/headService";
import Loader from "../../components/common/Loader";
import ErrorState from "../../components/common/ErrorState";
import ConfirmModal from "../../components/common/ConfirmModal";
import "../../styles/ManageUsersLayout.css";

// Form Section Components
import PersonalDetailsSection from "../../components/head/RegisterLearner/PersonalDetailsSection";
import DeliveryHistorySection from "../../components/head/RegisterLearner/DeliveryHistorySection";
import MedicalHistorySection from "../../components/head/RegisterLearner/MedicalHistorySection";
import LearningHistorySection from "../../components/head/RegisterLearner/LearningHistorySection";
import InterventionHistorySection from "../../components/head/RegisterLearner/InterventionHistorySection";
import AssessmentBehaviourSection from "../../components/head/RegisterLearner/AssessmentBehaviourSection";
import SkillDevelopmentSection from "../../components/head/RegisterLearner/SkillDevelopmentSection";
import PackageAndPaymentSection from '../../components/head/RegisterLearner/PackageAndPaymentSection';

const EditLearner = () => {
  const navigate = useNavigate();
  const { learnerId } = useParams();
  const { user: _user } = useAuth();

  const [formData, setFormData] = useState({
    // Personal details
    name: "",
    email: "",
    age: "",
    dob: "",
    date_of_assessment: "",
    dlb_concerns_checklist: [], // Initialize as empty array
    personal_notes: "",

    // Package & Payment
    package_id: '',
    discount_code: '',

    // Delivery History
    mother_bed_rest: null,
    mother_bed_rest_duration: "",
    mother_depressed_fearful: null,
    ultrasounds_performed: "",
    was_premature: null,
    premature_weeks: "",
    was_overdue: null,
    overdue_duration: "",
    caesarean_delivery: null,
    caesarean_type: "",
    forceps_delivery: null,
    vacuum_delivery: null,
    very_fast_labor: null,
    induced_delivery: null,
    very_long_slow_labor: null,
    conception_type: "",
    was_adopted: null,
    adoption_age: "",
    in_incubator: null,
    incubator_reason: "",
    had_jaundice: null,
    delivery_other_details: "",

    // Medical History
    screamed_as_baby: null,
    difficult_sleep_pattern: null,
    struggled_changing_routines: null,
    difficulties_shifting_food: null,
    physical_milestones_achieved: null,
    vocal_language_milestones_achieved: null,
    major_illness_hospitalization: null,
    major_illness_details: "",
    specific_medical_details: "",

    // Learning History
    years_school_attended: "",
    support_provided: "",
    current_grade: "",
    current_learning_scenario: "",

    // Intervention History
    intervention_duration: "",
    intervention_notes: "",

    // Assessment Behaviour
    assessment_behaviour_notes: "",

    // Skill Development
    skill_development_assessment: "",
  });

  const [originalData, setOriginalData] = useState(null);
  const [existingReferenceData, setExistingReferenceData] = useState([]);
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchLearnerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);

  const fetchLearnerData = async () => {
    try {
      setLoading(true);
      setFetchError("");
      const data = await headService.getLearnerById(learnerId);

      // Format dates and handle null/undefined values
      const formattedData = {
        name: data.name || "",
        email: data.email || "",
        age: data.age || "",
        dob: data.dob ? new Date(data.dob).toISOString().split("T")[0] : "",
        date_of_assessment: data.date_of_assessment
          ? new Date(data.date_of_assessment).toISOString().split("T")[0]
          : "",
        dlb_concerns_checklist: Array.isArray(data.dlb_concerns_checklist)
          ? data.dlb_concerns_checklist
          : [],
        personal_notes: data.personal_notes || "",

        // Package & Payment
        package_id: data.package_id || '',
        discount_code: data.discount_code || '',

        // Delivery History
        mother_bed_rest: data.mother_bed_rest,
        mother_bed_rest_duration: data.mother_bed_rest_duration || "",
        mother_depressed_fearful: data.mother_depressed_fearful,
        ultrasounds_performed: data.ultrasounds_performed || "",
        was_premature: data.was_premature,
        premature_weeks: data.premature_weeks || "",
        was_overdue: data.was_overdue,
        overdue_duration: data.overdue_duration || "",
        caesarean_delivery: data.caesarean_delivery,
        caesarean_type: data.caesarean_type || "",
        forceps_delivery: data.forceps_delivery,
        vacuum_delivery: data.vacuum_delivery,
        very_fast_labor: data.very_fast_labor,
        induced_delivery: data.induced_delivery,
        very_long_slow_labor: data.very_long_slow_labor,
        conception_type: data.conception_type || "",
        was_adopted: data.was_adopted,
        adoption_age: data.adoption_age || "",
        in_incubator: data.in_incubator,
        incubator_reason: data.incubator_reason || "",
        had_jaundice: data.had_jaundice,
        delivery_other_details: data.delivery_other_details || "",

        // Medical History
        screamed_as_baby: data.screamed_as_baby,
        difficult_sleep_pattern: data.difficult_sleep_pattern,
        struggled_changing_routines: data.struggled_changing_routines,
        difficulties_shifting_food: data.difficulties_shifting_food,
        physical_milestones_achieved: data.physical_milestones_achieved,
        vocal_language_milestones_achieved:
          data.vocal_language_milestones_achieved,
        major_illness_hospitalization: data.major_illness_hospitalization,
        major_illness_details: data.major_illness_details || "",
        specific_medical_details: data.specific_medical_details || "",

        // Learning History
        years_school_attended: data.years_school_attended || "",
        support_provided: data.support_provided || "",
        current_grade: data.current_grade || "",
        current_learning_scenario: data.current_learning_scenario || "",

        // Intervention History
        intervention_duration: data.intervention_duration || "",
        intervention_notes: data.intervention_notes || "",

        // Assessment Behaviour
        assessment_behaviour_notes: data.assessment_behaviour_notes || "",

        // Skill Development
        skill_development_assessment: data.skill_development_assessment || "",

        // Read-only data
        id: data.id,
        passcode: data.passcode,
        created_at: data.created_at,
        created_by: data.created_by,
      };

      setFormData(formattedData);
      setOriginalData(formattedData);
      setExistingReferenceData(data.reference_data || []);
    } catch (error) {
      console.error("Error fetching learner data:", error);
      const errorMsg =
        error.response?.data?.detail || "Failed to load learner data";
      setFetchError(errorMsg);
      toast.error(errorMsg, {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    if (type === "radio") {
      setFormData((prev) => ({
        ...prev,
        [name]: value === "true" ? true : value === "false" ? false : value,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

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

  const handleDeleteExistingFile = async (referenceId) => {
    if (!window.confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      await headService.deleteLearnerReferenceFile(learnerId, referenceId);
      setExistingReferenceData((prev) =>
        prev.filter((file) => file.id !== referenceId),
      );
      toast.success("File deleted successfully", {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file", {
        position: "top-center",
        autoClose: 3000,
      });
    }
  };

  const handleViewFile = (filePath, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://192.168.1.102:8000/api";
    const backendUrl = apiBaseUrl.replace("/api", "");
    const fullUrl = `${backendUrl}${filePath}`;
    window.open(fullUrl, "_blank");
  };

  const validate = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    // Age is required
    if (!formData.age) {
      newErrors.age = "Age is required";
    } else if (isNaN(formData.age) || formData.age < 1 || formData.age > 25) {
      newErrors.age = "Age must be between 1 and 25";
    }

    // Date of Birth is required
    if (!formData.dob) {
      newErrors.dob = "Date of birth is required";
    } else if (new Date(formData.dob) > new Date()) {
      newErrors.dob = "Date of birth cannot be in the future";
    }

    // Date of Assessment is required
    if (!formData.date_of_assessment) {
      newErrors.date_of_assessment = "Date of assessment is required";
    } else if (new Date(formData.date_of_assessment) > new Date()) {
      newErrors.date_of_assessment = "Assessment date cannot be in the future";
    }

    // DLB Concerns Checklist is required (at least one item)
    if (
      !formData.dlb_concerns_checklist ||
      !Array.isArray(formData.dlb_concerns_checklist) ||
      formData.dlb_concerns_checklist.length === 0
    ) {
      newErrors.dlb_concerns_checklist =
        "Please select at least one DLB concern";
    }

    // Personal Notes is required
    if (!formData.personal_notes || !formData.personal_notes.trim()) {
      newErrors.personal_notes = "Personal notes is required";
    }

    return newErrors;
  };

  const hasChanges = () => {
    if (!originalData) return false;

    // Check if there are new reference files to upload
    if (referenceFiles.length > 0) return true;

    return Object.keys(formData).some((key) => {
      if (
        key === "id" ||
        key === "passcode" ||
        key === "created_at" ||
        key === "created_by"
      ) {
        return false;
      }
      return formData[key] !== originalData[key];
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    // Clear previous errors
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

    if (!hasChanges()) {
      toast.info("No changes detected", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
      return;
    }

    setSaving(true);

    try {
      // Prepare update data
      const updateData = {};
      Object.keys(formData).forEach((key) => {
        if (
          key !== "id" &&
          key !== "passcode" &&
          key !== "created_at" &&
          key !== "created_by"
        ) {
          if (formData[key] !== originalData[key]) {
            updateData[key] = formData[key] === "" ? null : formData[key];
          }
        }
      });

      // Convert numeric fields
      if (
        updateData.age !== undefined &&
        updateData.age !== null &&
        updateData.age !== ""
      ) {
        updateData.age = parseInt(updateData.age);
      }
      if (
        updateData.ultrasounds_performed !== undefined &&
        updateData.ultrasounds_performed !== null &&
        updateData.ultrasounds_performed !== ""
      ) {
        updateData.ultrasounds_performed = parseInt(
          updateData.ultrasounds_performed,
        );
      }
      if (
        updateData.years_school_attended !== undefined &&
        updateData.years_school_attended !== null &&
        updateData.years_school_attended !== ""
      ) {
        updateData.years_school_attended = parseInt(
          updateData.years_school_attended,
        );
      }

      // Remove empty strings for enum fields (convert to null)
      if (updateData.caesarean_type === "") {
        updateData.caesarean_type = null;
      }
      if (updateData.conception_type === "") {
        updateData.conception_type = null;
      }

      console.log("Updating learner with data:", updateData);
      console.log("Reference files to upload:", referenceFiles);
      await headService.updateLearner(learnerId, updateData, referenceFiles);
      console.log('Updating learner with data:', updateData);
      console.log('Reference files to upload:', referenceFiles);
      console.log('Payment receipt file:', window.paymentReceipt);

      // Get payment receipt if it exists
      const paymentReceiptFile = window.paymentReceipt || null;

      await headService.updateLearner(learnerId, updateData, referenceFiles, paymentReceiptFile);

      toast.success("Learner updated successfully!", {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });

      // Clear reference files after successful upload
      setReferenceFiles([]);


      // Clear payment receipt
      window.paymentReceipt = null;
      const receiptInput = document.getElementById('payment_receipt_input');
      if (receiptInput) {
        receiptInput.value = '';
      }

      // Reset file input
      const fileInput = document.getElementById("intervention_reference_files");
      if (fileInput) {
        fileInput.value = "";
      }

      // Refresh data
      await fetchLearnerData();
    } catch (error) {
      console.error("Error updating learner:", error);
      setSaving(false);

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
          toast.error("Please check the form for validation errors", {
            position: "top-center",
            autoClose: 4000,
            theme: "colored",
          });
        } else if (typeof validationDetails === "string") {
          toast.error(validationDetails, {
            position: "top-center",
            autoClose: 4000,
            theme: "colored",
          });
        }
      } else {
        // Handle other errors
        const errorMsg =
          error.response?.data?.detail ||
          error.message ||
          "Failed to update learner. Please try again.";
        toast.error(errorMsg, {
          position: "top-center",
          autoClose: 5000,
          theme: "colored",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      await headService.deleteLearner(learnerId);

      toast.success("Learner deleted successfully!", {
        position: "top-center",
        autoClose: 3000,
      });

      setTimeout(() => {
        navigate("/head/manage-learners");
      }, 1000);
    } catch (error) {
      console.error("Error deleting learner:", error);
      const errorMsg =
        error.response?.data?.detail ||
        "Failed to delete learner. Please try again.";
      toast.error(errorMsg, {
        position: "top-center",
        autoClose: 5000,
      });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Loader message="Loading learner data..." />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="page-container">
        <ErrorState message={fetchError} onRetry={fetchLearnerData} />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Learner"
        message={`Are you sure you want to delete "${formData.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        isDestructive={true}
      />

      {/* Saving/Deleting Modal */}
      {(saving || deleting) && (
        <div className="app-modal-overlay modal-overlay-blur">
          <div className="modal-success">
            <div className="spinner-wrapper">
              <div className="spinner-large"></div>
              <div className="spinner-center"></div>
            </div>
            <p className="app-modal-title">
              {saving ? "Updating Learner..." : "Deleting Learner..."}
            </p>
            <p className="app-modal-subtitle">
              Please wait while we process your request
            </p>
          </div>
        </div>
      )}

      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/head/manage-learners")}
              className="back-button"
            >
              <svg
                className="icon-sm"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Manage Learners
            </button>
            <div>
              <h1 className="page-title">Edit Learner Profile</h1>
              <p className="page-description">
                Update profile information for {formData.name}
              </p>
              <h1 className="page-title">
                Edit Learner Profile
              </h1>
              <p className="page-description">Update profile information for {formData.name}</p>
            </div>
          </div>

          {/* Form */}
          <div className="modern-form-card">
            <form onSubmit={handleUpdate} className="form-container">
              <PersonalDetailsSection
                formData={formData}
                errors={errors}
                handleChange={handleChange}
              />

              <PackageAndPaymentSection
                formData={formData}
                handleChange={handleChange}
                errors={errors}
              />

              <DeliveryHistorySection
                formData={formData}
                handleChange={handleChange}
              />

              <MedicalHistorySection
                formData={formData}
                handleChange={handleChange}
              />

              <LearningHistorySection
                formData={formData}
                handleChange={handleChange}
              />

              <InterventionHistorySection
                formData={formData}
                handleChange={handleChange}
                handleFileChange={handleFileChange}
                referenceFiles={referenceFiles}
                removeFile={removeFile}
                existingReferenceData={existingReferenceData}
                handleViewFile={handleViewFile}
                handleDeleteExistingFile={handleDeleteExistingFile}
              />

              <AssessmentBehaviourSection
                formData={formData}
                handleChange={handleChange}
              />

              <SkillDevelopmentSection
                formData={formData}
                handleChange={handleChange}
              />

              {/* Action Buttons */}

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="app-modal-btn app-modal-btn--primary btn-icon"
                >
                  {saving ? (
                    <>
                      <div className="btn-spinner"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg
                        className="icon-sm"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/head/manage-learners")}
                  disabled={saving || deleting}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting}
                  className="app-modal-btn app-modal-btn--danger btn-icon"
                >
                  <svg
                    className="icon-sm"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  Delete Learner
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditLearner;
