import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { toast } from 'react-toastify';
import headService from '../../api/services/headService';

// Form Section Components
import PersonalDetailsSection from '../../components/head/RegisterLearner/PersonalDetailsSection';
import DeliveryHistorySection from '../../components/head/RegisterLearner/DeliveryHistorySection';
import MedicalHistorySection from '../../components/head/RegisterLearner/MedicalHistorySection';
import LearningHistorySection from '../../components/head/RegisterLearner/LearningHistorySection';
import InterventionHistorySection from '../../components/head/RegisterLearner/InterventionHistorySection';
import AssessmentBehaviourSection from '../../components/head/RegisterLearner/AssessmentBehaviourSection';
import SkillDevelopmentSection from '../../components/head/RegisterLearner/SkillDevelopmentSection';

const RegisterLearner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    // Personal details
    name: '',
    age: '',
    dob: '',
    date_of_assessment: '',
    dlb_concerns_checklist: [],  // Initialize as empty array
    personal_notes: '',
    
    // Delivery History
    mother_bed_rest: null,
    mother_bed_rest_duration: '',
    mother_depressed_fearful: null,
    ultrasounds_performed: '',
    was_premature: null,
    premature_weeks: '',
    was_overdue: null,
    overdue_duration: '',
    caesarean_delivery: null,
    caesarean_type: '',
    forceps_delivery: null,
    vacuum_delivery: null,
    very_fast_labor: null,
    induced_delivery: null,
    very_long_slow_labor: null,
    conception_type: '',
    was_adopted: null,
    adoption_age: '',
    in_incubator: null,
    incubator_reason: '',
    had_jaundice: null,
    delivery_other_details: '',
    
    // Medical History
    screamed_as_baby: null,
    difficult_sleep_pattern: null,
    struggled_changing_routines: null,
    difficulties_shifting_food: null,
    physical_milestones_achieved: null,
    vocal_language_milestones_achieved: null,
    major_illness_hospitalization: null,
    major_illness_details: '',
    specific_medical_details: '',
    
    // Learning History
    years_school_attended: '',
    support_provided: '',
    current_grade: '',
    current_learning_scenario: '',
    
    // Intervention History
    intervention_duration: '',
    intervention_notes: '',
    
    // Assessment Behaviour
    assessment_behaviour_notes: '',
    
    // Skill Development
    skill_development_assessment: ''
  });

  const [referenceFiles, setReferenceFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    if (type === 'radio') {
      // For boolean fields with radio buttons
      setFormData(prev => ({
        ...prev,
        [name]: value === 'true' ? true : value === 'false' ? false : value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
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

  // Validate form data
  const validate = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    // Age is required
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (isNaN(formData.age) || formData.age < 1 || formData.age > 25) {
      newErrors.age = 'Age must be between 1 and 25';
    }
    
    // Date of Birth is required
    if (!formData.dob) {
      newErrors.dob = 'Date of birth is required';
    } else if (new Date(formData.dob) > new Date()) {
      newErrors.dob = 'Date of birth cannot be in the future';
    }
    
    // Date of Assessment is required
    if (!formData.date_of_assessment) {
      newErrors.date_of_assessment = 'Date of assessment is required';
    } else if (new Date(formData.date_of_assessment) > new Date()) {
      newErrors.date_of_assessment = 'Assessment date cannot be in the future';
    }
    
    // DLB Concerns Checklist is required (at least one item)
    if (!formData.dlb_concerns_checklist || !Array.isArray(formData.dlb_concerns_checklist) || formData.dlb_concerns_checklist.length === 0) {
      newErrors.dlb_concerns_checklist = 'Please select at least one DLB concern';
    }
    
    // Personal Notes is required
    if (!formData.personal_notes.trim()) {
      newErrors.personal_notes = 'Personal notes is required';
    }
    
    return newErrors;
  };

  // Handle form submission
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
      // Prepare the data for submission
      const submitData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        ultrasounds_performed: formData.ultrasounds_performed ? parseInt(formData.ultrasounds_performed) : null,
        years_school_attended: formData.years_school_attended ? parseInt(formData.years_school_attended) : null,
      };

      // Remove empty strings and convert to null
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          submitData[key] = null;
        }
      });

      console.log('Submitting learner data:', submitData);
      const response = await headService.createLearner(submitData);
      
      console.log('Learner registered successfully:', response);
      setSuccessData(response);
      
      toast.success('Learner registered successfully!', {
        position: 'top-center',
        autoClose: 3000,
        theme: "colored",
      });

      // Redirect after showing success
      setTimeout(() => {
        setLoading(false);
        navigate('/head/manage-learners');
      }, 3000);

    } catch (error) {
      console.error('Error registering learner:', error);
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
        const errorMsg = error.response?.data?.detail || 
                        error.message || 
                        'Failed to register learner. Please try again.';
        setSubmitError(errorMsg);
        toast.error(errorMsg, {
          position: 'top-center',
          autoClose: 5000,
          theme: "colored",
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      {/* Loading/Success Modal */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-10 flex flex-col items-center shadow-2xl max-w-md mx-4">
            {!successData ? (
              <>
                <div className="relative">
                  <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-blue-600"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="h-12 w-12 bg-blue-100 rounded-full"></div>
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-800 mt-6">Registering Learner...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait while we process your request</p>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-green-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-xl font-bold text-green-600 mt-6">Learner Registered Successfully!</p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 w-full">
                  <p className="text-sm font-medium text-gray-700 mb-1">Generated Passcode:</p>
                  <p className="text-2xl font-bold text-blue-600 text-center tracking-wider">{successData.passcode}</p>
                </div>
                <p className="text-sm text-gray-600 mt-4">Redirecting to manage learners...</p>
              </>
            )}
          </div>
        </div>
      )}
      
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 md:px-4 md:py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-800 pb-3 md:text-2xl">
              Register New Learner
            </h1>
            <p className="text-gray-600 mt-2">Fill in the details to register a new learner</p>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="bg-red-50 border-2 border-red-500 text-red-800 p-4 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p>{submitError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-6">
            
            {/* Personal Details */}
            <PersonalDetailsSection 
              formData={formData} 
              errors={errors} 
              handleChange={handleChange}
              handleFileChange={handleFileChange}
              referenceFiles={referenceFiles}
              removeFile={removeFile}
            />

            {/* Delivery History */}
            <DeliveryHistorySection 
              formData={formData} 
              handleChange={handleChange} 
            />

            {/* Medical History */}
            <MedicalHistorySection 
              formData={formData} 
              handleChange={handleChange} 
            />

            {/* Learning History */}
            <LearningHistorySection 
              formData={formData} 
              handleChange={handleChange} 
            />

            {/* Intervention History */}
            <InterventionHistorySection 
              formData={formData} 
              handleChange={handleChange}
              handleFileChange={handleFileChange}
              referenceFiles={referenceFiles}
              removeFile={removeFile}
            />

            {/* Assessment Behaviour */}
            <AssessmentBehaviourSection 
              formData={formData} 
              handleChange={handleChange} 
            />

            {/* Skill Development */}
            <SkillDevelopmentSection 
              formData={formData} 
              handleChange={handleChange} 
            />

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-300">
              <button
                type="button"
                onClick={() => navigate('/head/manage-learners')}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : 'Register Learner'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RegisterLearner;
