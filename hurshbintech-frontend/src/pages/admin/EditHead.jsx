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
import '../../styles/Pages.css';

const EditHead = () => {
  const navigate = useNavigate();
  const { headId } = useParams();
  const { user: _user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
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
  const [referenceFiles, setReferenceFiles] = useState([]); // New files to upload
  const [existingReferenceFiles, setExistingReferenceFiles] = useState([]); // Existing files from backend
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
        email: data.email || '',
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
      
      // Set existing reference files
      setExistingReferenceFiles(data.reference_data || []);
      
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

  const handleDeleteExistingFile = async (referenceId) => {
    try {
      await adminService.deleteHeadReferenceFile(headId, referenceId);
      setExistingReferenceFiles(prev => prev.filter(file => file.id !== referenceId));
      toast.success('Reference file deleted successfully', {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (error) {
      console.error('Error deleting reference file:', error);
      toast.error('Failed to delete reference file', {
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
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://192.168.1.102:8000/api';
    const backendUrl = apiBaseUrl.replace('/api', '');
    const fullUrl = `${backendUrl}${filePath}`;
    window.open(fullUrl, '_blank');
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
      // Prepare FormData for submission (to handle file uploads)
      const submitData = new FormData();
      
      // Add all text fields (only non-readonly fields)
      Object.keys(formData).forEach(key => {
        // Skip readonly fields
        if (['id', 'role', 'passcode', 'created_at', 'created_by'].includes(key)) {
          return;
        }
        
        if (key === 'number_of_sessions_done') {
          submitData.append(key, parseInt(formData[key]) || 0);
        } else if (key === 'age') {
          if (formData[key]) submitData.append(key, parseInt(formData[key]));
        } else {
          submitData.append(key, formData[key] || '');
        }
      });

      // Add reference files
      referenceFiles.forEach(file => {
        submitData.append('reference_files', file);
      });

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
    <div className="page-container">
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

      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate('/admin/manage-heads')}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Manage Heads
            </button>
            <h1 className="page-title">
              Edit Head Profile
            </h1>
            <p className="page-description">Update profile information for {formData.name}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="form-container">

            {/* Read-only Info */}
            <div className="info-box">
              <div className="info-grid">
                <div>
                  <p className="info-label">Head ID</p>
                  <p className="info-value">#{originalData?.id}</p>
                </div>
                <div>
                  <p className="info-label">Passcode</p>
                  <p className="info-value">{originalData?.passcode}</p>
                </div>
                <div>
                  <p className="info-label">Role</p>
                  <p className="info-value">{originalData?.role}</p>
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

                {/* Existing Reference Files */}
                {existingReferenceFiles.length > 0 && (
                  <div className="existing-files-section">
                    <h4 className="subsection-title">Existing Reference Files</h4>
                    <div className="file-list">
                      {existingReferenceFiles.map((file) => (
                        <div key={file.id} className="file-item">
                          <span className="file-name">{file.file_name || file.description || 'Unnamed File'}</span>
                          <div className="file-actions">
                            <button
                              type="button"
                              onClick={(e) => handleViewFile(file.file_path, e)}
                              className="btn-view-file"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExistingFile(file.id)}
                              className="file-remove-btn"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New File List */}
                {referenceFiles.length > 0 && (
                  <div className="new-files-section">
                    <h4 className="subsection-title">New Files to Upload</h4>
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
            <div className="form-actions form-actions-split">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
                className="btn-danger btn-icon"
              >
                <svg className="icon-sm" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Delete Head
              </button>

              <div className="form-actions-group">
                <button
                  type="button"
                  onClick={() => navigate('/admin/manage-heads')}
                  disabled={saving || deleting}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="btn-primary btn-icon"
                >
                  {saving ? (
                    <>
                      <div className="btn-spinner"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="icon-sm" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
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
