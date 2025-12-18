import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import coachService from '../../api/services/coachService';
import { toast } from 'react-toastify';
import { Plus, X, Calendar, Clock, Users, BookOpen, Search } from 'lucide-react';
import '../../styles/Dashboards.css';
import '../../styles/Coach.css';

const SessionsManager = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
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
  const [allUsers, setAllUsers] = useState([]); // Combined users array
  const [learningContents, setLearningContents] = useState([]);

  // Unified search states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'learner', 'trainer', 'head'
  const [selectedParticipants, setSelectedParticipants] = useState([]); // Array of user objects

  const timeSlots = ['10am', '1pm', '3pm', '5pm'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sessionsData, learnersData, trainersData, headsData, contentsData] = await Promise.all([
        coachService.getMySessions(),
        coachService.getAvailableLearners(),
        coachService.getAvailableTrainers(),
        coachService.getAvailableHeads(),
        coachService.getLearningContents(),
      ]);
      
      setSessions(sessionsData);
      
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
    setSearchQuery(''); // Clear search after adding
  };

  const removeParticipant = (userId) => {
    setSelectedParticipants(prev => prev.filter(p => p.id !== userId));
  };

  // Filter users based on search query and role filter
  const getFilteredUsers = () => {
    let filtered = allUsers;
    
    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Exclude already selected participants
    filtered = filtered.filter(u =>
      !selectedParticipants.find(p => p.id === u.id)
    );
    
    return filtered;
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      learner: 'bg-blue-100 text-blue-700 border-blue-300',
      trainer: 'bg-purple-100 text-purple-700 border-purple-300',
      head: 'bg-green-100 text-green-700 border-green-300',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.session_date || !formData.session_time) {
      toast.error('Please fill in date and time');
      return;
    }

    try {
      // Prepare participant IDs by role
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
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.detail || 'Failed to create session');
    }
  };

  const resetForm = () => {
    setFormData({
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
    setSearchQuery('');
    setRoleFilter('all');
    setSelectedParticipants([]);
  };

  const filterUsers = (users, searchTerm) => {
    if (!searchTerm) return users;
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (loading) {
    return <div className="loading-container">Loading sessions...</div>;
  }

  return (
    <div className="sessions-manager">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Sessions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-success btn-icon"
        >
          {showForm ? <X className="icon-sm" /> : <Plus className="icon-sm" />}
          {showForm ? 'Cancel' : 'Create Session'}
        </button>
      </div>

      {/* Create Session Form */}
      {showForm && (
        <div className="form-card mb-6">
          <h3 className="form-section-title mb-4">Create New Session</h3>
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

            {/* Participants Section - Unified Smart Search */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 flex items-center">
                <Users className="icon-sm mr-2" />
                Add Participants
              </h4>

              {/* Search Input */}
              <div className="form-group">
                <label className="form-label">Search People</label>
                <div className="relative">
                  <Search className="absolute left-4 top-6 icon-sm text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="form-input pl-10"
                  />
                </div>
              </div>

              {/* Role Filter Tabs */}
              <div className="flex gap-2 mb-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    roleFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({allUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('learner')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    roleFilter === 'learner'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Learners ({allUsers.filter(u => u.role === 'learner').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('trainer')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    roleFilter === 'trainer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Trainers ({allUsers.filter(u => u.role === 'trainer').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('head')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    roleFilter === 'head'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Heads ({allUsers.filter(u => u.role === 'head').length})
                </button>
              </div>

              {/* Selected Participants */}
              {selectedParticipants.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected Participants ({selectedParticipants.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedParticipants.map(participant => (
                      <div
                        key={participant.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full shadow-sm"
                      >
                        <span className="text-sm font-medium">{participant.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${getRoleBadgeColor(participant.role)}`}>
                          {participant.roleLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeParticipant(participant.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
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
                <div className="border rounded-lg max-h-64 overflow-y-auto bg-white shadow-sm">
                  {getFilteredUsers().length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      {searchQuery.trim() ? 'No users found matching your search' : 'No users available'}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {getFilteredUsers().map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addParticipant(user)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900">{user.name}</span>
                          </div>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(user.role)}`}>
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

            <div className="flex gap-3">
              <button type="submit" className="btn-success">
                Create Session
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions List */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Scheduled Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-gray-500">No sessions scheduled yet</p>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="session-card">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">
                    {session.session_title || 'Untitled Session'}
                  </h4>
                  <p className="text-gray-600">
                    {new Date(session.session_date).toLocaleDateString()} at {session.session_time}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Status: <span className={`status-badge status-${session.status}`}>{session.status}</span>
                  </p>
                  {session.participants && session.participants.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Participants: {session.participants.length}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionsManager;
