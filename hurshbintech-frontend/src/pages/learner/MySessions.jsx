import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";
import "../../styles/components/common/Modal.css";
import "../../styles/admin/index.css";

const MySessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const sessionErrorToastShownRef = useRef(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(5);

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

  return (
    <div className="admin-dashboard-container">
      <Navbar />

      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              My Sessions (IIP)
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
            <div style={{
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
                    // Sort by status priority: active first, then scheduled, then cancelled/expired/ended
                    const statusPriority = { active: 0, scheduled: 1, cancelled: 2, expired: 2, ended: 3 };
                    // Get actual status for sorting
                    const getSessionStatus = (sess) => {
                      if (sess.status === 'scheduled' && sess.scheduled_date) {
                        const now = new Date();
                        const scheduled = new Date(sess.scheduled_date);
                        if (scheduled < now) {
                          return 'expired';
                        }
                      }
                      return sess.status;
                    };
                    const aStatus = getSessionStatus(a);
                    const bStatus = getSessionStatus(b);
                    const aPriority = statusPriority[aStatus] ?? 4;
                    const bPriority = statusPriority[bStatus] ?? 4;
                    if (aPriority !== bPriority) return aPriority - bPriority;
                    // Within same status, sort by date (newest first)
                    return new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0);
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

                    return (
                      <div
                        key={session.session_id || session.id}
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
                        <div style={{ flex: 1, minWidth: 0 }}>
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
                            {session.scheduled_date && (
                              <span>🕐 {new Date(session.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                            <span>👨‍🏫 {session.trainer?.name || session.trainer_name || '—'}</span>
                            {session.duration && <span>⏱️ {session.duration} min</span>}
                          </div>
                          {session.program && (
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Program: {session.program}</p>
                          )}
                        </div>

                        <div style={{ marginLeft: '1rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
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
                                style={{
                                  background: 'linear-gradient(to right, #f59e0b, #d97706)',
                                  color: '#ffffff',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #ea580c)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #f59e0b, #d97706)'}
                              >
                                {joinedSessions.has(session.session_id) ? 'Rejoin Session' : 'Join Session'}
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
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-2">Session Title</label>
                <p className="text-lg text-gray-800">{selectedSession.title || `Session with ${selectedSession.trainer?.name || selectedSession.trainer_name || "Trainer"}`}</p>
              </div>

              {/* Trainer Info */}
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-2">Trainer</label>
                <p className="text-gray-800">{selectedSession.trainer?.name || selectedSession.trainer_name || "Unknown Trainer"}</p>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-2">Status</label>
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
                  return (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold" style={{
                      background: actualStatus === 'active' ? '#d1fae5' :
                        actualStatus === 'scheduled' ? '#fef3c7' :
                          actualStatus === 'cancelled' ? '#fee2e2' :
                            actualStatus === 'expired' ? '#e5e7eb' :
                              actualStatus === 'ended' ? '#f3f4f6' : '#f9fafb',
                      color: actualStatus === 'active' ? '#065f46' :
                        actualStatus === 'scheduled' ? '#92400e' :
                          actualStatus === 'cancelled' ? '#dc2626' :
                            actualStatus === 'expired' ? '#374151' :
                              actualStatus === 'ended' ? '#1f2937' : '#1f2937'
                    }}>
                      {actualStatus === 'expired' ? 'Expired' : actualStatus === 'cancelled' ? 'Cancelled' : actualStatus ? actualStatus.charAt(0).toUpperCase() + actualStatus.slice(1) : 'Scheduled'}
                    </span>
                  );
                })()}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Date</label>
                  <p className="text-gray-800">
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
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Time</label>
                  <p className="text-gray-800">
                    {selectedSession.scheduled_date
                      ? new Date(selectedSession.scheduled_date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Duration & Program */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Duration</label>
                  <p className="text-gray-800">{selectedSession.duration ? `${selectedSession.duration} minutes` : "—"}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Program / IIP</label>
                  <p className="text-gray-800">
                    {selectedSession.learning_goals && selectedSession.learning_goals.length > 0
                      ? selectedSession.learning_goals.map(goal => goal.goal).join(", ")
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedSession.description && (
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Description</label>
                  <p className="text-gray-800 whitespace-pre-wrap">{selectedSession.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MySessions;
