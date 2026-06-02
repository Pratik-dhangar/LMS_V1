import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Edit2, X, Eye, FileText, Video, ChevronLeft, ChevronRight, Star, MessageSquare, Loader2 } from 'lucide-react';
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
  const [totalSessions, setTotalSessions] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingSession, setEditingSession] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [editingHeadNotes, setEditingHeadNotes] = useState(null);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const { user } = useAuth();
  const [hoveredSession, setHoveredSession] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [selectedSessionForRecording, setSelectedSessionForRecording] = useState(null);
  const [recordingRows, setRecordingRows] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [openingRecordingSessionId, setOpeningRecordingSessionId] = useState(null);
  const [downloadingRecordingSessionId, setDownloadingRecordingSessionId] = useState(null);
  // const [showSearch, setShowSearch] = useState(false);

  const fetchSessions = async (page = currentPage) => {
    try {
      setLoading(true);
      const skip = (page - 1) * itemsPerPage;
      const data = await sessionService.getAllSessions(skip, itemsPerPage);
      setSessions(data.sessions || []);
      setTotalSessions(data.total || 0);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(currentPage);
  }, [currentPage, itemsPerPage]);

  const handleItemsPerPageChange = (e) => {
    const newLimit = parseInt(e.target.value);
    setItemsPerPage(newLimit);
    setCurrentPage(1); // Reset to first page when limit changes
  };

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

  const handleObserveSession = (session) => {
    // Validate session is active
    if (session.status !== 'active') {
      toast.error('Session is not currently active. Only active sessions can be observed.');
      return;
    }

    // Navigate to observer session page
    navigate(`/head/observer-session/${session.session_id}`);
  };

  const handleEditSuccess = async () => {
    await fetchSessions();
  };

  const handleViewFeedback = async (session) => {
    setFeedbackSession(session);
    setFeedbackList([]);
    setFeedbackLoading(true);
    try {
      const data = await sessionService.getSessionFeedback(session.session_id);
      setFeedbackList(data);
    } catch {
      toast.error('Failed to load feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const openSessionRecordingModal = async (session) => {
    try {
      setSelectedSessionForRecording(session);
      setShowRecordingModal(true);
      setLoadingRecordings(true);

      // Only show this session's recording if it has one
      if (session.recording_url) {
        setRecordingRows([session]);
      } else {
        setRecordingRows([]);
      }
    } catch (err) {
      console.error('Error loading session recording:', err);
      toast.error('Failed to load recording');
      setRecordingRows([]);
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleWatchRecording = async (sessionId) => {
    try {
      setOpeningRecordingSessionId(sessionId);
      const data = await sessionService.getRecordingUrl(sessionId);
      const playbackUrl = data?.playback_url;
      if (!playbackUrl) {
        toast.error('Recording URL not available yet');
        return;
      }
      window.open(playbackUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || 'Unable to open recording');
    } finally {
      setOpeningRecordingSessionId(null);
    }
  };

  const getRecordingDownloadFilename = (row, playbackUrl) => {
    const extensionMatch = playbackUrl?.match(/\.(webm|mp4|mkv|mov)(?:\?|$)/i);
    const extension = extensionMatch?.[1] || 'webm';
    const sessionRef = row?.session_id || row?.id || 'session';
    return `${sessionRef}_recording.${extension}`;
  };

  const triggerDownloadAnchor = (url, fileName) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadRecording = async (row) => {
    const sessionId = row?.id;
    if (!sessionId) {
      toast.error('Session ID missing for download');
      return;
    }

    try {
      setDownloadingRecordingSessionId(sessionId);
      const data = await sessionService.getRecordingUrl(sessionId);
      const playbackUrl = data?.playback_url;

      if (!playbackUrl) {
        toast.error('Recording URL not available yet');
        return;
      }

      const fileName = getRecordingDownloadFilename(row, playbackUrl);

      try {
        const response = await fetch(playbackUrl);
        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        triggerDownloadAnchor(blobUrl, fileName);
        window.URL.revokeObjectURL(blobUrl);
        toast.success('Recording download started');
      } catch (blobError) {
        console.warn('Blob download failed, falling back to direct URL:', blobError);
        triggerDownloadAnchor(playbackUrl, fileName);
        toast.info('Opened recording URL for download');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || 'Unable to download recording');
    } finally {
      setDownloadingRecordingSessionId(null);
    }
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
      scheduled: 'bg-[#fef3e2] text-[#9C4D0B]',
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
                className="app-modal-form-input"
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
              className="app-modal-btn app-modal-btn--success"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Schedule ILP
            </button>
            <button
              onClick={() => navigate('/head/manage-program-assignments')}
              className="app-modal-btn app-modal-btn--success"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Manage Home Learning Program
            </button>

            <button
              onClick={() => navigate('/head/manage-programs')}
              className="app-modal-btn app-modal-btn--success"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Manage Programs
            </button>
          </div>



          {/* Filters */}
          <div className="filter-tabs">
            <button
              onClick={() => {
                setFilter('all');
                setCurrentPage(1);
              }}
              className={`filter-tab ${filter === 'all' ? 'filter-tab-active' : ''}`}
            >
              All ({totalSessions})
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
                            <div className="materials-list flex flex-wrap gap-2">
                              {session.learning_goals && session.learning_goals.length > 0 && (
                                <span className="material-badge material-badge-orange">
                                  {session.learning_goals.length} Goal(s)
                                </span>
                              )}
                              {session.learning_contents && session.learning_contents.length > 0 && (
                                <span className="material-badge material-badge-orange">
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
                              {/* Observe button - only show for active sessions */}
                              {getSessionStatus(session) === 'active' && (
                                <button
                                  onClick={() => handleObserveSession(session)}
                                  className="btn-icon app-modal-btn app-modal-btn--success"
                                  title="Observe this live session"
                                >
                                  <Video size={14} />
                                </button>
                              )}

                              {session.status === 'scheduled' && getSessionStatus(session) !== 'expired' && (
                                <>
                                  <button
                                    onClick={() => handleEditSession(session)}
                                    className="btn-icon app-modal-btn app-modal-btn--primary"
                                    title="Edit this scheduled session"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleCancelSession(session.session_id, session.title)}
                                    className="btn-icon app-modal-btn app-modal-btn--secondary"
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
                                className="btn-icon app-modal-btn app-modal-btn--secondary"
                                title="View session details"
                              >
                                <Eye size={14} />
                              </button>
                              {/* Head Notes action should display for all accessible rows but only be active once session ended */}
                              {(user?.role === 'head' || user?.role === 'manager' || user?.role === 'trainer') && (
                                <button
                                  onClick={() => canHeadNotes && setEditingHeadNotes(session)}
                                  disabled={!canHeadNotes}
                                  className="btn-icon app-modal-btn app-modal-btn--primary"
                                  title={canHeadNotes ? 'Add head notes for this completed session' : 'Head notes available after session completion'}
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                              {/* Feedback Responses - only for ended sessions */}
                              {canHeadNotes && (
                                <button
                                  onClick={() => handleViewFeedback(session)}
                                  className="btn-icon app-modal-btn"
                                  style={{ background: '#7c3aed', color: '#fff' }}
                                  title="View learner feedback for this session"
                                >
                                  <Star size={14} />
                                </button>
                              )}
                              {/* View Recordings - only show if session has recording */}
                              {session.recording_url && (
                                <button
                                  onClick={() => openSessionRecordingModal(session)}
                                  className="btn-icon app-modal-btn app-modal-btn--success"
                                  title="View this session's recording"
                                >
                                  <Video size={14} />
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

                {/* Pagination */}
                {totalSessions > 0 && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      <div className="flex items-center gap-4">
                        <span>
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalSessions)} of {totalSessions} sessions
                        </span>
                        <div className="flex items-center gap-2">
                          <label htmlFor="itemsPerPage" className="text-sm text-gray-600">Show:</label>
                          <select
                            id="itemsPerPage"
                            value={itemsPerPage}
                            onChange={handleItemsPerPageChange}
                            className="app-modal-form-input py-1 px-2 text-sm w-20"
                          >
                            {[5, 10, 15, 20, 25, 30].map(val => (
                              <option key={val} value={val}>{val}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    {totalSessions > itemsPerPage && (
                      <div className="pagination-controls">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="pagination-button"
                          title="Previous page"
                        >
                          <ChevronLeft size={16} />
                        </button>

                        {/* Page numbers */}
                        {(() => {
                          const totalPages = Math.ceil(totalSessions / itemsPerPage);
                          const pages = [];
                          let startPage = Math.max(1, currentPage - 2);
                          let endPage = Math.min(totalPages, startPage + 4);

                          if (endPage - startPage < 4) {
                            startPage = Math.max(1, endPage - 4);
                          }

                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                                className={`pagination-button ${currentPage === i ? 'active' : ''}`}
                              >
                                {i}
                              </button>
                            );
                          }
                          return pages;
                        })()}

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalSessions / itemsPerPage)))}
                          disabled={currentPage === Math.ceil(totalSessions / itemsPerPage)}
                          className="pagination-button"
                          title="Next page"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            )}
          </div>

        </div>


      </main>

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

      {/* Feedback Responses Modal */}
      {feedbackSession && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}
          onClick={() => setFeedbackSession(null)}
        >
          <div
            style={{
              backgroundColor: '#fff', borderRadius: '14px', width: 'min(92vw, 540px)',
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 40px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1f2937' }}>
                  Feedback Responses
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                  {feedbackSession.title}
                </p>
              </div>
              <button
                onClick={() => setFeedbackSession(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.25rem', lineHeight: 1 }}
              >✕</button>
            </div>
            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {feedbackLoading ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>Loading feedback...</p>
              ) : feedbackList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#9ca3af' }}>
                  <MessageSquare size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No feedback yet</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Learners have not submitted feedback for this session.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {feedbackList.map((fb) => (
                    <div key={fb.id} style={{
                      border: '1px solid #e5e7eb', borderRadius: '10px',
                      padding: '1rem', backgroundColor: '#fafafa'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem' }}>
                            {fb.attendee_name || 'Anonymous'}
                          </span>
                          <span style={{
                            marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600,
                            padding: '1px 8px', borderRadius: '9999px',
                            background: fb.attendee_role === 'learner' ? '#dbeafe' : fb.attendee_role === 'guest' ? '#fef9c3' : '#dcfce7',
                            color: fb.attendee_role === 'learner' ? '#1d4ed8' : fb.attendee_role === 'guest' ? '#92400e' : '#166534'
                          }}>
                            {fb.attendee_role}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {new Date(fb.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {/* Stars */}
                      <div style={{ display: 'flex', gap: '3px', marginBottom: fb.remark ? '0.5rem' : 0 }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star
                            key={s}
                            size={18}
                            fill={s <= fb.rating ? '#f59e0b' : 'none'}
                            stroke={s <= fb.rating ? '#f59e0b' : '#d1d5db'}
                          />
                        ))}
                        <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>
                          {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][fb.rating]}
                        </span>
                      </div>
                      {fb.remark && (
                        <p style={{
                          margin: 0, fontSize: '0.875rem', color: '#374151',
                          background: '#fff', border: '1px solid #e5e7eb',
                          borderRadius: '6px', padding: '0.5rem 0.75rem'
                        }}>{fb.remark}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Footer */}
            {feedbackList.length > 0 && (
              <div style={{
                padding: '0.875rem 1.5rem', borderTop: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '0.8rem', color: '#6b7280', backgroundColor: '#f9fafb', borderRadius: '0 0 14px 14px'
              }}>
                <span>{feedbackList.length} response{feedbackList.length !== 1 ? 's' : ''}</span>
                <span>Avg rating: <strong style={{ color: '#f59e0b' }}>{(feedbackList.reduce((s, f) => s + f.rating, 0) / feedbackList.length).toFixed(1)} ★</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Recordings Modal */}
      {showRecordingModal && selectedSessionForRecording && (
        <div
          className="app-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRecordingModal(false);
            }
          }}
        >
          <div className="app-modal-container app-modal-container--lg" onClick={(e) => e.stopPropagation()}>
            <div className="app-modal-header app-modal-header--primary">
              <div className="app-modal-header-content">
                <h3 className="app-modal-title">Session Recordings</h3>
                <p className="app-modal-subtitle">{selectedSessionForRecording.trainer_name || 'Session'}</p>
              </div>
              <button className="app-modal-close" onClick={() => setShowRecordingModal(false)} aria-label="Close session recording modal">×</button>
            </div>

            <div className="app-modal-content">
              {loadingRecordings ? (
                <div className="app-modal-loading">
                  <Loader2 className="loading-spinner" /> Loading session recordings...
                </div>
              ) : recordingRows.length === 0 ? (
                <div className="app-modal-table-empty">No recording available for this session.</div>
              ) : (
                <div className="app-modal-table-container">
                  <table className="app-modal-table">
                    <thead className="app-modal-table-header">
                      <tr>
                        <th>Session</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Recording</th>
                      </tr>
                    </thead>
                    <tbody className="app-modal-table-body">
                      {recordingRows.map((row, idx) => (
                        <tr key={`${row.id}_${idx}`} className="recording-table-row">
                          <td>{row.session_id || row.id}</td>
                          <td>
                            {row.recorded_at
                              ? new Date(row.recorded_at).toLocaleString()
                              : row.scheduled_date
                                ? new Date(row.scheduled_date).toLocaleString()
                                : 'N/A'}
                          </td>
                          <td>
                            <span className={`recording-status-chip recording-status-${(row.recording_status || 'pending').toLowerCase()}`}>
                              {row.recording_status || 'pending'}
                            </span>
                          </td>
                          <td>
                            {row.recording_status === 'completed' && row.recording_url ? (
                              <div className="recording-action-group">
                                <button
                                  onClick={() => handleWatchRecording(row.id)}
                                  disabled={openingRecordingSessionId === row.id || downloadingRecordingSessionId === row.id}
                                  className="recording-watch-btn"
                                >
                                  {openingRecordingSessionId === row.id ? 'Opening...' : 'Watch'}
                                </button>
                                <button
                                  onClick={() => handleDownloadRecording(row)}
                                  disabled={downloadingRecordingSessionId === row.id || openingRecordingSessionId === row.id}
                                  className="recording-download-btn"
                                >
                                  {downloadingRecordingSessionId === row.id ? 'Downloading...' : 'Download'}
                                </button>
                              </div>
                            ) : row.recording_status === 'failed' ? (
                              <span className="recording-meta recording-meta-failed">Failed</span>
                            ) : row.recording_status === 'processing' || row.recording_status === 'recording' ? (
                              <span className="recording-meta recording-meta-processing">Processing...</span>
                            ) : (
                              <span className="recording-meta recording-meta-empty">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
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
