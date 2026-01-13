import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Edit2, X, Eye, FileText } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import sessionService from '../../api/services/sessionService';
// import headSessionNotesService from '../../api/services/headSessionNotesService';
import { useAuth } from '../../context/AuthContext';
import SearchBar from '../../components/common/SearchBar';
import EditSessionModal from './EditSessionModal';
import ViewSessionModal from './ViewSessionModal';
import HeadSessionNotesModal from './HeadSessionNotesModal';
import SessionTooltip from '../../components/common/SessionTooltip';
import '../../styles/Table.css';
import '../../styles/ManageUsersLayout.css';

const ManageSessions = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingSession, setEditingSession] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [editingHeadNotes, setEditingHeadNotes] = useState(null);
  const { user } = useAuth();
  const [hoveredSession, setHoveredSession] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  // const [showSearch, setShowSearch] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      // Assuming we need to create an endpoint for head to get all sessions
      const data = await sessionService.getAllSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCancelSession = async (sessionId, sessionTitle) => {
    if (window.confirm(`Are you sure you want to cancel the session "${sessionTitle}"? The session status will be marked as cancelled.`)) {
      try {
        setLoading(true);
        await sessionService.cancelSession(sessionId);
        toast.success('Session cancelled successfully');
        // Refresh the sessions list
        await fetchSessions();
      } catch (error) {
        console.error('Error cancelling session:', error);
        const errorMessage = error.response?.data?.detail || 'Failed to cancel session';
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditSession = (session) => {
    setEditingSession(session);
  };

  const handleViewSession = (session) => {
    setViewingSession(session);
  };

  const handleEditSuccess = async () => {
    await fetchSessions();
  };

  const handleSessionTitleClick = (session, event) => {
    event.stopPropagation();
    const rect = event.target.getBoundingClientRect();

    // Calculate initial position
    let x = rect.left + rect.width + 10;
    let y = rect.top;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = 400; // max-width from CSS
    const tooltipHeight = 300; // estimated height, will be adjusted by content

    // Adjust horizontal position if tooltip goes off-screen to the right
    if (x + tooltipWidth > viewportWidth) {
      // Position to the left of the element instead
      x = rect.left - tooltipWidth - 10;
    }

    // Ensure x doesn't go below 0 (off-screen to the left)
    if (x < 0) {
      x = 10; // 10px margin from left edge
    }

    // Adjust vertical position if tooltip goes off-screen at the bottom
    if (y + tooltipHeight > viewportHeight) {
      // Position so it doesn't go off-screen, with some margin
      y = Math.max(10, viewportHeight - tooltipHeight - 10);
    }

    setTooltipPosition({
      x,
      y
    });
    setHoveredSession(session);
  };

  const handleCloseTooltip = () => {
    setHoveredSession(null);
  };

  const getSessionStatus = (session) => {
    // First check if already cancelled or ended
    if (session.status === 'cancelled') {
      return 'cancelled';
    }
    if (session.status === 'active') {
      return 'active';
    }
    if (session.status === 'ended') {
      return 'ended';
    }

    // Check if scheduled session is expired (scheduled time + duration has passed and session not started)
    if (session.status === 'scheduled' && session.scheduled_date) {
      try {
        const now = new Date();
        const scheduled = new Date(session.scheduled_date);

        // Calculate session end time: scheduled_date + duration (in minutes)
        const durationMs = (session.duration || 0) * 60 * 1000; // Convert minutes to milliseconds
        const sessionEndTime = new Date(scheduled.getTime() + durationMs);

        // Add 5-minute buffer to account for timezone differences
        const bufferMs = 5 * 60 * 1000; // 5 minutes
        const adjustedNow = new Date(now.getTime() - bufferMs);

        // If current time is after (session end time + buffer), it's expired
        if (adjustedNow >= sessionEndTime) {
          return 'expired';
        }
      } catch (e) {
        console.warn('Error parsing session date:', e);
      }
    }

    return session.status;
  };

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-300 text-gray-900'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredSessions = sessions.filter(session => {
    const matchesFilter = filter === 'all' || session.status === filter;
    const matchesSearch = !searchTerm ||
      session.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.trainer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.learner_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || (session.scheduled_date && session.scheduled_date.slice(0, 10) === dateFilter);
    return matchesFilter && matchesSearch && matchesDate;
  });

  return (
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/head/dashboard")}
              className="back-button"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>
            <div>
              <h1 className="page-title">
                Manage Training Sessions
              </h1>
              <p className="page-description">View and manage all training sessions</p>
            </div>
          </div>

          {/* Search and Add Section */}
          <div className="search-section ">

            <SearchBar
              onSearch={setSearchTerm}
              placeholder="Search by title, trainer, or learner..."
            />
            <div className="date-filter-group">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="form-input"
                aria-label="Filter by date"
                title="Filter sessions by date"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="btn-icon-secondary"
                  title="Clear date filter"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => navigate('/head/schedule-session')}
              className="btn-success"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Schedule Session
            </button>
          </div>

       

          {/* Filters */}
          <div className="filter-tabs">
            <button
              onClick={() => setFilter('all')}
              className={`filter-tab ${filter === 'all' ? 'filter-tab-active' : ''}`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setFilter('scheduled')}
              className={`filter-tab ${filter === 'scheduled' ? 'filter-tab-active' : ''}`}
            >
              Scheduled ({sessions.filter(s => s.status === 'scheduled').length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`filter-tab ${filter === 'active' ? 'filter-tab-active' : ''}`}
            >
              Active ({sessions.filter(s => s.status === 'active').length})
            </button>
            <button
              onClick={() => setFilter('ended')}
              className={`filter-tab ${filter === 'ended' ? 'filter-tab-active' : ''}`}
            >
              Completed ({sessions.filter(s => s.status === 'ended').length})
            </button>
            <button
              onClick={() => setFilter('cancelled')}
              className={`filter-tab ${filter === 'cancelled' ? 'filter-tab-active' : ''}`}
            >
              Cancelled ({sessions.filter(s => s.status === 'cancelled').length})
            </button>
          </div>

          {/* Sessions Table */}
          <div className="table-primary-container">
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="table-primary-empty">
                <p className="table-primary-empty-title">No {filter !== 'all' ? filter : ''} sessions found</p>
                <p className="table-primary-empty-description">Schedule a new session to get started</p>
              </div>
            ) : (
              <div className="table-primary-wrapper">
                <table className="table-primary">
                  <thead className="table-primary-header">
                    <tr>
                      <th className="table-primary-th">
                        Session Title
                      </th>
                      <th className="table-primary-th">
                        Trainer
                      </th>
                      <th className="table-primary-th">
                        Learner
                      </th>
                      <th className="table-primary-th">
                        Scheduled Date
                      </th>
                      <th className="table-primary-th">
                        Duration
                      </th>
                      <th className="table-primary-th">
                        Status
                      </th>
                      <th className="table-primary-th">
                        Materials
                      </th>
                      <th className="table-primary-th">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="table-primary-body">
                    {filteredSessions.map((session) => {
                      const statusNorm = String(session.status || '').trim().toLowerCase();
                      const canView = true; // Allow viewing all sessions
                      const canHeadNotes = statusNorm === 'ended';
                      return (
                        <tr key={session.id} className="table-primary-row">
                          <td className="table-primary-td">
                            <div
                              className="table-primary-cell-name-text"
                              onClick={(e) => handleSessionTitleClick(session, e)}
                              style={{ cursor: 'pointer', position: 'relative' }}
                            >
                              {session.title}
                            </div>
                            {session.description && (
                              <div className="table-primary-cell-subtitle">{session.description}</div>
                            )}
                          </td>
                          <td className="table-primary-td">
                            <div>
                              {session.trainer_name || 'N/A'}
                            </div>
                          </td>
                          <td className="table-primary-td">
                            <div>
                              {session.learner_name || 'N/A'}
                            </div>
                          </td>
                          <td className="table-primary-td">
                            <div>
                              {session.scheduled_date
                                ? new Date(session.scheduled_date).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                                : 'N/A'}
                            </div>
                          </td>
                          <td className="table-primary-td">
                            <div>{session.duration} min</div>
                          </td>
                          <td className="table-primary-td">
                            <span className={`status-badge ${getStatusBadge(getSessionStatus(session))}`}>
                              {getSessionStatus(session) === 'expired' ? 'Expired' : getSessionStatus(session).charAt(0).toUpperCase() + getSessionStatus(session).slice(1)}
                            </span>
                          </td>
                          <td className="table-primary-td">
                            <div className="materials-list">
                              {session.learning_goals && session.learning_goals.length > 0 && (
                                <span className="material-badge material-badge-green">
                                  {session.learning_goals.length} Goal(s)
                                </span>
                              )}
                              {session.learning_contents && session.learning_contents.length > 0 && (
                                <span className="material-badge material-badge-blue">
                                  {session.learning_contents.length} Content(s)
                                </span>
                              )}
                              {(!session.learning_goals || session.learning_goals.length === 0) &&
                                (!session.learning_contents || session.learning_contents.length === 0) && (
                                  <span className="material-badge material-badge-gray">No materials</span>
                                )}
                            </div>
                          </td>
                          <td className="table-primary-td">
                            <div className="actions-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {session.status === 'scheduled' && getSessionStatus(session) !== 'expired' && (
                                <>
                                  <button
                                    onClick={() => handleEditSession(session)}
                                    className="btn-icon btn-primary"
                                    title="Edit this scheduled session"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleCancelSession(session.session_id, session.title)}
                                    className="btn-icon btn-secondary"
                                    title="Cancel this scheduled session"
                                    
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                              {/* View action: always visible but only active when session is active/ended */}
                              <button
                                onClick={() => handleViewSession(session)}
                                disabled={false}
                                className="btn-icon btn-secondary"
                                title="View session details"
                              >
                                <Eye size={14} />
                              </button>
                              {/* Head Notes action should display for all accessible rows but only be active once session ended */}
                              {(user?.role === 'head' || user?.role === 'manager' || user?.role === 'trainer') && (
                                <button
                                  onClick={() => canHeadNotes && setEditingHeadNotes(session)}
                                  disabled={!canHeadNotes}
                                  className="btn-icon btn-primary"
                                  title={canHeadNotes ? 'Add head notes for this completed session' : 'Head notes available after session completion'}
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                              {session.status !== 'scheduled' && session.status !== 'active' && session.status !== 'ended' && session.status !== 'cancelled' && (
                                <span className="material-badge material-badge-gray">
                                  Can't edit/delete
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            )}
          </div>

        </div>


      </main>
      <Footer />

      {/* Edit Session Modal */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* View Session Modal */}
      {viewingSession && (
        <ViewSessionModal
          session={viewingSession}
          onClose={() => setViewingSession(null)}
        />
      )}

      {/* Head Session Notes Modal */}
      {editingHeadNotes && (
        <HeadSessionNotesModal
          session={editingHeadNotes}
          onClose={() => setEditingHeadNotes(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Session Tooltip */}
      {hoveredSession && (
        <SessionTooltip
          session={hoveredSession}
          position={tooltipPosition}
          onClose={handleCloseTooltip}
        />
      )}
    </div>


  );
};

export default ManageSessions;
