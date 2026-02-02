import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';
import { Calendar, Clock, Users, Video, Edit, Trash2, Plus, ExternalLink, PlayCircle, LogIn } from 'lucide-react';
import SearchBar from '../../../components/common/SearchBar';
import webinarService from '../../../api/services/Communication/webinarService';
import CreateWebinarModal from './CreateWebinarModal';
import { getMeetingButtonText, getMeetingButtonIcon } from '../../../utils/platformUtils';
import '../../../styles/ManageUsersLayout.css';
import '../../../styles/Table.css';
import '../../../styles/common/communication.css';

const WebinarPage = () => {
  const { user } = useAuth();
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebinar, setEditingWebinar] = useState(null);
  const [sendingInvitationsFor, setSendingInvitationsFor] = useState(new Set());
  const [selectedWebinarId, setSelectedWebinarId] = useState(null);
  const [participantDetails, setParticipantDetails] = useState({});
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
  const navigate = useNavigate();

 const getDashboardUrl = () => {
    if (!user || !user.role) return '/dashboard';
    const dashboardMap = {
      'head': '/head/dashboard',
      'coach': '/coach/dashboard',
      'admin': '/admin/dashboard',
      
    };
    return dashboardMap[user.role] || '/dashboard';
  };

  useEffect(() => {
    fetchWebinars();
  }, [user]);

  // Close participant modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectedWebinarId && !e.target.closest('td')) {
        setSelectedWebinarId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [selectedWebinarId]);

  const fetchWebinars = async () => {
    try {
      setLoading(true);
      let data;
      
      // Admin, Coach, Head: see all webinars
      if (['admin', 'coach', 'head'].includes(user?.role)) {
        data = await webinarService.getAllWebinars();
      } 
      // Trainer, Learner: see only webinars where they are invited
      else if (['trainer', 'learner'].includes(user?.role)) {
        data = await webinarService.getMyInvitedWebinars();
      }
      else {
        // Default: show invited webinars for any other roles
        data = await webinarService.getMyInvitedWebinars();
      }
      
      setWebinars(data);
    } catch (error) {
      console.error('Failed to fetch webinars:', error);
      toast.error('Failed to load webinars');
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantClick = async (webinarId, event) => {
    // If clicking the same webinar, toggle close
    if (selectedWebinarId === webinarId) {
      setSelectedWebinarId(null);
      return;
    }
    
    // Calculate position for overlay modal
    const rect = event.currentTarget.getBoundingClientRect();
    setModalPosition({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX
    });
    
    // Set as selected
    setSelectedWebinarId(webinarId);
    
    // Fetch participants if not already loaded
    if (!participantDetails[webinarId]) {
      try {
        const webinar = await webinarService.getWebinarById(webinarId);
        setParticipantDetails(prev => ({
          ...prev,
          [webinarId]: webinar.participants || []
        }));
      } catch (error) {
        console.error('Failed to fetch participants:', error);
        toast.error('Failed to load participants');
      }
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
      const errorMessage = error.response?.data?.detail || 'Failed to delete webinar';
      toast.error(errorMessage);
    }
  };

  const handleJoinMeeting = (meetingLink) => {
    if (meetingLink) {
      window.open(meetingLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleModalSuccess = (createdWebinar = null) => {
    if (createdWebinar) {
      handleWebinarCreated(createdWebinar);
    } else {
      fetchWebinars();
    }
  };

  const handleWebinarCreated = (newWebinar) => {
    setWebinars(prev => [newWebinar, ...prev]);
    setSendingInvitationsFor(prev => new Set(prev).add(newWebinar.id));
    
    setTimeout(() => {
      setSendingInvitationsFor(prev => {
        const newSet = new Set(prev);
        newSet.delete(newWebinar.id);
        return newSet;
      });
      toast.success('Email invitations sent successfully!');
    }, 10000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const filteredWebinars = webinars.filter(webinar =>
    webinar.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    webinar.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    webinar.created_by_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':
        return 'table-primary-badge-danger';
      case 'coach':
        return 'table-primary-badge-warning';
      case 'head':
        return 'table-primary-badge-info';
      default:
        return 'table-primary-badge';
    }
  };

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          {/* Page Header */}
          <div className="page-header">
            <button
              onClick={() => navigate(getDashboardUrl())}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Go Back to Dashboard
            </button>
            <div>
              <h1 className="page-title">Webinar Management</h1>
              <p className="page-description">Create and manage webinars with registered and unregistered users</p>
            </div>
          </div>

          {/* Search and Create Section */}
          <div className="search-section">
            <SearchBar
              onSearch={(query) => setSearchQuery(query)}
              placeholder="Search webinars by title, description, or host..."
            />
            
            {/* Only show Create button for Admin, Coach, Head */}
            {(['admin', 'coach', 'head'].includes(user?.role)) && (
              <button 
                onClick={handleCreateNew}
                className="app-modal-btn app-modal-btn--success"
              >
                + Create New Webinar
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredWebinars.length} of {webinars.length} webinars
              </p>
            </div>
          )}

          {/* Webinars Table */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner-icon"></div>
              <p className="loading-text">Loading webinars...</p>
            </div>
          ) : filteredWebinars.length === 0 ? (
            <div className="table-primary-container">
              <div className="table-primary-empty">
                <Video className="table-primary-empty-icon" size={48} />
                <h3 className="table-primary-empty-title">No webinars found</h3>
                <p className="table-primary-empty-description">
                  {searchQuery 
                    ? 'No webinars match your search criteria.' 
                    : 'No webinars have been created yet. Click "Create New Webinar" to get started!'}
                </p>
              </div>
            </div>
          ) : (
            <div className="table-primary-container">
              <div className="table-primary-wrapper">
                <table className="table-primary">
                  <thead className="table-primary-header">
                    <tr>
                      <th className="table-primary-th">Webinar Details</th>
                      <th className="table-primary-th">Schedule</th>
                      <th className="table-primary-th">Host</th>
                      <th className="table-primary-th">Participants</th>
                      <th className="table-primary-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="table-primary-body">
                    {filteredWebinars.map((webinar) => {
                      const isCreator = webinar.created_by_user_id === user?.id;
                      const buttonIconName = getMeetingButtonIcon(webinar.platform);
                      const ButtonIcon = buttonIconName === 'PlayCircle' ? PlayCircle : LogIn;
                      const buttonText = getMeetingButtonText(webinar.platform, isCreator);

                      return (
                        <tr key={webinar.id} className="table-primary-row">
                          {/* Webinar Details */}
                          <td className="table-primary-td">
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
                              {/* Platform Badge */}
                              {webinar.platform_display_name && (
                                <span 
                                  className="table-primary-badge"
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center',
                                    fontSize: '0.75rem',
                                    padding: '0.125rem 0.375rem'
                                  }}
                                >
                                  {webinar.platform_display_name}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Schedule */}
                          <td className="table-primary-td">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={16} />
                                <span>{formatDate(webinar.scheduled_date)}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={16} />
                                <span>{formatTime(webinar.scheduled_time)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Host */}
                          <td className="table-primary-td">
                            <div>
                              <div style={{ fontWeight: '500' }}>
                                {webinar.created_by_name || 'Unknown'}
                              </div>
                              <span className={`table-primary-badge ${getRoleBadgeClass(webinar.created_by_role)}`}>
                                {webinar.created_by_role || 'N/A'}
                              </span>
                            </div>
                          </td>

                          {/* Participants */}
                          <td className="table-primary-td">
                            <div 
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                              onClick={(e) => handleParticipantClick(webinar.id, e)}
                            >
                              <Users size={16} />
                              <span style={{ fontWeight: '600' }}>{webinar.participant_count}</span>
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                participant{webinar.participant_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="table-primary-td">
                            <div className="table-primary-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                              {/* Show sending status if invitations are being sent */}
                              {sendingInvitationsFor.has(webinar.id) && (
                                <div className="webinar-sending-badge">
                                  <div className="webinar-sending-spinner"></div>
                                  Sending invitations...
                                </div>
                              )}
                              
                              <button
                                className={`manage-users-edit-btn ${isCreator ? '' : 'webinar-btn-join'}`}
                                onClick={() => handleJoinMeeting(webinar.meeting_link)}
                                title={buttonText}
                              >
                                <ButtonIcon size={16} />
                                {buttonText}
                              </button>
                              
                              {/* Only show Edit/Delete for creator */}
                              {webinar.created_by_user_id === user?.id && (
                                <>
                                  <button
                                    className="table-primary-icon-btn"
                                    onClick={() => handleEdit(webinar)}
                                    title="Edit Webinar"
                                  >
                                    <Edit className="table-primary-icon-sm" />
                                  </button>
                                  <button
                                    className="table-primary-icon-btn webinar-btn-delete"
                                    onClick={() => handleDelete(webinar.id, webinar.title)}
                                    title="Delete Webinar"
                                  >
                                    <Trash2 className="table-primary-icon-sm" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

          {/* Participant Details Overlay Modal */}
          {selectedWebinarId && participantDetails[selectedWebinarId] && (
            <>
              {/* Overlay backdrop */}
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999
                }}
                onClick={() => setSelectedWebinarId(null)}
              />
              {/* Modal */}
              <div style={{
                position: 'absolute',
                top: `${modalPosition.top}px`,
                left: `${modalPosition.left}px`,
                zIndex: 1000,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '0.75rem',
                minWidth: '280px',
                maxWidth: '380px',
                marginTop: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#374151' }}>
                    Participants ({participantDetails[selectedWebinarId].length})
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWebinarId(null);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      color: '#6b7280',
                      padding: 0,
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {participantDetails[selectedWebinarId].length > 0 ? (
                    participantDetails[selectedWebinarId].map((participant, idx) => (
                      <div 
                        key={idx}
                        style={{ 
                          padding: '0.5rem 0',
                          borderBottom: idx < participantDetails[selectedWebinarId].length - 1 ? '1px solid #f3f4f6' : 'none',
                          fontSize: '0.875rem'
                        }}
                      >
                        <div style={{ fontWeight: '500', color: '#111827' }}>
                          {participant.user_name || 'Guest'}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                          {participant.user_email || participant.unregistered_email}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.5rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                      No participants yet
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default WebinarPage;
