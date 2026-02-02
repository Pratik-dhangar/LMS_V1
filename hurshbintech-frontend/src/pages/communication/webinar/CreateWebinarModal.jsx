import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import webinarService from '../../../api/services/Communication/webinarService';
import '../../../styles/components/common/Modal.css';

const CreateWebinarModal = ({ isOpen, onClose, onSuccess, editWebinar = null }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_link: '',
    scheduled_date: '',
    scheduled_time: '',
    participant_user_ids: [],
    unregistered_emails: []
  });

  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [unregisteredEmails, setUnregisteredEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Load registered users and populate form if editing
  useEffect(() => {
    if (isOpen) {
      fetchRegisteredUsers();
      
      // If editing, populate form
      if (editWebinar) {
        setFormData({
          title: editWebinar.title || '',
          description: editWebinar.description || '',
          meeting_link: editWebinar.meeting_link || '',
          scheduled_date: editWebinar.scheduled_date || '',
          scheduled_time: editWebinar.scheduled_time ? editWebinar.scheduled_time.substring(0, 5) : '',
          participant_user_ids: [],
          unregistered_emails: []
        });
      } else {
        // Reset form for new webinar
        setFormData({
          title: '',
          description: '',
          meeting_link: '',
          scheduled_date: '',
          scheduled_time: '',
          participant_user_ids: [],
          unregistered_emails: []
        });
        setSelectedUsers([]);
        setUnregisteredEmails([]);
      }
    }
  }, [isOpen, editWebinar]);

  const fetchRegisteredUsers = async () => {
    try {
      setLoadingUsers(true);
      const users = await webinarService.getRegisteredUsers();
      setRegisteredUsers(users);
    } catch (error) {
      console.error('Failed to fetch registered users:', error);
      toast.error('Failed to load registered users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUserSelect = (e) => {
    const userId = parseInt(e.target.value);
    if (userId && !selectedUsers.find(u => u.id === userId)) {
      const user = registeredUsers.find(u => u.id === userId);
      if (user) {
        setSelectedUsers(prev => [...prev, user]);
      }
    }
  };

  const removeSelectedUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleAddEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!currentEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    
    if (!emailRegex.test(currentEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (unregisteredEmails.includes(currentEmail)) {
      toast.error('Email already added');
      return;
    }
    
    setUnregisteredEmails(prev => [...prev, currentEmail]);
    setCurrentEmail('');
  };

  const removeEmail = (email) => {
    setUnregisteredEmails(prev => prev.filter(e => e !== email));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a webinar title');
      return false;
    }
    
    if (!formData.meeting_link.trim()) {
      toast.error('Please enter a meeting link');
      return false;
    }
    
    if (!formData.meeting_link.startsWith('http://') && !formData.meeting_link.startsWith('https://')) {
      toast.error('Meeting link must start with http:// or https://');
      return false;
    }
    
    if (!formData.scheduled_date) {
      toast.error('Please select a date');
      return false;
    }
    
    if (!formData.scheduled_time) {
      toast.error('Please select a time');
      return false;
    }
    
    // Check if at least one participant is added
    if (selectedUsers.length === 0 && unregisteredEmails.length === 0) {
      toast.error('Please add at least one participant');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const webinarData = {
        ...formData,
        participant_user_ids: selectedUsers.map(u => u.id),
        unregistered_emails: unregisteredEmails
      };
      
      if (editWebinar) {
        // Update existing webinar
        const updateData = {
          title: formData.title,
          description: formData.description,
          meeting_link: formData.meeting_link,
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time
        };
        await webinarService.updateWebinar(editWebinar.id, updateData);
        toast.success('Webinar updated successfully!');
        onSuccess();
      } else {
        // Create new webinar - response returns immediately while emails send in background
        const response = await webinarService.createWebinar(webinarData);
        toast.success('Webinar created successfully!');
        
        // Pass the created webinar to parent for immediate display
        // Emails are being sent in the background
        onSuccess(response);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save webinar:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to save webinar';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div className="app-modal-container app-modal-container--lg" onClick={(e) => e.stopPropagation()}>
        <div className="app-modal-header app-modal-header--primary">
          <div className="app-modal-header-content">
            <h2 className="app-modal-title">{editWebinar ? 'Edit Webinar' : 'Create New Webinar'}</h2>
            <p className="app-modal-subtitle">Configure your group meeting details</p>
          </div>
          <button className="app-modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="app-modal-content">
            {/* Title */}
            <div className="app-modal-form-field">
              <label className="app-modal-form-label">
                Webinar Title <span className="app-modal-text-required">*</span>
              </label>
              <input
                type="text"
                name="title"
                className="app-modal-form-input"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter webinar topic/heading"
                required
              />
            </div>

            {/* Description */}
            <div className="app-modal-form-field">
              <label className="app-modal-form-label">Description</label>
              <textarea
                name="description"
                className="app-modal-form-textarea"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter webinar description (optional)"
                rows="4"
              />
            </div>

            {/* Meeting Link */}
            <div className="app-modal-form-field">
              <label className="app-modal-form-label required">Meeting Link</label>
              <input
                type="url"
                name="meeting_link"
                className="app-modal-form-input"
                value={formData.meeting_link}
                onChange={handleInputChange}
                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                required
              />
              <p className="app-modal-form-helper">
                Paste the meeting link from Zoom, Google Meet, Microsoft Teams, or any other platform
              </p>
            </div>

            {/* Date and Time */}
            <div className="app-modal-form-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="app-modal-form-label required">Date</label>
                <input
                  type="date"
                  name="scheduled_date"
                  className="app-modal-form-input"
                  value={formData.scheduled_date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="app-modal-form-label required">Time</label>
                <input
                  type="time"
                  name="scheduled_time"
                  className="app-modal-form-input"
                  value={formData.scheduled_time}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            {/* Only show participants section when creating new webinar */}
            {!editWebinar && (
              <>
                {/* Registered Users */}
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Add Registered Participants</label>
                  {loadingUsers ? (
                    <p className="app-modal-form-helper">Loading users...</p>
                  ) : (
                    <>
                      <select
                        className="app-modal-form-select"
                        onChange={handleUserSelect}
                        value=""
                      >
                        <option value="">-- Select a user to add --</option>
                        {registeredUsers
                          .filter(user => !selectedUsers.find(u => u.id === user.id))
                          .map(user => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.email}) - {user.role}
                            </option>
                          ))
                        }
                      </select>
                      
                      {selectedUsers.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {selectedUsers.map(user => (
                            <div key={user.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '16px', fontSize: '0.875rem' }}>
                              {user.name}
                              <button
                                type="button"
                                style={{ background: 'transparent', border: 'none', color: '#3730a3', cursor: 'pointer', padding: 0, fontSize: '1.125rem', lineHeight: 1 }}
                                onClick={() => removeSelectedUser(user.id)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Unregistered Emails */}
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Add Unregistered Participants (Email)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="email"
                      className="app-modal-form-input"
                      value={currentEmail}
                      onChange={(e) => setCurrentEmail(e.target.value)}
                      placeholder="Enter email address"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="app-modal-btn app-modal-btn--primary"
                      onClick={handleAddEmail}
                    >
                      Add Email
                    </button>
                  </div>
                  
                  {unregisteredEmails.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {unregisteredEmails.map((email, index) => (
                        <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '16px', fontSize: '0.875rem' }}>
                          {email}
                          <button
                            type="button"
                            style={{ background: 'transparent', border: 'none', color: '#3730a3', cursor: 'pointer', padding: 0, fontSize: '1.125rem', lineHeight: 1 }}
                            onClick={() => removeEmail(email)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Participant Count */}
                <div className="app-modal-form-helper" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                  Total participants: {selectedUsers.length + unregisteredEmails.length}
                </div>
              </>
            )}
          </div>

          <div className="app-modal-footer">
            <button
              type="button"
              className="app-modal-btn app-modal-btn--secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="app-modal-btn app-modal-btn--primary"
              disabled={loading}
            >
              {loading ? (editWebinar ? 'Updating...' : 'Creating...') : (editWebinar ? 'Update Webinar' : 'Create & Send Invitations')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateWebinarModal;
