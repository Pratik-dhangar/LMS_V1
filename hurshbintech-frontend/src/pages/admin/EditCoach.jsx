import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import headService from '../../api/services/headService';
import BasicInfoSection from '../../components/admin/EditHead/BasicInfoSection';
import ProfessionalInfoSection from '../../components/admin/EditHead/ProfessionalInfoSection';
import PersonalDetailsSection from '../../components/admin/EditHead/PersonalDetailsSection';
import PerformanceFeedbackSection from '../../components/admin/EditHead/PerformanceFeedbackSection';
import NotesSection from '../../components/admin/EditHead/NotesSection';
import '../../styles/Pages.css';

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

  const [referenceFiles, setReferenceFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        profile_picture_url: coach.profile_picture_url || null,
      });
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

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        profile_picture_url: file
      }));
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
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">Edit Coach</h1>
            <p className="page-description">Update coach information</p>
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
                  {formData.profile_picture_url && (
                    <p className="form-hint" style={{ color: '#4caf50' }}>
                      ✓ {formData.profile_picture_url instanceof File ? formData.profile_picture_url.name : 'Profile picture set'}
                    </p>
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

                  {/* File List */}
                  {referenceFiles.length > 0 && (
                    <div className="file-list" style={{ marginTop: '1rem' }}>
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
            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EditCoach;
