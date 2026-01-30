import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import webinarService from '../../../api/services/Communication/webinarService';
import '../../../styles/common/communication.css';

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
      } else {
        // Create new webinar
        await webinarService.createWebinar(webinarData);
        toast.success('Webinar created and invitations sent!');
      }
      
      onSuccess();
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editWebinar ? 'Edit Webinar' : 'Create New Webinar'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Title */}
            <div className="form-group">
              <label className="form-label required">Webinar Title</label>
              <input
                type="text"
                name="title"
                className="form-input"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter webinar topic/heading"
                required
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-textarea"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter webinar description (optional)"
                rows="4"
              />
            </div>

            {/* Meeting Link */}
            <div className="form-group">
              <label className="form-label required">Meeting Link</label>
              <input
                type="url"
                name="meeting_link"
                className="form-input"
                value={formData.meeting_link}
                onChange={handleInputChange}
                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                required
              />
              <p className="form-help">
                Paste the meeting link from Zoom, Google Meet, Microsoft Teams, or any other platform
              </p>
            </div>

            {/* Date and Time */}
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label required">Date</label>
                <input
                  type="date"
                  name="scheduled_date"
                  className="form-input"
                  value={formData.scheduled_date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="form-label required">Time</label>
                <input
                  type="time"
                  name="scheduled_time"
                  className="form-input"
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
                <div className="form-group">
                  <label className="form-label">Add Registered Participants</label>
                  {loadingUsers ? (
                    <p className="form-help">Loading users...</p>
                  ) : (
                    <>
                      <select
                        className="form-select"
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
                        <div className="select-chips-container">
                          {selectedUsers.map(user => (
                            <div key={user.id} className="chip">
                              {user.name}
                              <button
                                type="button"
                                className="chip-remove"
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
                <div className="form-group">
                  <label className="form-label">Add Unregistered Participants (Email)</label>
                  <div className="email-input-group">
                    <input
                      type="email"
                      className="form-input"
                      value={currentEmail}
                      onChange={(e) => setCurrentEmail(e.target.value)}
                      placeholder="Enter email address"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-add-email"
                      onClick={handleAddEmail}
                    >
                      Add Email
                    </button>
                  </div>
                  
                  {unregisteredEmails.length > 0 && (
                    <div className="select-chips-container">
                      {unregisteredEmails.map((email, index) => (
                        <div key={index} className="chip">
                          {email}
                          <button
                            type="button"
                            className="chip-remove"
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
                <div className="form-help" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                  Total participants: {selectedUsers.length + unregisteredEmails.length}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
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
