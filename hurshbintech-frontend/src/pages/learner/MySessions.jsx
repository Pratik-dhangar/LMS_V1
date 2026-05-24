import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from "../../context/AuthContext";
import sessionService from "../../api/services/sessionService";
import { SessionFeedbackModal } from "../../components/session/AttendeeSessionLayout";
import "../../styles/components/common/Modal.css";
import "../../styles/ManageUsersLayout.css";

const MySessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const sessionErrorToastShownRef = useRef(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState(null);

  // Track which sessions have been joined - persist to localStorage
  const [joinedSessions, setJoinedSessions] = useState(() => {
    const saved = localStorage.getItem('joinedSessions');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    fetchSessions();

    // Auto-refresh sessions every 30 seconds
    const refreshInterval = setInterval(() => {
      console.log('[MySessions] Auto-refreshing sessions...');
      fetchSessions();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist joinedSessions to localStorage
  useEffect(() => {
    localStorage.setItem('joinedSessions', JSON.stringify([...joinedSessions]));
  }, [joinedSessions]);

  const fetchSessions = async () => {
    try {
      const data = await sessionService.getLearnerSessions();
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      if (!sessionErrorToastShownRef.current) {
        sessionErrorToastShownRef.current = true;
      }
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleJoinSession = (sessionId) => {
    // Mark this session as joined
    setJoinedSessions(prev => new Set([...prev, sessionId]));
    navigate(`/learner/session/${sessionId}`);
  };

  const handleViewSessionDetails = (session) => {
    setSelectedSession(session);
    setShowSessionDetailsModal(true);
  };

  const closeSessionDetailsModal = () => {
    setShowSessionDetailsModal(false);
    setSelectedSession(null);
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isSameLocalDay = (dateA, dateB) => {
    if (!dateA || !dateB) return false;
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  };

  const canJoinSession = (session) => {
    if (!session?.scheduled_date) return false;

    const status = session.status;
    if (status === 'cancelled' || status === 'ended') {
      return false;
    }

    const scheduled = new Date(session.scheduled_date);
    return isSameLocalDay(scheduled, new Date());
  };

  return (
    <div className="page-container">
      <style>{`
        /* Mobile Responsive Styles for My Sessions */
        
        /* Mobile Portrait */
        @media (max-width: 768px) {
          .page-container {
            padding: 8px !important;
          }
          
          .page-content {
            padding: 0 !important;
          }
          
          .page-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            margin-bottom: 16px !important;
          }
          
          .page-title {
            font-size: 1.25rem !important;
          }
          
          .back-button {
            font-size: 0.875rem !important;
            padding: 8px 12px !important;
          }
        }
        
        /* Session Cards Mobile */
        @media (max-width: 900px) {
          .session-card-container {
            flex-direction: column !important;
            gap: 12px !important;
            padding: 12px !important;
          }
          
          .session-card-info {
            width: 100% !important;
          }
          
          .session-card-actions {
            width: 100% !important;
            margin-left: 0 !important;
            margin-top: 8px !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            gap: 8px !important;
          }
          
          .session-card-actions button {
            flex: 1 !important;
            min-width: 0 !important;
            font-size: 0.8rem !important;
            padding: 10px 12px !important;
            white-space: nowrap !important;
          }
        }
        
        /* Header Controls Mobile */
        @media (max-width: 768px) {
          .sessions-header-controls {
            flex-direction: column !important;
            align-items: flex-start !important;
            width: 100% !important;
            gap: 8px !important;
          }
          
          .sessions-header-controls > div {
            width: 100% !important;
            justify-content: space-between !important;
          }
        }
        
        /* Mobile Landscape */
        @media (max-width: 1024px) and (orientation: landscape) {
          .page-title {
            font-size: 1.125rem !important;
          }
          
          .session-card-container {
            padding: 10px !important;
          }
          
          .session-card-actions button {
            font-size: 0.75rem !important;
            padding: 6px 10px !important;
          }
        }
        
        /* Modal Responsive */
        @media (max-width: 768px) {
          .app-modal-container {
            margin: 16px !important;
            max-width: calc(100vw - 32px) !important;
            max-height: calc(100vh - 32px) !important;
            overflow-y: auto !important;
          }
          
          .app-modal-content {
            padding: 16px !important;
          }
          
          .app-modal-form-grid--2 {
            grid-template-columns: 1fr !important;
          }
          
          .app-modal-footer {
            flex-direction: column !important;
          }
          
          .app-modal-footer button {
            width: 100% !important;
          }
        }
        
        /* Extra Small Devices */
        @media (max-width: 480px) {
          .page-title {
            font-size: 1.125rem !important;
          }
          
          .session-card-container {
            padding: 10px !important;
          }
          
          .session-card-actions {
            flex-direction: column !important;
            gap: 6px !important;
          }
          
          .session-card-actions button {
            width: 100% !important;
            font-size: 0.75rem !important;
            padding: 8px 10px !important;
          }
        }
        
        /* Touch-friendly targets */
        @media (hover: none) and (pointer: coarse) {
          button {
            min-height: 44px !important;
          }
        }
      `}</style>
      <main className="page-main">
        <div className="page-content">
          {/* Page Header */}
          <div className="page-header">
            <button onClick={() => navigate('/learner/dashboard')} className="back-button">
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
            <h1 className="page-title">
              My Sessions (ILP)
            </h1>
          </div>

          {/* Upcoming Sessions */}
          <div style={{
            marginTop: '2.5rem',
            background: '#ffffff',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            padding: '1.5rem'
          }}>
            <div className="sessions-header-controls" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1f2937',
                margin: 0
              }}>
                My Sessions
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#4b5563'
                }}>
                  {sessions.length} total items
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <label
                    htmlFor="pagination"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#4b5563'
                    }}
                  >
                    Show:
                  </label>
                  <select
                    id="pagination"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: '#ffffff',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#1f2937',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#9ca3af'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>

            {loadingSessions ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>No sessions scheduled.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sessions
                  .sort((a, b) => {
                    const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : Number.POSITIVE_INFINITY;
                    const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : Number.POSITIVE_INFINITY;

                    if (dateA !== dateB) {
                      return dateA - dateB;
                    }

                    return (a.session_id || a.id || 0) - (b.session_id || b.id || 0);
                  })
                  .slice(0, itemsPerPage)
                  .map((session) => {
                    // Helper function to get actual status (considering expired sessions)
                    const getSessionStatus = (sess) => {
                      // First check if already cancelled or ended
                      if (sess.status === 'cancelled') {
                        return 'cancelled';
                      }
                      if (sess.status === 'active') {
                        return 'active';
                      }
                      if (sess.status === 'ended') {
                        return 'ended';
                      }

                      // Check if scheduled session is expired (scheduled time + duration has passed and session not started)
                      if (sess.status === 'scheduled' && sess.scheduled_date) {
                        try {
                          const now = new Date();
                          const scheduled = new Date(sess.scheduled_date);

                          // Calculate session end time: scheduled_date + duration (in minutes)
                          const durationMs = (sess.duration || 0) * 60 * 1000; // Convert minutes to milliseconds
                          const sessionEndTime = new Date(scheduled.getTime() + durationMs);

                          // If current time is after (session end time), it's expired
                          if (now >= sessionEndTime) {
                            return 'expired';
                          }
                        } catch (e) {
                          console.warn('Error parsing session date:', e);
                        }
                      }

                      return sess.status;
                    };
                    const actualStatus = getSessionStatus(session);
                    const isActive = actualStatus === 'active';
                    const isScheduled = actualStatus === 'scheduled';
                    const isEnded = actualStatus === 'ended';
                    const isExpired = actualStatus === 'expired';
                    const isCancelled = actualStatus === 'cancelled';

                    const statusColor = isActive ? { border: '#10b981', bg: '#d1fae5' } :
                      isScheduled ? { border: '#f59e0b', bg: '#fef3c7' } :
                        isExpired ? { border: '#9ca3af', bg: '#f3f4f6' } :
                          isCancelled ? { border: '#ef4444', bg: '#fee2e2' } :
                            { border: '#d1d5db', bg: '#f9fafb' };
                    const statusBadge = isActive ? { bg: '#d1fae5', color: '#065f46' } :
                      isScheduled ? { bg: '#fef3c7', color: '#92400e' } :
                        isExpired ? { bg: '#e5e7eb', color: '#374151' } :
                          isCancelled ? { bg: '#fee2e2', color: '#dc2626' } :
                            { bg: '#f3f4f6', color: '#1f2937' };
                    const joinableToday = canJoinSession(session);
                    const joinButtonLabel = joinedSessions.has(session.session_id) ? 'Rejoin Session' : 'Join Session';

                    return (
                      <div
                        key={session.session_id || session.id}
                        className="session-card-container"
                        style={{
                          borderLeft: `4px solid ${statusColor.border}`,
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: statusColor.bg,
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'}
                      >
                        <div className="session-card-info" style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontWeight: '600', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {session.title || `Session with ${session.trainer?.name || session.trainer_name || 'Trainer'}`}
                            </h3>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: statusBadge.bg,
                              color: statusBadge.color
                            }}>
                              {isExpired ? 'Expired' : isCancelled ? 'Cancelled' : (actualStatus || 'scheduled').charAt(0).toUpperCase() + (actualStatus || 'scheduled').slice(1)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', color: '#4b5563' }}>
                            <span>📅 {formatShortDate(session.scheduled_date ?? session.started_at)}</span>
                            <span>👨‍🏫 {session.trainer?.name || session.trainer_name || '—'}</span>
                          </div>
                          {session.program?.name && (
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Program: {session.program.name}</p>
                          )}
                        </div>

                        <div className="session-card-actions" style={{ marginLeft: '1rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                          {(isEnded || isExpired || isCancelled) && (
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: isExpired ? '#e5e7eb' : isCancelled ? '#fee2e2' : '#f3f4f6',
                              color: isExpired ? '#374151' : isCancelled ? '#dc2626' : '#1f2937'
                            }}>
                              {isExpired ? 'Expired' : isCancelled ? 'Cancelled' : 'Ended'}
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {(isActive || isScheduled) && !isExpired && !isCancelled && (
                              <button
                                onClick={() => handleJoinSession(session.session_id)}
                                disabled={!joinableToday}
                                style={{
                                  background: joinableToday ? 'linear-gradient(to right, #f59e0b, #d97706)' : '#d1d5db',
                                  color: '#ffffff',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  border: 'none',
                                  cursor: joinableToday ? 'pointer' : 'not-allowed',
                                  transition: 'all 0.2s',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                }}
                                onMouseEnter={(e) => {
                                  if (joinableToday) {
                                    e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #ea580c)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = joinableToday ? 'linear-gradient(to right, #f59e0b, #d97706)' : '#d1d5db';
                                }}
                                title={joinableToday ? 'Join session today' : 'Join Session is available only on the session day'}
                              >
                                {joinButtonLabel}
                              </button>
                            )}
                            {isEnded && (
                              <button
                                onClick={() => { setFeedbackSessionId(session.session_id); setShowFeedbackModal(true); }}
                                style={{
                                  background: 'linear-gradient(to right, #7a2c2c, #5c1e1e)',
                                  color: '#ffffff',
                                  padding: '0.375rem 0.75rem',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  border: 'none',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #8a3333, #6b2626)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #7a2c2c, #5c1e1e)'}
                              >
                                ★ Feedback
                              </button>
                            )}
                            <button
                              onClick={() => handleViewSessionDetails(session)}
                              className="text-sm px-3 py-1 border rounded text-gray-700 hover:bg-gray-50"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Pagination Info */}
                {sessions.length > itemsPerPage && (
                  <div style={{
                    textAlign: 'center',
                    padding: '1rem',
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    Showing {itemsPerPage} of {sessions.length} sessions
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Session Details Modal */}
      {showSessionDetailsModal && selectedSession && (
        <div className="app-modal-overlay" onClick={closeSessionDetailsModal}>
          <div className="app-modal-container app-modal-container--lg" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Session Details</h2>
              <button
                onClick={closeSessionDetailsModal}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="app-modal-content">
              {/* Title */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Session Title</label>
                <p className="app-modal-text">{selectedSession.title || `Session with ${selectedSession.trainer?.name || selectedSession.trainer_name || "Trainer"}`}</p>
              </div>

              {/* Trainer Info */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Trainer</label>
                <p className="app-modal-text">{selectedSession.trainer?.name || selectedSession.trainer_name || "Unknown Trainer"}</p>
              </div>

              {/* Status */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Status</label>
                {(() => {
                  // Helper function to get actual status (considering expired sessions)
                  const getSessionStatus = (sess) => {
                    // First check if already cancelled or ended
                    if (sess.status === 'cancelled') {
                      return 'cancelled';
                    }
                    if (sess.status === 'active') {
                      return 'active';
                    }
                    if (sess.status === 'ended') {
                      return 'ended';
                    }

                    // Check if scheduled session is expired (time has passed and session not started)
                    if (sess.status === 'scheduled' && sess.scheduled_date) {
                      try {
                        const now = new Date();
                        const scheduled = new Date(sess.scheduled_date);

                        // Calculate session end time based on duration
                        const durationMs = (sess.duration || 0) * 60 * 1000; // Convert minutes to milliseconds
                        const sessionEndTime = new Date(scheduled.getTime() + durationMs);

                        // If current time is past the session end time (scheduled + duration), it's expired
                        if (now >= sessionEndTime) {
                          return 'expired';
                        }
                      } catch (e) {
                        console.warn('Error parsing session date:', e);
                      }
                    }

                    return sess.status;
                  };
                  const actualStatus = getSessionStatus(selectedSession);
                  const statusColors = {
                    active: 'bg-green-100 text-green-800',
                    scheduled: 'bg-yellow-100 text-yellow-800',
                    cancelled: 'bg-red-100 text-red-800',
                    expired: 'bg-gray-100 text-gray-800',
                    ended: 'bg-gray-100 text-gray-800'
                  };
                  return (
                    <span className={`app-modal-badge ${statusColors[actualStatus] || 'bg-gray-100 text-gray-800'}`}>
                      {actualStatus === 'expired' ? 'Expired' : actualStatus === 'cancelled' ? 'Cancelled' : actualStatus ? actualStatus.charAt(0).toUpperCase() + actualStatus.slice(1) : 'Scheduled'}
                    </span>
                  );
                })()}
              </div>

              {/* Date & Time */}
              <div className="app-modal-form-grid app-modal-form-grid--2">
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Date</label>
                  <p className="app-modal-text">
                    {selectedSession.scheduled_date
                      ? new Date(selectedSession.scheduled_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Program */}
              <div className="app-modal-form-grid app-modal-form-grid--2">
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Program / ILP</label>
                  <p className="app-modal-text">
                    {selectedSession.learning_goals && selectedSession.learning_goals.length > 0
                      ? selectedSession.learning_goals.map(goal => goal.goal).join(", ")
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedSession.description && (
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Description</label>
                  <p className="app-modal-text" style={{ whiteSpace: 'pre-wrap' }}>{selectedSession.description}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="app-modal-footer">
              <button
                onClick={closeSessionDetailsModal}
                className="app-modal-btn app-modal-btn--secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && feedbackSessionId && (
        <SessionFeedbackModal
          onSubmit={async (rating, remark) => {
            try {
              await sessionService.submitFeedback(feedbackSessionId, { rating, remark, attendeeRole: 'learner' });
              toast.success('Thank you for your feedback!');
            } catch {
              toast.error('Failed to submit feedback. Please try again.');
            }
            setShowFeedbackModal(false);
            setFeedbackSessionId(null);
          }}
          onSkip={() => { setShowFeedbackModal(false); setFeedbackSessionId(null); }}
        />
      )}
    </div>
  );
};

export default MySessions;
