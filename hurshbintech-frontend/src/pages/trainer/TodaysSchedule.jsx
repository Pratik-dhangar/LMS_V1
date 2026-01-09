import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";
import '../../styles/admin/index.css';
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
    };
    return `${base} ${map[status] || "trainer-status-ended"}`;
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
    <div className="admin-dashboard-container">
      <Navbar />
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Today's Schedule
            </h1>
            <div className="admin-dashboard-welcome">
              Welcome, <span className="admin-dashboard-welcome-name">{user?.name || "Trainer"}</span>!
            </div>
          </div>

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
                        session.status === "active"
                          ? "trainer-session-card-green"
                          : session.status === "scheduled"
                            ? "trainer-session-card-amber"
                            : "trainer-session-card-orange";
                      return (
                        <div
                          key={session.id || session.session_id}
                          className={`trainer-session-card ${borderColor}`}
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
                                  <span
                                    className={getStatusBadge(session.status)}
                                  >
                                    {(session.status || "scheduled")
                                      .charAt(0)
                                      .toUpperCase() +
                                      (session.status || "scheduled").slice(1)}
                                  </span>
                                </div>

                                <div className="trainer-session-meta">
                                  Duration: {session.duration ?? "—"} minutes{" "}
                                  {session.program
                                    ? ` | IIP: ${session.program}`
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
                              {session.status === "scheduled" && (
                                <button
                                  onClick={() =>
                                    handleStartSession(session.session_id)
                                  }
                                  className="trainer-btn-start"
                                >
                                  Start Session
                                </button>
                              )}
                              {session.status === "active" && (
                                <button
                                  onClick={() =>
                                    handleResumeSession(session.session_id)
                                  }
                                  className="trainer-btn-resume"
                                >
                                  Resume Session
                                </button>
                              )}
                              {session.status === "ended" && (
                                <span className="trainer-session-completed">
                                  Completed
                                </span>
                              )}

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
        </div>
      </main>

      {/* Session Details Modal */}
      {showSessionDetailsModal && selectedSession && (
        <div className="trainer-modal-overlay" onClick={closeSessionDetailsModal}>
          <div className="trainer-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="trainer-modal-header">
              <h2 className="trainer-modal-title">Session Details</h2>
              <button
                onClick={closeSessionDetailsModal}
                className="trainer-modal-close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="trainer-modal-body">
              {/* Title */}
              <div className="trainer-modal-field">
                <label className="trainer-modal-label">Session Title</label>
                <p className="trainer-modal-text">{selectedSession.title || `Session with ${selectedSession.learner?.name || selectedSession.learner_name || "Learner"}`}</p>
              </div>

              {/* Learner Info */}
              <div className="trainer-modal-field">
                <label className="trainer-modal-label">Learner</label>
                <p className="trainer-modal-text-normal">{selectedSession.learner?.name || selectedSession.learner_name || "Unknown Learner"}</p>
              </div>

              {/* Status */}
              <div className="trainer-modal-field">
                <label className="trainer-modal-label">Status</label>
                <span className={getStatusBadge(selectedSession.status)}>{(selectedSession.status || "scheduled").charAt(0).toUpperCase() + (selectedSession.status || "scheduled").slice(1)}</span>
              </div>

              {/* Date & Time */}
              <div className="trainer-modal-grid">
                <div>
                  <label className="trainer-modal-label">Date</label>
                  <p className="trainer-modal-text-normal">
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
                  <label className="trainer-modal-label">Time</label>
                  <p className="trainer-modal-text-normal">
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
              <div className="trainer-modal-grid">
                <div>
                  <label className="trainer-modal-label">Duration</label>
                  <p className="trainer-modal-text-normal">{selectedSession.duration ? `${selectedSession.duration} minutes` : "—"}</p>
                </div>
                <div>
                  <label className="trainer-modal-label">Program / IIP</label>
                  <p className="trainer-modal-text-normal">
                    {selectedSession.learning_goals && selectedSession.learning_goals.length > 0
                      ? selectedSession.learning_goals.map(goal => goal.goal).join(", ")
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedSession.description && (
                <div className="trainer-modal-field">
                  <label className="trainer-modal-label">Description</label>
                  <p className="trainer-modal-description">{selectedSession.description}</p>
                </div>
              )}

              {/* Recording Status */}
              {(selectedSession.recording_url || selectedSession.recording_status) && (
                <div className="trainer-modal-field">
                  <label className="trainer-modal-label">Recording Status</label>
                  <div className="trainer-modal-recording-status">
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
              <div className="trainer-modal-info-box">
                <p className="trainer-modal-info-text">
                  <strong>Scheduled:</strong> {selectedSession.scheduled_date
                    ? new Date(selectedSession.scheduled_date).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="trainer-modal-footer">
              <button
                onClick={closeSessionDetailsModal}
                className="trainer-modal-btn-close"
              >
                Close
              </button>
              {selectedSession.status === "scheduled" && (
                <button
                  onClick={() => {
                    closeSessionDetailsModal();
                    handleStartSession(selectedSession.session_id || selectedSession.id);
                  }}
                  className="trainer-modal-btn-start"
                >
                  Start Session
                </button>
              )}
              {selectedSession.status === "active" && (
                <button
                  onClick={() => {
                    closeSessionDetailsModal();
                    handleResumeSession(selectedSession.session_id || selectedSession.id);
                  }}
                  className="trainer-modal-btn-resume"
                >
                  Resume Session
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default TodaysSchedule;
