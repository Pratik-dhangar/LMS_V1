import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ConfirmModal from '../../components/common/ConfirmModal';
import headService from '../../api/services/headService';
import BasicInfoSection from '../../components/admin/EditHead/BasicInfoSection';
import ProfessionalInfoSection from '../../components/admin/EditHead/ProfessionalInfoSection';
import PersonalDetailsSection from '../../components/admin/EditHead/PersonalDetailsSection';
import PerformanceFeedbackSection from '../../components/admin/EditHead/PerformanceFeedbackSection';
import NotesSection from '../../components/admin/EditHead/NotesSection';
import '../../styles/admin/AdminEditCoach.css';
import '../../styles/ManageUsersLayout.css';

const EditCoach = () => {
  const { coachId } = useParams();
  const navigate = useNavigate();
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
    message_box: '',
    availability_days: [],
    time_slots: [],
    specialization: '',
    profile_picture_url: null,
  });

  const [existingReferenceData, setExistingReferenceData] = useState([]);
  const [existingProfilePicture, setExistingProfilePicture] = useState(null);
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TIME_SLOT_OPTIONS = ['10am', '1pm', '3pm', '5pm'];

  useEffect(() => {
    fetchCoachData();
  }, [coachId]);

  const fetchCoachData = async () => {
    try {
      setLoading(true);
      const coach = await headService.getCoachById(coachId);
      setFormData({
        name: coach.name || '',
        email: coach.email || '',
        age: coach.age || '',
        address: coach.address || '',
        contact_no: coach.contact_no || '',
        qualification: coach.qualification || '',
        experience: coach.experience || '',
        date_of_joining: coach.date_of_joining || '',
        experience_with_hurshbin: coach.experience_with_hurshbin || '',
        interest: coach.interest || '',
        self_description: coach.self_description || '',
        future_vision: coach.future_vision || '',
        number_of_sessions_done: coach.number_of_sessions_done || 0,
        head_description: coach.head_description || '',
        learners_guardian_description: coach.learners_guardian_description || '',
        input_at_hurshbin: coach.input_at_hurshbin || '',
        note_box: coach.note_box || '',
        message_box: coach.message_box || '',
        availability_days: coach.availability_days ? coach.availability_days.split(',').map(d => d.trim()) : [],
        time_slots: coach.time_slots ? coach.time_slots.split(',').map(t => t.trim()) : [],
        specialization: coach.specialization || '',
        profile_picture_url: null,
      });

      // Store existing profile picture separately
      setExistingProfilePicture(coach.profile_picture_url || null);
      setExistingReferenceData(coach.reference_data || []);
    } catch (err) {
      console.error('Error fetching coach data:', err);
      toast.error('Failed to load coach data');
      navigate('/admin/manage-coaches');
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
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleMultiSelect = (name, value) => {
    setFormData(prev => {
      const currentArray = Array.isArray(prev[name]) ? prev[name] : [];
      const isSelected = currentArray.includes(value);
      return {
        ...prev,
        [name]: isSelected
          ? currentArray.filter(item => item !== value)
          : [...currentArray, value]
      };
    });
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
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
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await adminService.deleteCoachReferenceFile(coachId, referenceId);
      setExistingReferenceData(prev => prev.filter(file => file.id !== referenceId));
      toast.success('File deleted successfully', {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file', {
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

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        profile_picture_url: file
      }));
    }
  };

  const handleViewProfilePicture = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (existingProfilePicture) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://192.168.1.102:8000/api';
      const backendUrl = apiBaseUrl.replace('/api', '');
      const fullUrl = `${backendUrl}${existingProfilePicture}`;
      window.open(fullUrl, '_blank');
    }
  };

  const handleDeleteProfilePicture = async () => {
    if (!existingProfilePicture) return;

    try {
      // Update coach with null profile picture
      await adminService.updateCoach(coachId, { profile_picture_url: null });

      setExistingProfilePicture(null);

      toast.success('Profile picture removed successfully!', {
        position: 'top-center',
        autoClose: 2000,
        theme: "colored",
      });
    } catch (error) {
      console.error('Error deleting profile picture:', error);
      toast.error('Failed to delete profile picture', {
        position: 'top-center',
        autoClose: 3000,
        theme: "colored",
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.contact_no.trim()) {
      newErrors.contact_no = 'Contact number is required';
    } else if (!/^\d{10}$/.test(formData.contact_no.replace(/\D/g, ''))) {
      newErrors.contact_no = 'Please enter a valid 10-digit phone number';
    }

    if (!formData.date_of_joining) {
      newErrors.date_of_joining = 'Date of joining is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fill Mandatory fields correctly');
      return;
    }

    try {
      setSaving(true);
      setSubmitError('');

      // Prepare form data for submission
      const submitData = new FormData();

      // Add all text fields
      Object.keys(formData).forEach(key => {
        if (key === 'availability_days' || key === 'time_slots') {
          // Convert arrays to comma-separated strings for backend
          submitData.append(key, Array.isArray(formData[key]) ? formData[key].join(',') : '');
        } else if (key === 'profile_picture_url') {
          // Handle profile picture file
          if (formData[key] instanceof File) {
            submitData.append(key, formData[key]);
          }
        } else if (key === 'number_of_sessions_done') {
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

      await headService.updateCoach(coachId, submitData);

      toast.success('Coach updated successfully!', {
        position: 'top-center',
        autoClose: 3000,
      });

      navigate('/admin/manage-coaches');
    } catch (err) {
      console.error('Error updating coach:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update coach. Please try again.';
      setSubmitError(errorMessage);
      toast.error(errorMessage, {
        position: 'top-center',
        autoClose: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/manage-coaches');
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      await headService.deleteCoach(coachId);

      toast.success('Coach deleted successfully!', {
        position: "top-center",
        autoClose: 2000,
        theme: "colored",
      });

      setTimeout(() => {
        navigate('/admin/manage-coaches');
      }, 1500);

    } catch (error) {
      console.error('Error deleting coach:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to delete coach. Please try again.';
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
    return (
      <div className="page-container">
        <Navbar />
        <main className="page-main">
          <div className="loading-container">
            <Loader2 className="loading-spinner-icon" />
            <p className="loading-text">Loading coach details...</p>
          </div>
        </main>
        <Footer />
      </div>
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
        title="Delete Coach"
        message={`Are you sure you want to delete ${formData.name}? All associated data will be permanently removed.`}
        confirmText="Delete Coach"
        cancelText="Cancel"
        loading={deleting}
        variant="danger"
      />

      <main className="page-main">
        <div className="page-content">
          {/* Header */}
           <div className="page-header">
            <button
              onClick={() => navigate('/admin/manage-coaches')}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Manage Coaches
            </button>
            <h1 className="page-title">
              Edit Coach Profile
            </h1>
            <p className="page-description">Update profile information for {formData.name}</p>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="error-message" style={{ marginBottom: '2rem' }}>
              <div className="error-message-content">
                <p>{submitError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="form-container">
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

            {/* Coach-Specific Fields */}
            <section className="section">
              <h2 className="section-title">Coach-Specific Information</h2>

              <div className="grid-2">
                {/* Availability Days - Multi Select */}
                <div>
                  <label className="form-label">Availability Days <span className="required-mark">*</span></label>
                  <div className="checkbox-group">
                    {DAYS_OF_WEEK.map(day => (
                      <div key={day} className="checkbox-item">
                        <input
                          type="checkbox"
                          id={`day_${day}`}
                          checked={formData.availability_days.includes(day)}
                          onChange={() => handleMultiSelect('availability_days', day)}
                          className="checkbox-input"
                        />
                        <label htmlFor={`day_${day}`} className="checkbox-label">{day}</label>
                      </div>
                    ))}
                  </div>
                  {formData.availability_days.length > 0 && (
                    <p className="form-hint">Selected: {formData.availability_days.join(', ')}</p>
                  )}
                </div>

                {/* Time Slots - Multi Select */}
                <div>
                  <label className="form-label">Time Slots <span className="required-mark">*</span></label>
                  <div className="checkbox-group">
                    {TIME_SLOT_OPTIONS.map(slot => (
                      <div key={slot} className="checkbox-item">
                        <input
                          type="checkbox"
                          id={`slot_${slot}`}
                          checked={formData.time_slots.includes(slot)}
                          onChange={() => handleMultiSelect('time_slots', slot)}
                          className="checkbox-input"
                        />
                        <label htmlFor={`slot_${slot}`} className="checkbox-label">{slot}</label>
                      </div>
                    ))}
                  </div>
                  {formData.time_slots.length > 0 && (
                    <p className="form-hint">Selected: {formData.time_slots.join(', ')}</p>
                  )}
                </div>

                {/* Specialization */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="specialization" className="form-label">Specialization</label>
                  <textarea
                    id="specialization"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    placeholder="Coach's area of specialization"
                    className="form-textarea"
                    rows="3"
                  />
                </div>

                {/* Profile Picture */}
                <div>
                  <label htmlFor="profile_picture_url" className="form-label">Profile Picture</label>
                  <input
                    type="file"
                    id="profile_picture_url"
                    onChange={handleProfileImageChange}
                    className="form-file-input"
                    accept="image/*"
                  />
                  <p className="form-hint">Supported formats: JPG, PNG, GIF</p>

                  {/* Existing Profile Picture */}
                  {existingProfilePicture && (
                    <div className="existing-files-section">
                      <h4 className="subsection-title">Current Profile Picture</h4>
                      <div className="file-list">
                        <div className="file-item">
                          <span className="file-name">Profile Picture</span>
                          <div className="file-actions">
                            <button
                              type="button"
                              onClick={(e) => handleViewProfilePicture(e)}
                              className="btn-view-file"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteProfilePicture}
                              className="file-remove-btn"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* New Profile Picture to Upload */}
                  {formData.profile_picture_url && (
                    <div className="new-files-section">
                      <h4 className="subsection-title">New Profile Picture to Upload</h4>
                      <p className="form-hint" style={{ color: '#4caf50' }}>
                        ✓ {formData.profile_picture_url.name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Reference Data */}
                <div>
                  <label htmlFor="reference_files" className="form-label">Reference Data</label>
                  <input
                    type="file"
                    id="reference_files"
                    multiple
                    onChange={handleFileChange}
                    className="form-file-input"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
                  />
                  <p className="form-hint">Documents, Images, Videos, Links (PDF, DOCX, Images, Videos)</p>

                  {/* Existing Reference Files */}
                  {existingReferenceData.length > 0 && (
                    <div className="existing-files-section">
                      <h4 className="subsection-title">Existing Reference Files</h4>
                      <div className="file-list">
                        {existingReferenceData.map((file) => (
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
            </section>

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

            {/* Form Actions */}
            <div className="form-actions-split">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving || deleting}
                className="btn-danger btn-icon"
              >
                <svg className="icon-sm" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Delete Coach
              </button>

              <div className="form-actions-group">
                <button
                  type="button"
                  onClick={handleCancel}
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

export default EditCoach;
