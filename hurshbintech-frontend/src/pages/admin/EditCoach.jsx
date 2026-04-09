import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Loader2, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getFileUrl } from '../../utils/urlHelper';
import ConfirmModal from '../../components/common/ConfirmModal';
import headService from '../../api/services/headService';
import BasicInfoSection from '../../components/admin/EditHead/BasicInfoSection';
import ProfessionalInfoSection from '../../components/admin/EditHead/ProfessionalInfoSection';
import PersonalDetailsSection from '../../components/admin/EditHead/PersonalDetailsSection';
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
    contact_number: '',
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
    availability_days: [],
    time_slots: [],
    specialization: '',
    profile_picture_url: null,
    is_special: false,
    dedicated_package_id: '',
  });

  const [coachPackages, setCoachPackages] = useState([]);

  const [existingReferenceData, setExistingReferenceData] = useState([]);
  const [existingProfilePicture, setExistingProfilePicture] = useState(null);
  const [showPictureModal, setShowPictureModal] = useState(false);
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

  useEffect(() => {
    headService.getCoachPackages()
      .then(setCoachPackages)
      .catch(() => setCoachPackages([]));
  }, []);

  const fetchCoachData = async () => {
    try {
      setLoading(true);
      const coach = await headService.getCoachById(coachId);
      setFormData({
        name: coach.name || '',
        email: coach.email || '',
        age: coach.age || '',
        address: coach.address || '',
        contact_number: coach.contact_number || '',
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
        availability_days: coach.availability_days ? coach.availability_days.split(',').map(d => d.trim()) : [],
        time_slots: coach.time_slots ? coach.time_slots.split(',').map(t => t.trim()) : [],
        specialization: coach.specialization || '',
        profile_picture_url: null,
        is_special: coach.is_special || false,
        dedicated_package_id: coach.dedicated_package_id || '',
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
      await headService.deleteCoachReferenceFile(coachId, referenceId);
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

    if (!filePath) return;

    // Use getFileUrl to properly handle S3 URLs, local paths, and presigned URLs
    const fileUrl = getFileUrl(filePath);
    console.log('[📄 VIEW FILE] Coach document:', { original: filePath, final: fileUrl });
    window.open(fileUrl, '_blank');
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
      setShowPictureModal(true);
    }
  };

  const handleDeleteProfilePicture = async () => {
    if (!existingProfilePicture) return;

    try {
      // Update coach with null profile picture
      await headService.updateCoach(coachId, { profile_picture_url: null });

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

    if (!formData.contact_number.trim()) {
      newErrors.contact_number = 'Contact number is required';
    } else if (!/^\d{10}$/.test(formData.contact_number.replace(/\D/g, ''))) {
      newErrors.contact_number = 'Please enter a valid 10-digit phone number';
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
        } else if (key === 'is_special') {
          submitData.append(key, formData[key] ? 'true' : 'false');
        } else if (key === 'dedicated_package_id') {
          if (formData[key]) submitData.append(key, formData[key]);
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
        <main className="page-main">
          <div className="loading-container">
            <Loader2 className="loading-spinner-icon" />
            <p className="loading-text">Loading coach details...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Profile Picture Preview Modal */}
      {showPictureModal && existingProfilePicture && (
        <div
          onClick={() => setShowPictureModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative', background: '#fff',
              borderRadius: '12px', padding: '12px',
              maxWidth: '90vw', maxHeight: '90vh',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <button
              onClick={() => setShowPictureModal(false)}
              style={{
                position: 'absolute', top: '8px', right: '8px',
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={getFileUrl(existingProfilePicture)}
              alt="Profile Picture"
              style={{ display: 'block', maxWidth: '400px', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

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
            <div>
              <h1 className="page-title">
                Edit Coach Profile
              </h1>
              <p className="page-description">Update profile information for {formData.name}</p>
            </div>
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
          <div className="modern-form-card">
            <form onSubmit={handleSubmit} >
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
              <section className="coach-specific-section">
                <h2 className="coach-specific-title">Coach-Specific Information</h2>

                <div className="coach-grid-layout">
                  {/* Availability Days - Multi Select */}
                  <div className="coach-field-group">
                    <label className="coach-field-label">
                      Availability Days <span className="required-indicator">*</span>
                    </label>
                    <div className="coach-checkbox-group">
                      {DAYS_OF_WEEK.map(day => (
                        <div key={day} className="coach-checkbox-item">
                          <input
                            type="checkbox"
                            id={`day_${day}`}
                            checked={formData.availability_days.includes(day)}
                            onChange={() => handleMultiSelect('availability_days', day)}
                            className="coach-checkbox-input"
                          />
                          <label htmlFor={`day_${day}`} className="coach-checkbox-label">{day}</label>
                        </div>
                      ))}
                    </div>
                    {formData.availability_days.length > 0 && (
                      <p className="coach-selected-hint">Selected: {formData.availability_days.join(', ')}</p>
                    )}
                  </div>

                  {/* Time Slots - Multi Select */}
                  <div className="coach-field-group">
                    <label className="coach-field-label">
                      Time Slots <span className="required-indicator">*</span>
                    </label>
                    <div className="coach-checkbox-group">
                      {TIME_SLOT_OPTIONS.map(slot => (
                        <div key={slot} className="coach-checkbox-item">
                          <input
                            type="checkbox"
                            id={`slot_${slot}`}
                            checked={formData.time_slots.includes(slot)}
                            onChange={() => handleMultiSelect('time_slots', slot)}
                            className="coach-checkbox-input"
                          />
                          <label htmlFor={`slot_${slot}`} className="coach-checkbox-label">{slot}</label>
                        </div>
                      ))}
                    </div>
                    {formData.time_slots.length > 0 && (
                      <p className="coach-selected-hint">Selected: {formData.time_slots.join(', ')}</p>
                    )}
                  </div>

                  {/* Specialization */}
                  <div className="coach-field-group">
                    <label htmlFor="specialization" className="coach-field-label">Specialization</label>
                    <textarea
                      id="specialization"
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleChange}
                      placeholder="Coach's area of specialization"
                      className="app-modal-form-textarea"
                      rows="3"
                    />
                  </div>

                  {/* Dedicated Package */}
                  <div className="coach-field-group">
                    <label className="coach-field-label">Dedicated Package</label>
                    <select
                      name="dedicated_package_id"
                      value={formData.dedicated_package_id}
                      onChange={handleChange}
                      className="app-modal-form-input"
                      style={{ width: '100%' }}
                    >
                      <option value="">— None —</option>
                      {coachPackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.package_name}
                        </option>
                      ))}
                    </select>
                    <p className="reference-data-help-text">Assign this coach as the dedicated coach for a specific COACH package</p>
                  </div>

                  {/* Special Coach */}
                  <div className="coach-field-group">
                    <label className="coach-field-label">Special Coach</label>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="is_special"
                          value="true"
                          checked={formData.is_special === true}
                          onChange={() => setFormData(prev => ({ ...prev, is_special: true }))}
                        />
                        Yes
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="is_special"
                          value="false"
                          checked={formData.is_special === false}
                          onChange={() => setFormData(prev => ({ ...prev, is_special: false }))}
                        />
                        No
                      </label>
                    </div>
                    <p className="reference-data-help-text">Mark this coach as featured / premium</p>
                  </div>

                  {/* Profile Picture */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="profile_picture_url" className="app-modal-form-label">Profile Picture</label>
                    <input
                      type="file"
                      id="profile_picture_url"
                      onChange={handleProfileImageChange}
                      className="form-file-input"
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('profile_picture_url').click()}
                      className="reference-btn-upload"
                    >
                      Upload Image
                    </button>
                    <p className="reference-data-help-text">Supported formats: JPG, PNG, GIF</p>

                    {/* Existing Profile Picture */}
                    {existingProfilePicture && (
                      <div className="reference-existing-files">
                        <h4 className="reference-files-title">Current Profile Picture</h4>
                        <div className="reference-files-list">
                          <div className="reference-file-item">
                            <span className="reference-file-name">Profile Picture</span>
                            <div className="reference-file-actions">
                              <button
                                type="button"
                                onClick={(e) => handleViewProfilePicture(e)}
                                className="reference-btn-view"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={handleDeleteProfilePicture}
                                className="reference-btn-remove"
                                title="Delete picture"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* New Profile Picture to Upload */}
                    {formData.profile_picture_url && (
                      <div className="reference-new-files">
                        <h4 className="reference-files-title">New Profile Picture to Upload</h4>
                        <div className="reference-files-list">
                          <div className="reference-file-item">
                            <span className="reference-file-name">✓ {formData.profile_picture_url.name}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reference Data */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="reference_files" className="app-modal-form-label">Reference Data</label>
                    <input
                      type="file"
                      id="reference_files"
                      multiple
                      onChange={handleFileChange}
                      className="form-file-input"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('reference_files').click()}
                      className="reference-btn-upload"
                    >
                      Upload Files
                    </button>
                    <p className="reference-data-help-text">Documents, Images, Videos, Links (PDF, DOCX, Images, Videos)</p>

                    {/* Existing Reference Files */}
                    {existingReferenceData.length > 0 && (
                      <div className="reference-existing-files">
                        <h4 className="reference-files-title">Existing Reference Files</h4>
                        <div className="reference-files-list">
                          {existingReferenceData.map((file) => (
                            <div key={file.id} className="reference-file-item">
                              <span className="reference-file-name">{file.file_name || file.description || 'Unnamed File'}</span>
                              <div className="reference-file-actions">
                                <button
                                  type="button"
                                  onClick={(e) => handleViewFile(file.file_path, e)}
                                  className="reference-btn-view"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExistingFile(file.id)}
                                  className="reference-btn-remove"
                                  title="Delete file"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New File List */}
                    {referenceFiles.length > 0 && (
                      <div className="reference-new-files">
                        <h4 className="reference-files-title">New Files to Upload</h4>
                        <div className="reference-files-list">
                          {referenceFiles.map((file, index) => (
                            <div key={index} className="reference-file-item">
                              <span className="reference-file-name">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="reference-btn-remove"
                                title="Delete file"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <NotesSection
                formData={formData}
                errors={errors}
                handleChange={handleChange}
              />

              {/* Action Buttons */}

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="app-modal-btn app-modal-btn--primary "
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
                  onClick={() => navigate("/admin/manage-heads")}
                  disabled={saving || deleting}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting}
                  className="app-modal-btn app-modal-btn--danger"
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
                  Delete Coach
                </button>
              </div>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
};

export default EditCoach;
