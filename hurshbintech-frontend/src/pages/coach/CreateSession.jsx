import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import coachService from '../../api/services/coachService';
import { toast } from 'react-toastify';
import { Calendar, Clock, Users, BookOpen, Search, X } from 'lucide-react';
import '../../styles/ManageUsersLayout.css';
import '../../styles/coach/SessionsManager.css';

const CreateSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState({
    session_date: '',
    session_time: '',
    session_title: '',
    learning_content_id: '',
    description: '',
    notes: '',
    learner_ids: [],
    trainer_ids: [],
    head_ids: [],
  });

  // Available users and content
  const [allUsers, setAllUsers] = useState([]);
  const [learningContents, setLearningContents] = useState([]);

  // Unified search states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  const timeSlots = ['10am', '1pm', '3pm', '5pm'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [learnersData, trainersData, headsData, contentsData] = await Promise.all([
        coachService.getAvailableLearners(),
        coachService.getAvailableTrainers(),
        coachService.getAvailableHeads(),
        coachService.getLearningContents(),
      ]);
      
      // Combine all users with role information
      const combined = [
        ...learnersData.map(u => ({ ...u, role: 'learner', roleLabel: 'Learner' })),
        ...trainersData.map(u => ({ ...u, role: 'trainer', roleLabel: 'Trainer' })),
        ...headsData.map(u => ({ ...u, role: 'head', roleLabel: 'Head' })),
      ];
      setAllUsers(combined);
      setLearningContents(contentsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addParticipant = (user) => {
    if (!selectedParticipants.find(p => p.id === user.id)) {
      setSelectedParticipants(prev => [...prev, user]);
    }
    setSearchQuery('');
  };

  const removeParticipant = (userId) => {
    setSelectedParticipants(prev => prev.filter(p => p.id !== userId));
  };

  const getFilteredUsers = () => {
    let filtered = allUsers;
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    filtered = filtered.filter(u =>
      !selectedParticipants.find(p => p.id === u.id)
    );
    
    return filtered;
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      learner: 'role-badge-learner',
      trainer: 'role-badge-trainer',
      head: 'role-badge-head',
    };
    return classes[role] || '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.session_date || !formData.session_time) {
      toast.error('Please fill in date and time');
      return;
    }

    try {
      const learner_ids = selectedParticipants.filter(p => p.role === 'learner').map(p => p.id);
      const trainer_ids = selectedParticipants.filter(p => p.role === 'trainer').map(p => p.id);
      const head_ids = selectedParticipants.filter(p => p.role === 'head').map(p => p.id);

      const sessionData = {
        ...formData,
        learner_ids,
        trainer_ids,
        head_ids,
      };

      await coachService.createSession(sessionData);
      toast.success('Session created successfully!');
      navigate('/coach/sessions');
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.detail || 'Failed to create session');
    }
  };

  const handleCancel = () => {
    navigate('/coach/sessions');
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <main className="page-main">
          <div className="loading-container">
            <div className="loading-spinner-icon"></div>
            <p className="loading-text">Loading...</p>
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
            <button
              onClick={() => navigate('/coach/sessions')}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Sessions
            </button>
            <div>
              <h1 className="page-title">Create New Session</h1>
              <p className="page-description">
                Schedule a group coaching session with learners, trainers, and heads
              </p>
            </div>
          </div>

          {/* Create Session Form */}
          <div className="sessions-manager">
            <div className="form-card">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">
                      <Calendar className="icon-sm inline mr-2" />
                      Session Date *
                    </label>
                    <input
                      type="date"
                      name="session_date"
                      value={formData.session_date}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Clock className="icon-sm inline mr-2" />
                      Time Slot *
                    </label>
                    <select
                      name="session_time"
                      value={formData.session_time}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    >
                      <option value="">Select time</option>
                      {timeSlots.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Session Title</label>
                  <input
                    type="text"
                    name="session_title"
                    value={formData.session_title}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="e.g., Group Coaching Session"
                  />
                </div>

                {/* Learning Content */}
                <div className="form-group">
                  <label className="form-label">
                    <BookOpen className="icon-sm inline mr-2" />
                    Learning Content (Optional)
                  </label>
                  <select
                    name="learning_content_id"
                    value={formData.learning_content_id}
                    onChange={handleInputChange}
                    className="form-input"
                  >
                    <option value="">Select learning content</option>
                    {learningContents.map(content => (
                      <option key={content.id} value={content.id}>
                        {content.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Participants Section */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center">
                    <Users className="icon-sm mr-2" />
                    Add Participants
                  </h4>

                  {/* Search Input */}
                  <div className="form-group">
                    <label className="form-label">Search People</label>
                    <div className="search-input-wrapper">
                      <Search className="search-icon" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name..."
                        className="search-input-with-icon"
                      />
                    </div>
                  </div>

                  {/* Role Filter Tabs */}
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRoleFilter('all')}
                      className={`role-filter-btn ${roleFilter === 'all' ? 'role-filter-btn-active' : 'role-filter-btn-inactive'}`}
                    >
                      All ({allUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleFilter('learner')}
                      className={`role-filter-btn ${roleFilter === 'learner' ? 'role-filter-btn-active' : 'role-filter-btn-inactive'}`}
                    >
                      Learners ({allUsers.filter(u => u.role === 'learner').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleFilter('trainer')}
                      className={`role-filter-btn ${roleFilter === 'trainer' ? 'role-filter-btn-active' : 'role-filter-btn-inactive'}`}
                    >
                      Trainers ({allUsers.filter(u => u.role === 'trainer').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleFilter('head')}
                      className={`role-filter-btn ${roleFilter === 'head' ? 'role-filter-btn-active' : 'role-filter-btn-inactive'}`}
                    >
                      Heads ({allUsers.filter(u => u.role === 'head').length})
                    </button>
                  </div>

                  {/* Selected Participants */}
                  {selectedParticipants.length > 0 && (
                    <div className="selected-participants-container">
                      <p className="selected-participants-title">
                        Selected Participants ({selectedParticipants.length})
                      </p>
                      <div className="selected-participants-grid">
                        {selectedParticipants.map(participant => (
                          <div key={participant.id} className="participant-badge">
                            <span className="participant-name">{participant.name}</span>
                            <span className={`participant-role-badge ${getRoleBadgeClass(participant.role)}`}>
                              {participant.roleLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeParticipant(participant.id)}
                              className="participant-remove-btn"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Results Dropdown */}
                  {(searchQuery.trim() || roleFilter !== 'all') && (
                    <div className="search-results-dropdown">
                      {getFilteredUsers().length === 0 ? (
                        <div className="search-results-empty">
                          {searchQuery.trim() ? 'No users found matching your search' : 'No users available'}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {getFilteredUsers().map(user => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => addParticipant(user)}
                              className="user-search-item"
                            >
                              <div className="user-info-container">
                                <div className="user-avatar">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="user-name">{user.name}</span>
                              </div>
                              <span className={`user-role-badge ${getRoleBadgeClass(user.role)}`}>
                                {user.roleLabel}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="form-input"
                    rows="3"
                    placeholder="Session description"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="form-input"
                    rows="2"
                    placeholder="Additional notes"
                  />
                </div>

                <div className="form-actions">
                 
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                   <button type="submit" className="btn-primary ">
                    Create Session
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CreateSession;
