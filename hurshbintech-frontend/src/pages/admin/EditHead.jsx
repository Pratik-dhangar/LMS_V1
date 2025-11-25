import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import adminService from '../../api/services/adminService';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import ConfirmModal from '../../components/common/ConfirmModal';
import BasicInfoSection from '../../components/admin/EditHead/BasicInfoSection';
import ProfessionalInfoSection from '../../components/admin/EditHead/ProfessionalInfoSection';
import PersonalDetailsSection from '../../components/admin/EditHead/PersonalDetailsSection';
import PerformanceFeedbackSection from '../../components/admin/EditHead/PerformanceFeedbackSection';
import NotesSection from '../../components/admin/EditHead/NotesSection';

const EditHead = () => {
  const navigate = useNavigate();
  const { headId } = useParams();
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

  const [originalData, setOriginalData] = useState(null);
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchHeadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headId]);

  
  const fetchHeadData = async () => {
    try {
      setLoading(true);
      setFetchError('');
      const data = await adminService.getHeadById(headId);
      
      // Format date for input and handle null/undefined values
      const formattedData = {
        name: data.name || '',
        age: data.age || '',
        address: data.address || '',
        contact_no: data.contact_no || '',
        qualification: data.qualification || '',
        experience: data.experience || '',
        date_of_joining: data.date_of_joining 
          ? new Date(data.date_of_joining).toISOString().split('T')[0]
          : '',
        experience_with_hurshbin: data.experience_with_hurshbin || '',
        interest: data.interest || '',
        self_description: data.self_description || '',
        future_vision: data.future_vision || '',
        number_of_sessions_done: data.number_of_sessions_done || 0,
        head_description: data.head_description || '',
        learners_guardian_description: data.learners_guardian_description || '',
        input_at_hurshbin: data.input_at_hurshbin || '',
        note_box: data.note_box || '',
        message_box: data.message_box || '',
        // read only data
        id: data.id,
        role: data.role,
        passcode: data.passcode,
        created_at: data.created_at,
        created_by: data.created_by
      };
      
      setFormData(formattedData);
      setOriginalData(formattedData);
    } catch (error) {
      console.error('Error fetching head data:', error);
      setFetchError('Failed to load head data. Please try again.');
      toast.error('Failed to load head data', {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

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
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.contact_no.trim()) {
      newErrors.contact_no = 'Contact number is required';
    } else if (!/^\+?[\d\s\-()]+$/.test(formData.contact_no)) {
      newErrors.contact_no = 'Invalid contact number format';
    }
    
    if (formData.age && (isNaN(formData.age) || formData.age < 18 || formData.age > 100)) {
      newErrors.age = 'Age must be between 18 and 100';
    }
    
    if (formData.date_of_joining && new Date(formData.date_of_joining) > new Date()) {
      newErrors.date_of_joining = 'Date of joining cannot be in the future';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setSaving(true);
    
    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        number_of_sessions_done: parseInt(formData.number_of_sessions_done) || 0
      };
      
      // Remove read-only fields
      delete submitData.id;
      delete submitData.role;
      delete submitData.passcode;
      delete submitData.created_at;
      delete submitData.created_by;
      
      // Update head
      await adminService.updateHead(headId, submitData);
      
      toast.success('Head profile updated successfully!', {
        position: "top-center",
        autoClose: 3000,
        theme: "colored",
      });
      
      // Refresh data
      await fetchHeadData();
      
    } catch (error) {
      console.error('Error updating head:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to update head profile. Please try again.';
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 5000,
        theme: "colored",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    
    try {
      await adminService.deleteHead(headId);
      
      toast.success('Head deleted successfully!', {
        position: "top-center",
        autoClose: 2000,
        theme: "colored",
      });
      
      setTimeout(() => {
        navigate('/admin/manage-heads');
      }, 1500);
      
    } catch (error) {
      console.error('Error deleting head:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to delete head. Please try again.';
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 5000,
        theme: "colored",
      });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return <Loader message="Loading head profile..." />;
  }

  if (fetchError) {
    return (
      <ErrorState 
        title="Error Loading Profile"
        message={fetchError}
        buttonText="Back to Manage Heads"
        buttonPath="/admin/manage-heads"
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Head"
        message={`Are you sure you want to delete ${formData.name}? All associated data will be permanently removed.`}
        confirmText="Delete Head"
        cancelText="Cancel"
        loading={deleting}
        variant="danger"
      />
      
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 md:px-4 md:py-6">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/admin/manage-heads')}
              className="text-blue-600 hover:text-blue-800 font-medium mb-4 flex items-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Manage Heads
            </button>
            <h1 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-800 pb-3 md:text-2xl">
              Edit Head Profile
            </h1>
            <p className="text-gray-600 mt-2">Update profile information for {formData.name}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-6">
            
            {/* Read-only Info */}
            <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-blue-800 mb-1">Head ID</p>
                  <p className="text-sm font-semibold text-blue-900">#{originalData?.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-800 mb-1">Passcode</p>
                  <p className="text-sm font-semibold text-blue-900">{originalData?.passcode}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-800 mb-1">Role</p>
                  <p className="text-sm font-semibold text-blue-900 capitalize">{originalData?.role}</p>
                </div>
              </div>
            </div>

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

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between pt-6 border-t border-gray-300">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Delete Head
              </button>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/admin/manage-heads')}
                  disabled={saving || deleting}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EditHead;
