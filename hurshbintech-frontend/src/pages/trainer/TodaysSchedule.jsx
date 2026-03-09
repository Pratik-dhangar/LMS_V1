import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import sessionService from "../../api/services/sessionService";
import { ArrowLeft } from 'lucide-react';
import '../../styles/ManageUsersLayout.css';
import '../../styles/trainer/Schedule.css';

const TodaysSchedule = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  // Auto-refresh sessions every 30 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log('[TodaysSchedule] Auto-refreshing sessions...');
      fetchSessions();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, []);

  const fetchSessions = async () => {
    try {
      const data = await sessionService.getTrainerSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (sessionId) => {
    try {
      await sessionService.startSession(sessionId);
      toast.success("Session started!");
      navigate(`/trainer/session/${sessionId}`);
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error(error?.response?.data?.detail || "Failed to start session");
    }
  };

  const handleResumeSession = (sessionId) => {
    navigate(`/trainer/session/${sessionId}`);
  };

  const handleViewRecording = async (session) => {
    if (!session.recording_url) {
      toast.info("Recording not available yet");
      return;
    }

    if (session.recording_status === "processing") {
      toast.info("Recording is still being processed. Please try again later.");
      return;
    }

    if (session.recording_status === "failed") {
      toast.error("Recording failed to process");
      return;
    }

    try {
      const response = await sessionService.getRecordingUrl(session.id);
      if (response.playback_url) {
        window.open(response.playback_url, "_blank");
      } else {
        toast.error("Failed to generate playback URL");
      }
    } catch (error) {
      console.error("Error fetching recording URL:", error);
      if (error.response?.status === 404) {
        toast.error("Recording not found");
      } else if (error.response?.status === 425) {
        toast.info("Recording is still being processed");
      } else {
        toast.error("Failed to load recording");
      }
    }
  };

  const closeSessionDetailsModal = () => {
    setShowSessionDetailsModal(false);
    setSelectedSession(null);
  };

  const getStatusBadge = (status) => {
    const base = "trainer-status-badge";
    const map = {
      scheduled: "trainer-status-scheduled",
      active: "trainer-status-active",
      ended: "trainer-status-ended",
      expired: "trainer-status-expired",
      cancelled: "trainer-status-cancelled",
    };
    return `${base} ${map[status] || "trainer-status-ended"}`;
  };

  // Get actual session status considering expiration based on duration
  const getSessionStatus = (session) => {
    // First check if already cancelled or ended or active
    if (session.status === 'cancelled') {
      return 'cancelled';
    }
    if (session.status === 'active') {
      return 'active';
    }
    if (session.status === 'ended') {
      return 'ended';
    }

    // Check if session is expired — trainer/coach keep access until midnight of session day
    if (session.scheduled_date) {
      try {
        const now = new Date();
        const scheduled = new Date(session.scheduled_date);

        // Expire at end of session day (midnight) so trainer can resume any time during the day
        const midnight = new Date(scheduled);
        midnight.setHours(23, 59, 59, 999);

        if (now > midnight) {
          return 'expired';
        }
      } catch (e) {
        console.warn('Error parsing session date:', e);
      }
    }
    return session.status || 'scheduled';
  };

  // Check if trainer can start session based on scheduled time
  const canStartSession = (session) => {
    // Can only start if status is scheduled (not ended, cancelled, or already active)
    if (session.status !== 'scheduled') {
      return false;
    }

    // Check if current time is within 5 minutes before (or after) the scheduled time
    if (session.scheduled_date) {
      try {
        const now = new Date();
        const scheduled = new Date(session.scheduled_date);

        // Allow starting up to 5 minutes early
        const earlyStart = new Date(scheduled.getTime() - 5 * 60 * 1000);
        if (now >= earlyStart) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing session date:', e);
      }
    }
    return false;
  };

  // Get time until session can be started (5 min early window)
  const getTimeUntilSession = (session) => {
    if (!session.scheduled_date) return null;
    try {
      const now = new Date();
      const scheduled = new Date(session.scheduled_date);
      // Time until the 5-minute-early window opens
      const earlyStart = new Date(scheduled.getTime() - 5 * 60 * 1000);
      const diffMs = earlyStart.getTime() - now.getTime();

      if (diffMs <= 0) return null; // Early-start window has arrived

      const diffMins = Math.ceil(diffMs / 60000);
      if (diffMins < 60) {
        return `${diffMins}m`;
      }
      const diffHours = Math.floor(diffMins / 60);
      const remMins = diffMins % 60;
      return remMins > 0 ? `${diffHours}h ${remMins}m` : `${diffHours}h`;
    } catch (e) {
      console.warn('Error calculating time until session:', e);
      return null;
    }
  };

  const todaysDateString = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  }, []);

  return (
    <div className="page-container">

      {/* Schedule Section */}
      <div className="trainer-schedule-section">
        <div className="trainer-schedule-header">
          <div className="trainer-schedule-title">
            📅 Schedule - {todaysDateString}
          </div>
          <div className="trainer-schedule-controls">
            <div className="trainer-schedule-count">
              {sessions.length} total items
            </div>
            <div className="trainer-pagination-controls">
              <label
                htmlFor="pagination"
                className="trainer-pagination-label"
              >
                Show:
              </label>
              <select
                id="pagination"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="trainer-pagination-select"
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

        <div className="trainer-sessions-list">
          {loading ? (
            <div className="trainer-loading-container">
              <div className="trainer-loader"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="trainer-no-sessions">
              No sessions scheduled yet.
            </div>
          ) : (
            <>
              {sessions
                .sort(
                  (a, b) =>
                    new Date(b.scheduled_date || 0) -
                    new Date(a.scheduled_date || 0)
                )
                .slice(0, itemsPerPage)
                .map((session) => {
                  const scheduledDate = session.scheduled_date
                    ? new Date(session.scheduled_date)
                    : null;
                  const timeLabel = scheduledDate
                    ? scheduledDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    : "—";
                  const ampm = scheduledDate
                    ? scheduledDate
                      .toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                      .split(" ")[1]
                    : "";
                  const borderColor =
                    (() => {
                      const actualStatus = getSessionStatus(session);
                      if (actualStatus === "active") return "trainer-session-card-green";
                      if (actualStatus === "scheduled") return "trainer-session-card-amber";
                      if (actualStatus === "cancelled") return "trainer-session-card-red";
                      if (actualStatus === "expired") return "trainer-session-card-orange";
                      return "trainer-session-card-orange";
                    })();

                  const cardBackgroundColor =
                    (() => {
                      const actualStatus = getSessionStatus(session);
                      if (actualStatus === "cancelled") return "#fee2e2";
                      return "#ffffff";
                    })();

                  return (
                    <div
                      key={session.id || session.session_id}
                      className={`trainer-session-card ${borderColor}`}
                      style={{ backgroundColor: cardBackgroundColor }}
                    >
                      <div className="trainer-session-content">
                        <div className="trainer-session-left">
                          <div className="trainer-session-time-box">
                            <div className="trainer-session-time">
                              {timeLabel}
                            </div>
                            <div className="trainer-session-ampm">
                              {ampm}
                            </div>
                          </div>

                          <div className="trainer-session-details">
                            <div className="trainer-session-header">
                              <div className="trainer-session-title">
                                {session.title ||
                                  `Session with ${session.learner?.name ||
                                  session.learner_name ||
                                  "Learner"
                                  }`}
                              </div>
                            </div>

                            <div className="trainer-session-meta">
                              Duration: {session.duration ?? "—"} minutes{" "}
                              {session.program
                                ? ` | ILP: ${session.program}`
                                : ""}
                            </div>

                            {session.description && (
                              <div className="trainer-session-description">
                                {session.description}
                              </div>
                            )}
                            {session.scheduled_date && (
                              <div className="trainer-session-scheduled">
                                Scheduled:{" "}
                                {new Date(
                                  session.scheduled_date
                                ).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="trainer-session-actions">
                          {getSessionStatus(session) === "scheduled" && (
                            <div>
                              <button
                                onClick={() =>
                                  handleStartSession(session.session_id)
                                }
                                className="trainer-btn-start"
                                disabled={!canStartSession(session)}
                                title={!canStartSession(session) ? `Session starts in ${getTimeUntilSession(session)}` : "Click to start session"}
                              >
                                Start Session
                              </button>
                            </div>
                          )}
                          {getSessionStatus(session) === "active" && (
                            <button
                              onClick={() =>
                                handleResumeSession(session.session_id)
                              }
                              className="trainer-btn-resume"
                            >
                              Resume Session
                            </button>
                          )}
                          <span
                            className={getStatusBadge(getSessionStatus(session))}
                          >
                            {getSessionStatus(session)
                              .charAt(0)
                              .toUpperCase() +
                              getSessionStatus(session).slice(1)}
                          </span>
                          <div className="trainer-session-buttons">
                            {session.recording_url &&
                              session.recording_status === "completed" && (
                                <button
                                  onClick={() =>
                                    handleViewRecording(session)
                                  }
                                  className="trainer-btn-watch"
                                  title="Watch recording"
                                >
                                  ▶️ Watch
                                </button>
                              )}
                            {session.recording_status === "processing" && (
                              <span
                                className="trainer-recording-processing"
                                title="Recording is being processed"
                              >
                                ⏳ Processing...
                              </span>
                            )}
                            {session.recording_status === "failed" && (
                              <span
                                className="trainer-recording-failed"
                                title="Recording failed"
                              >
                                ❌ Failed
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedSession(session);
                                setShowSessionDetailsModal(true);
                              }}
                              className="trainer-btn-details"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Pagination Info */}
              {sessions.length > itemsPerPage && (
                <div className="trainer-pagination-info">
                  Showing {itemsPerPage} of {sessions.length} sessions
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
                <p className="app-modal-text">{selectedSession.title || `Session with ${selectedSession.learner?.name || selectedSession.learner_name || "Learner"}`}</p>
              </div>

              {/* Learner Info */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Learner</label>
                <p className="app-modal-text">{selectedSession.learner?.name || selectedSession.learner_name || "Unknown Learner"}</p>
              </div>

              {/* Status */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Status</label>
                <span className={getStatusBadge(getSessionStatus(selectedSession))}>{getSessionStatus(selectedSession).charAt(0).toUpperCase() + getSessionStatus(selectedSession).slice(1)}</span>
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
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Time</label>
                  <p className="app-modal-text">
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
              <div className="app-modal-form-grid app-modal-form-grid--2">
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Duration</label>
                  <p className="app-modal-text">{selectedSession.duration ? `${selectedSession.duration} minutes` : "—"}</p>
                </div>
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

              {/* Recording Status */}
              {(selectedSession.recording_url || selectedSession.recording_status) && (
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Recording Status</label>
                  <div>
                    {selectedSession.recording_status === "completed" && (
                      <span className="trainer-badge-completed">
                        ✓ Completed
                      </span>
                    )}
                    {selectedSession.recording_status === "processing" && (
                      <span className="trainer-badge-processing">
                        ⏳ Processing...
                      </span>
                    )}
                    {selectedSession.recording_status === "failed" && (
                      <span className="trainer-badge-failed">
                        ❌ Failed
                      </span>
                    )}
                    {!selectedSession.recording_status && (
                      <span className="trainer-badge-not-started">
                        Not Started
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="app-modal-info-box">
                <p className="app-modal-text" style={{ fontSize: '0.875rem' }}>
                  <strong>Scheduled:</strong> {selectedSession.scheduled_date
                    ? new Date(selectedSession.scheduled_date).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="app-modal-footer">
              <button
                onClick={closeSessionDetailsModal}
                className="app-modal-btn app-modal-btn--secondary"
              >
                Close
              </button>
              {getSessionStatus(selectedSession) === "scheduled" && (
                <button
                  onClick={() => {
                    closeSessionDetailsModal();
                    handleStartSession(selectedSession.session_id || selectedSession.id);
                  }}
                  className="app-modal-btn app-modal-btn--success"
                >
                  Start Session
                </button>
              )}
              {getSessionStatus(selectedSession) === "active" && (
                <button
                  onClick={() => {
                    closeSessionDetailsModal();
                    handleResumeSession(selectedSession.session_id || selectedSession.id);
                  }}
                  className="app-modal-btn app-modal-btn--primary"
                >
                  Resume Session
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TodaysSchedule;
