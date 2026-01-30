import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';
import { Calendar, Clock, Users, Video, Edit, Trash2, Plus, Search } from 'lucide-react';
import webinarService from '../../../api/services/Communication/webinarService';
import CreateWebinarModal from './CreateWebinarModal';
import '../../../styles/common/communication.css';

const WebinarPage = () => {
  const { user } = useAuth();
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebinar, setEditingWebinar] = useState(null);

  useEffect(() => {
    fetchWebinars();
  }, []);

  const fetchWebinars = async () => {
    try {
      setLoading(true);
      const data = await webinarService.getAllWebinars();
      setWebinars(data);
    } catch (error) {
      console.error('Failed to fetch webinars:', error);
      toast.error('Failed to load webinars');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingWebinar(null);
    setIsModalOpen(true);
  };

  const handleEdit = (webinar) => {
    setEditingWebinar(webinar);
    setIsModalOpen(true);
  };

  const handleDelete = async (webinarId, webinarTitle) => {
    if (!window.confirm(`Are you sure you want to delete the webinar "${webinarTitle}"?`)) {
      return;
    }

    try {
      await webinarService.deleteWebinar(webinarId);
      toast.success('Webinar deleted successfully');
      fetchWebinars();
    } catch (error) {
      console.error('Failed to delete webinar:', error);
      toast.error('Failed to delete webinar');
    }
  };

  const handleJoinMeeting = (meetingLink) => {
    window.open(meetingLink, '_blank', 'noopener,noreferrer');
  };

  const handleModalSuccess = () => {
    fetchWebinars();
  };

  // Filter webinars based on search query
  const filteredWebinars = webinars.filter(webinar => {
    const query = searchQuery.toLowerCase();
    return (
      webinar.title.toLowerCase().includes(query) ||
      webinar.description?.toLowerCase().includes(query) ||
      webinar.created_by_name?.toLowerCase().includes(query)
    );
  });

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Format time for display
  const formatTime = (timeString) => {
    // timeString is in format "HH:MM:SS"
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Get role badge class
  const getRoleBadgeClass = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'badge-admin';
      case 'coach':
        return 'badge-coach';
      case 'head':
        return 'badge-head';
      default:
        return 'badge-admin';
    }
  };

  return (
    <div className="communication-container">
      {/* Header */}
      <div className="communication-header">
        <h1>📹 Webinar Management</h1>
        <p>Create and manage webinars with registered and unregistered users</p>
      </div>

      {/* Content */}
      <div className="communication-content">
        {/* Search and Create Section */}
        <div className="search-section">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af' 
              }} 
            />
            <input
              type="text"
              className="search-input"
              placeholder="Search webinars by title, description, or host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
          
          {/* Only show Create button for Admin, Coach, Head */}
          {(['admin', 'coach', 'head'].includes(user?.role)) && (
            <button className="btn-create-new" onClick={handleCreateNew}>
              <Plus size={20} />
              Create New Webinar
            </button>
          )}
        </div>

        {/* Webinars Table */}
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading webinars...</p>
          </div>
        ) : filteredWebinars.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📹</div>
            <h3>No webinars found</h3>
            <p>
              {searchQuery 
                ? 'No webinars match your search criteria.' 
                : 'No webinars have been created yet. Click "Create New Webinar" to get started!'}
            </p>
          </div>
        ) : (
          <div className="webinar-table-container">
            <table className="webinar-table">
              <thead>
                <tr>
                  <th>Webinar Details</th>
                  <th>Schedule</th>
                  <th>Host</th>
                  <th>Participants</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWebinars.map((webinar) => (
                  <tr key={webinar.id}>
                    {/* Webinar Details */}
                    <td>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                          {webinar.title}
                        </div>
                        {webinar.description && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            {webinar.description.length > 100 
                              ? `${webinar.description.substring(0, 100)}...` 
                              : webinar.description}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Schedule */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={16} color="#6366f1" />
                          <span>{formatDate(webinar.scheduled_date)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={16} color="#6366f1" />
                          <span>{formatTime(webinar.scheduled_time)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Host */}
                    <td>
                      <div>
                        <div style={{ fontWeight: '500' }}>
                          {webinar.created_by_name || 'Unknown'}
                        </div>
                        <span className={`badge ${getRoleBadgeClass(webinar.created_by_role)}`}>
                          {webinar.created_by_role || 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Participants */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={16} color="#6366f1" />
                        <span style={{ fontWeight: '600' }}>{webinar.participant_count}</span>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          participant{webinar.participant_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-join"
                          onClick={() => handleJoinMeeting(webinar.meeting_link)}
                          title="Join Meeting"
                        >
                          <Video size={16} />
                          Join Meeting
                        </button>
                        
                        {/* Only show Edit/Delete for creator */}
                        {webinar.created_by_user_id === user?.id && (
                          <>
                            <button
                              className="btn-action btn-edit"
                              onClick={() => handleEdit(webinar)}
                              title="Edit Webinar"
                            >
                              <Edit size={16} />
                              Edit
                            </button>
                            <button
                              className="btn-action btn-delete"
                              onClick={() => handleDelete(webinar.id, webinar.title)}
                              title="Delete Webinar"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Webinar Modal */}
      <CreateWebinarModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWebinar(null);
        }}
        onSuccess={handleModalSuccess}
        editWebinar={editingWebinar}
      />
    </div>
  );
};

export default WebinarPage;
