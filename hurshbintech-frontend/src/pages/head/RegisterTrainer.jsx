import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import headService from '../../api/services/headService';
import BasicInfoSection from '../../components/admin/EditHead/BasicInfoSection';
import ProfessionalInfoSection from '../../components/admin/EditHead/ProfessionalInfoSection';
import PersonalDetailsSection from '../../components/admin/EditHead/PersonalDetailsSection';
import PerformanceFeedbackSection from '../../components/admin/EditHead/PerformanceFeedbackSection';
import NotesSection from '../../components/admin/EditHead/NotesSection';

// register trainer 
const RegisterTrainer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
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

//   Handle input changes
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

  // Validate form data before submission
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

//   Handle form submission
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

      // Create trainer
      const result = await headService.createTrainer(submitData);

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
        navigate('/admin/manage-heads');
      }, 3500);
      
    } catch (error) {
      console.error('Error registering trainer:', error);
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
                           'Failed to register trainer. Please try again.';
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      {/* Loading/Success Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-10 flex flex-col items-center shadow-2xl max-w-md mx-4">
            {!successData ? (
              // Loading State
              <>
                <div className="relative">
                  <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-blue-600"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="h-12 w-12 bg-blue-100 rounded-full"></div>
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-800 mt-6">Registering Head...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait while we process your request</p>
              </>
            ) : (
              // Success State
              <>
                <div className="relative">
                  <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-green-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-xl font-bold text-green-600 mt-6">Head Registered Successfully!</p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 w-full">
                  <p className="text-sm font-medium text-gray-700 mb-1">Generated Passcode:</p>
                  <p className="text-2xl font-bold text-blue-600 text-center tracking-wider">{successData.passcode}</p>
                </div>
                <p className="text-sm text-gray-600 mt-4">Redirecting to dashboard...</p>
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
              Register New Trainer
            </h1>
            <p className="text-gray-600 mt-2">Fill in the details to register a new HurshBin Trainer</p>
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
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
                Reference Data
              </h2>
              <div>
                <label htmlFor="reference_files" className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Reference Data (Documents, Images, Videos, Links)
                </label>
                <input
                  type="file"
                  id="reference_files"
                  multiple
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Supported formats: PDF, DOCX, Images, Videos
                </p>
                
                {/* File List */}
                {referenceFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {referenceFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="ml-3 text-red-500 hover:text-red-700 text-sm font-medium"
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
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-300">
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : 'Register Trainer'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RegisterTrainer;
