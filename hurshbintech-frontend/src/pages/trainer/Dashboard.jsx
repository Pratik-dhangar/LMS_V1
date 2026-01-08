import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";

const TrainerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Main data states
  const [sessions, setSessions] = useState([]);
  const [learners, setLearners] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeLearners: 0,
    totalHours: 0,
    thisMonthSessions: 0,
  });
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [_loadingExtras, setLoadingExtras] = useState(true);
  const scheduleRef = useRef(null);
  const [learnerQuery, setLearnerQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh sessions every 30 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log('[TrainerDashboard] Auto-refreshing sessions...');
      fetchSessions();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setLoadingExtras(true);
    await Promise.all([fetchSessions(), fetchExtras()]);
    setLoading(false);
    setLoadingExtras(false);
  };

  const fetchSessions = async () => {
    try {
      const data = await sessionService.getTrainerSessions();
      // normalize to array
      setSessions(Array.isArray(data) ? data : []);
      // Basic fallback stats derivation if API doesn't provide stats:
      const totalSessions = Array.isArray(data) ? data.length : 0;
      const totalMinutes = Array.isArray(data)
        ? data.reduce((acc, s) => acc + (Number(s.duration) || 0), 0)
        : 0;
      const uniqueLearners = new Set(
        (data || [])
          .map((s) =>
            s.learner?.id ? s.learner.id : s.learner_name || s.learner?.name
          )
          .filter(Boolean)
      );
      setStats((prev) => ({
        ...prev,
        totalSessions,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        activeLearners: uniqueLearners.size,
      }));
      // If learners not already fetched, build a short list from sessions:
      if (!learners || learners.length === 0) {
        const derived = (data || [])
          .map((s) => {
            const l = s.learner || {};
            return {
              id: l.id || s.learner_name || `${s.learner?.name}-${s.id}`,
              name: l.name || s.learner_name || "Unknown",
              age: l.age || null,
              current_program: l.current_program || s.program || "",
              sessions_completed: l.sessions_completed || 0,
              next_session_time: s.scheduled_date || null,
            };
          })
          // dedupe by id
          .reduce((acc, curr) => {
            if (!acc.find((x) => x.id === curr.id)) acc.push(curr);
            return acc;
          }, []);
        setLearners(derived);
      }
    } catch (error) {
      console.error("fetchSessions error:", error);
      setSessions([]);
    }
  };

  const fetchExtras = async () => {
    // Try optional endpoints, otherwise fall back to placeholders
    try {
      if (typeof sessionService.getTrainerStats === "function") {
        const s = await sessionService.getTrainerStats();
        setStats((prev) => ({ ...prev, ...s }));
      }
    } catch {
      console.debug("No trainerStats endpoint or failed - using derived stats");
    }

    try {
      if (typeof sessionService.getTrainerLearners === "function") {
        const l = await sessionService.getTrainerLearners();
        setLearners(Array.isArray(l) ? l : []);
      }
    } catch {
      console.debug(
        "No getTrainerLearners endpoint or failed - using derived learners"
      );
    }

    try {
      if (typeof sessionService.getTrainerMessages === "function") {
        const m = await sessionService.getTrainerMessages();
        setMessages(Array.isArray(m) ? m : []);
      } else {
        // fallback: small placeholder from sessions
        setMessages((prev) =>
          prev.length
            ? prev
            : [
              {
                id: "1",
                from: "Head",
                title: "Updated IIP for John Doe",
                time: "2 hours ago",
                body: "Please review before today's session.",
              },
            ]
        );
      }
    } catch {
      console.debug(
        "No getTrainerMessages endpoint or failed - using fallback messages"
      );
    }

    try {
      if (typeof sessionService.getTrainerNotifications === "function") {
        const n = await sessionService.getTrainerNotifications();
        setNotifications(Array.isArray(n) ? n : []);
      } else {
        setNotifications((prev) =>
          prev.length
            ? prev
            : [
              {
                id: "n1",
                type: "reminder",
                title: "Session Reminder",
                body: "Session with John Doe starts in 2 hours (10:00 AM)",
              },
              {
                id: "n2",
                type: "content",
                title: "New Learning Content",
                body: "3 new activities added to Social Skills library",
              },
              {
                id: "n3",
                type: "update",
                title: "Platform Update",
                body: "New features available in whiteboard toolbar",
              },
            ]
        );
      }
    } catch {
      console.debug(
        "No getTrainerNotifications endpoint or failed - using fallback notifications"
      );
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

    // Check recording status
    if (session.recording_status === "processing") {
      toast.info("Recording is still being processed. Please try again later.");
      return;
    }

    if (session.recording_status === "failed") {
      toast.error("Recording failed to process");
      return;
    }

    try {
      // Fetch playback URL from backend
      const response = await sessionService.getRecordingUrl(session.id);

      if (response.playback_url) {
        // Open recording in new tab
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

  const handleViewSessionDetails = (session) => {
    setSelectedSession(session);
    setShowSessionDetailsModal(true);
  };

  const closeSessionDetailsModal = () => {
    setShowSessionDetailsModal(false);
    setSelectedSession(null);
  };

  const getStatusBadge = (status) => {
    const base = "px-3 py-1 rounded-full text-xs font-semibold";
    const map = {
      scheduled: "bg-amber-100 text-amber-800",
      active: "bg-green-100 text-green-800",
      ended: "bg-gray-100 text-gray-800",
    };
    return `${base} ${map[status] || "bg-gray-100 text-gray-800"}`;
  };

  const todaysDateString = useMemo(() => {
    const d = new Date();
    // e.g. October 03, 2025
    return d.toLocaleDateString(undefined, {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  }, []);

  const filteredLearners = useMemo(() => {
    if (!learnerQuery) return learners;
    return learners.filter((l) =>
      l.name?.toLowerCase().includes(learnerQuery.toLowerCase())
    );
  }, [learners, learnerQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Page Header */}
          <h1 className="text-3xl font-bold text-amber-800 border-b-4 border-amber-600 pb-2 mb-6">
            HurshBin Trainer Dashboard
          </h1>

          {/* Welcome Banner */}
          <div className="text-center p-10 rounded-xl text-white mb-8 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 shadow-md">
            <h2 className="text-2xl font-semibold mb-2">
              Welcome, {user?.name || "Trainer"}!
            </h2>
            <p className="text-white/90">Ready to guide and inspire your learners</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 shadow">
              <div className="text-3xl font-bold text-amber-600">
                {stats.totalSessions ?? 0}
              </div>
              <div className="text-gray-500 mt-2">Total Sessions</div>
              <div className="text-xs text-gray-400 mt-1">
                This Month: {stats.thisMonthSessions ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow">
              <div className="text-3xl font-bold text-orange-600">
                {stats.activeLearners ?? 0}
              </div>
              <div className="text-gray-500 mt-2">Active Learners</div>
              <div className="text-xs text-gray-400 mt-1">Assigned to you</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow">
              <div className="text-3xl font-bold text-amber-500">
                {stats.totalHours ?? 0}
              </div>
              <div className="text-gray-500 mt-2">Total Hours</div>
              <div className="text-xs text-gray-400 mt-1">This Month</div>
            </div>
          </div>

          {/* Quick Access Cards (IIP / Communication / Book Appointment) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {[
              {
                icon: "🎓",
                title: "IIP Programs",
                onClick: () => {
                  // toggle the schedule section
                  setShowSchedule((s) => {
                    const next = !s;
                    // if opening, scroll into view after state change
                    if (next) setTimeout(() => scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                    return next;
                  });
                },
              },
              {
                icon: "💬",
                title: "Communication",
                onClick: () => navigate("/trainer/communication"),
              },
              {
                icon: "📅",
                title: "Book Appointment",
                onClick: () => navigate("/book-appointment"),
              },
              {
                icon: "🛒",
                title: "Buy Learning Material",
                onClick: () => navigate("/store"),
              },
            ].map((card, index) => (
              <div
                key={index}
                onClick={card.onClick}
                className="relative bg-white rounded-2xl p-8 text-center cursor-pointer transition-all duration-500 ease-out transform group shadow-md hover:-translate-y-3 hover:scale-[1.05] hover:shadow-2xl hover:border-amber-500 hover:border-2"
              >
                <div className="text-5xl mb-4 transition-transform duration-500 group-hover:scale-110">
                  {card.icon}
                </div>
                <div className="text-lg font-semibold text-gray-800 mb-1">{card.title}</div>
              </div>
            ))}
          </div>

          {/* Today's Schedule */}
          {showSchedule && (
            <div ref={scheduleRef} className="bg-white rounded-xl p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">
                  📅 Today's Schedule - {todaysDateString}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    {sessions.length} total items
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="pagination"
                      className="text-sm text-gray-600 font-medium"
                    >
                      Show:
                    </label>
                    <select
                      id="pagination"
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer hover:border-gray-400"
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

              <div className="space-y-3">
                {loading ? (
                  <div className="py-8 flex justify-center">
                    <div className="loader h-8 w-8 border-4 border-t-4 rounded-full animate-spin border-gray-300"></div>
                  </div>
                ) : // Filter sessions to those scheduled for today first, then show others
                  sessions.length === 0 ? (
                    <div className="text-center text-gray-500 py-6">
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
                              ? "border-l-4 border-green-500"
                              : session.status === "scheduled"
                                ? "border-l-4 border-amber-500"
                                : "border-l-4 border-orange-400";
                          return (
                            <div
                              key={session.id || session.session_id}
                              className={`bg-white p-4 rounded-md shadow-sm ${borderColor}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 flex items-center gap-4">
                                  <div className="min-w-[80px] text-center p-2 bg-gray-100 rounded">
                                    <div className="text-xl font-bold text-[#2c3e50]">
                                      {timeLabel}
                                    </div>
                                    {/* show AM/PM if available */}
                                    <div className="text-xs text-gray-500">
                                      {ampm}
                                    </div>
                                  </div>

                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <div className="text-lg font-semibold text-gray-800">
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

                                    <div className="text-sm text-gray-500 mt-1">
                                      Duration: {session.duration ?? "—"} minutes{" "}
                                      {session.program
                                        ? ` | IIP: ${session.program}`
                                        : ""}
                                    </div>

                                    {session.description && (
                                      <div className="text-xs text-gray-600 mt-2">
                                        {session.description}
                                      </div>
                                    )}
                                    {session.scheduled_date && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Scheduled:{" "}
                                        {new Date(
                                          session.scheduled_date
                                        ).toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                  {session.status === "scheduled" && (
                                    <button
                                      onClick={() =>
                                        handleStartSession(session.session_id)
                                      }
                                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                                    >
                                      Start Session
                                    </button>
                                  )}
                                  {session.status === "active" && (
                                    <button
                                      onClick={() =>
                                        handleResumeSession(session.session_id)
                                      }
                                      className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-orange-600 text-sm font-medium shadow-md"
                                    >
                                      Resume Session
                                    </button>
                                  )}
                                  {session.status === "ended" && (
                                    <span className="text-gray-500 text-sm">
                                      Completed
                                    </span>
                                  )}

                                  <div className="flex gap-2 mt-2">
                                    {session.recording_url &&
                                      session.recording_status === "completed" && (
                                        <button
                                          onClick={() =>
                                            handleViewRecording(session)
                                          }
                                          className="text-sm px-3 py-1 border rounded text-amber-600 hover:bg-amber-50 border-amber-300"
                                          title="Watch recording"
                                        >
                                          ▶️ Watch
                                        </button>
                                      )}
                                    {session.recording_status === "processing" && (
                                      <span
                                        className="text-sm px-3 py-1 text-yellow-600"
                                        title="Recording is being processed"
                                      >
                                        ⏳ Processing...
                                      </span>
                                    )}
                                    {session.recording_status === "failed" && (
                                      <span
                                        className="text-sm px-3 py-1 text-red-600"
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
                                      className="text-sm px-3 py-1 border rounded text-gray-700 hover:bg-gray-50"
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
                        <div className="text-sm text-gray-500 pt-4 border-t text-center">
                          Showing {itemsPerPage} of {sessions.length} sessions
                        </div>
                      )}
                    </>
                  )}
              </div>
            </div>

          )}
        </div>
      </main>

      {/* Session Details Modal */}
      {showSessionDetailsModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeSessionDetailsModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Session Details</h2>
              <button
                onClick={closeSessionDetailsModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-2">Session Title</label>
                <p className="text-lg text-gray-800">{selectedSession.title || `Session with ${selectedSession.learner?.name || selectedSession.learner_name || "Learner"}`}</p>
              </div>

              {/* Learner Info */}
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-2">Learner</label>
                <p className="text-gray-800">{selectedSession.learner?.name || selectedSession.learner_name || "Unknown Learner"}</p>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-2">Status</label>
                <span className={getStatusBadge(selectedSession.status)}>{(selectedSession.status || "scheduled").charAt(0).toUpperCase() + (selectedSession.status || "scheduled").slice(1)}</span>
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

              {/* Recording Status */}
              {(selectedSession.recording_url || selectedSession.recording_status) && (
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Recording Status</label>
                  {selectedSession.recording_status === "completed" && (
                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      ✓ Completed
                    </span>
                  )}
                  {selectedSession.recording_status === "processing" && (
                    <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      ⏳ Processing...
                    </span>
                  )}
                  {selectedSession.recording_status === "failed" && (
                    <span className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                      ❌ Failed
                    </span>
                  )}
                  {!selectedSession.recording_status && (
                    <span className="inline-block bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                      Not Started
                    </span>
                  )}
                </div>
              )}

              {/* Additional Info */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Scheduled:</strong> {selectedSession.scheduled_date
                    ? new Date(selectedSession.scheduled_date).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={closeSessionDetailsModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Close
              </button>
              {selectedSession.status === "scheduled" && (
                <button
                  onClick={() => {
                    closeSessionDetailsModal();
                    handleStartSession(selectedSession.session_id || selectedSession.id);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
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
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-medium transition-colors shadow-md"
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

/* ----------------------
   small helpers
   ---------------------- */
function getInitials(name = "") {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarColorClass(name = "") {
  // deterministic color pick by name hash
  const colors = [
    "bg-amber-500",
    "bg-orange-600",
    "bg-amber-600",
    "bg-orange-500",
    "bg-amber-400",
    "bg-orange-400",
  ];
  const n = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[n % colors.length];
}

export default TrainerDashboard;
