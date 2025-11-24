import React, { useState, useEffect, useMemo } from "react";
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
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [learnerQuery, setLearnerQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    fetchAll();
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
          .map((s) => (s.learner?.id ? s.learner.id : s.learner_name || s.learner?.name))
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
      toast.error("Failed to load sessions");
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
    } catch (err) {
      console.debug("No trainerStats endpoint or failed - using derived stats");
    }

    try {
      if (typeof sessionService.getTrainerLearners === "function") {
        const l = await sessionService.getTrainerLearners();
        setLearners(Array.isArray(l) ? l : []);
      }
    } catch (err) {
      console.debug("No getTrainerLearners endpoint or failed - using derived learners");
    }

    try {
      if (typeof sessionService.getTrainerMessages === "function") {
        const m = await sessionService.getTrainerMessages();
        setMessages(Array.isArray(m) ? m : []);
      } else {
        // fallback: small placeholder from sessions
        setMessages((prev) =>
          prev.length ? prev : [
            { id: "1", from: "Head", title: "Updated IIP for John Doe", time: "2 hours ago", body: "Please review before today's session." }
          ]
        );
      }
    } catch (err) {
      console.debug("No getTrainerMessages endpoint or failed - using fallback messages");
    }

    try {
      if (typeof sessionService.getTrainerNotifications === "function") {
        const n = await sessionService.getTrainerNotifications();
        setNotifications(Array.isArray(n) ? n : []);
      } else {
        setNotifications((prev) =>
          prev.length ? prev : [
            { id: "n1", type: "reminder", title: "Session Reminder", body: "Session with John Doe starts in 2 hours (10:00 AM)" },
            { id: "n2", type: "content", title: "New Learning Content", body: "3 new activities added to Social Skills library" },
            { id: "n3", type: "update", title: "Platform Update", body: "New features available in whiteboard toolbar" },
          ]
        );
      }
    } catch (err) {
      console.debug("No getTrainerNotifications endpoint or failed - using fallback notifications");
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

  const handleViewRecording = (recordingUrl) => {
    if (!recordingUrl) {
      toast.info("Recording not available");
      return;
    }
    // open recording in new tab
    window.open(recordingUrl, "_blank");
  };

  const getStatusBadge = (status) => {
    const base = "px-3 py-1 rounded-full text-xs font-semibold";
    const map = {
      scheduled: "bg-blue-100 text-blue-800",
      active: "bg-green-100 text-green-800",
      ended: "bg-gray-100 text-gray-800",
    };
    return `${base} ${map[status] || "bg-gray-100 text-gray-800"}`;
  };

  const todaysDateString = useMemo(() => {
    const d = new Date();
    // e.g. October 03, 2025
    return d.toLocaleDateString(undefined, { month: "long", day: "2-digit", year: "numeric" });
  }, []);

  const filteredLearners = useMemo(() => {
    if (!learnerQuery) return learners;
    return learners.filter((l) => l.name?.toLowerCase().includes(learnerQuery.toLowerCase()));
  }, [learners, learnerQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Header / Welcome */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-[#2c3e50] text-2xl font-bold">HurshBin Trainer Dashboard</h1>
            <div className="text-sm text-gray-600">Welcome back, <span className="font-semibold">{user?.name || "Trainer"}</span></div>
          </div>

          {/* Hero Welcome */}
          <div className="rounded-xl p-8 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white shadow-md">
            <h2 className="text-2xl font-semibold mb-2">Welcome, {user?.name || "Trainer"}!</h2>
            <p className="text-sm">Ready to make a difference today?</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 shadow">
              <div className="text-3xl font-bold text-[#3498db]">{stats.totalSessions ?? 0}</div>
              <div className="text-gray-500 mt-2">Total Sessions</div>
              <div className="text-xs text-gray-400 mt-1">This Month: {stats.thisMonthSessions ?? 0}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow">
              <div className="text-3xl font-bold text-[#27ae60]">{stats.activeLearners ?? 0}</div>
              <div className="text-gray-500 mt-2">Active Learners</div>
              <div className="text-xs text-gray-400 mt-1">Assigned to you</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow">
              <div className="text-3xl font-bold text-[#e74c3c]">{stats.totalHours ?? 0}</div>
              <div className="text-gray-500 mt-2">Total Hours</div>
              <div className="text-xs text-gray-400 mt-1">This Month</div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="bg-white rounded-xl p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">📅 Today's Schedule - {todaysDateString}</div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">{sessions.length} total items</div>
                <div className="flex items-center gap-2">
                  <label htmlFor="pagination" className="text-sm text-gray-600 font-medium">Show:</label>
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
              ) : (
                // Filter sessions to those scheduled for today first, then show others
                (sessions.length === 0) ? (
                  <div className="text-center text-gray-500 py-6">No sessions scheduled yet.</div>
                ) : (
                  <>
                    {sessions
                      .sort((a, b) => new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0))
                      .slice(0, itemsPerPage)
                      .map((session) => {
                        const scheduledDate = session.scheduled_date ? new Date(session.scheduled_date) : null;
                        const timeLabel = scheduledDate ? scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
                        const ampm = scheduledDate ? scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).split(" ")[1] : "";
                        const borderColor =
                          session.status === "active" ? "border-l-4 border-green-500" :
                            session.status === "scheduled" ? "border-l-4 border-blue-500" : "border-l-4 border-yellow-400";
                        return (
                          <div key={session.id || session.session_id} className={`bg-white p-4 rounded-md shadow-sm ${borderColor}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 flex items-center gap-4">
                                <div className="min-w-[80px] text-center p-2 bg-gray-100 rounded">
                                  <div className="text-xl font-bold text-[#2c3e50]">{timeLabel}</div>
                                  {/* show AM/PM if available */}
                                  <div className="text-xs text-gray-500">{ampm}</div>
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <div className="text-lg font-semibold text-gray-800">{session.title || `Session with ${session.learner?.name || session.learner_name || "Learner"}`}</div>
                                    <span className={getStatusBadge(session.status)}>{(session.status || "scheduled").charAt(0).toUpperCase() + (session.status || "scheduled").slice(1)}</span>
                                  </div>

                                  <div className="text-sm text-gray-500 mt-1">
                                    Duration: {session.duration ?? "—"} minutes {session.program ? ` | IIP: ${session.program}` : ""}
                                  </div>

                                  {session.description && <div className="text-xs text-gray-600 mt-2">{session.description}</div>}
                                  {session.scheduled_date && <div className="text-xs text-gray-500 mt-1">Scheduled: {new Date(session.scheduled_date).toLocaleString()}</div>}
                                </div>
                              </div>

                              <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                {session.status === "scheduled" && (
                                  <button
                                    onClick={() => handleStartSession(session.session_id)}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                                  >
                                    Start Session
                                  </button>
                                )}
                                {session.status === "active" && (
                                  <button
                                    onClick={() => handleResumeSession(session.session_id)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                                  >
                                    Resume Session
                                  </button>
                                )}
                                {session.status === "ended" && (
                                  <span className="text-gray-500 text-sm">Completed</span>
                                )}

                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleViewRecording(session.recording_url)}
                                    className="text-sm px-3 py-1 border rounded text-blue-600 hover:bg-blue-50"
                                  >
                                    ▶️ Watch
                                  </button>
                                  <button
                                    onClick={() => navigate(`/trainer/session/${session.session_id || session.id}`)}
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
                )
              )}
            </div>
          </div>

          {/* My Learners */}
          <div className="bg-white rounded-xl p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">👥 My Learners ({learners.length})</div>
              <div className="flex items-center gap-3">
                <input
                  value={learnerQuery}
                  onChange={(e) => setLearnerQuery(e.target.value)}
                  className="px-3 py-2 border rounded w-64 text-sm"
                  placeholder="🔍 Search learner..."
                />
                <button onClick={() => setLearnerQuery("")} className="px-3 py-2 bg-gray-100 rounded text-sm">Reset</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredLearners.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-8">No learners found.</div>
              )}
              {filteredLearners.slice(0, 9).map((l) => (
                <div key={l.id} className="bg-white border rounded p-4 shadow-sm">
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold ${getAvatarColorClass(l.name)}`}>
                      {getInitials(l.name)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{l.name}</div>
                      <div className="text-xs text-gray-500">Age: {l.age ?? "—"}</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mb-2"><strong>Current Program:</strong> {l.current_program || "—"}</div>
                  <div className="text-xs text-gray-600 mb-2"><strong>Sessions:</strong> {l.sessions_completed ?? 0} completed</div>
                  <div className="text-xs text-green-600 mb-3"><strong>Next Session:</strong> {l.next_session_time ? new Date(l.next_session_time).toLocaleString() : "—"}</div>

                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/trainer/learner/${l.id}`)} className="flex-1 px-3 py-2 border rounded text-sm">View Profile</button>
                    <button onClick={() => {
                      // attempt to find upcoming session for this learner and start it
                      const upcoming = sessions.find(s => (s.learner?.id === l.id || s.learner_name === l.name) && s.status === "scheduled");
                      if (upcoming) handleStartSession(upcoming.session_id || upcoming.id);
                      else toast.info("No scheduled session found for this learner.");
                    }} className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm">Start Session</button>
                  </div>
                </div>
              ))}

              {/* view all card if more */}
              {filteredLearners.length > 9 && (
                <div className="border-2 border-dashed border-gray-300 rounded p-6 flex items-center justify-center cursor-pointer">
                  <div className="text-center text-gray-600">
                    <div className="font-semibold">View All Learners</div>
                    <div className="text-sm mt-1">{filteredLearners.length - 9} more learners →</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Session History */}
          <div className="bg-white rounded-xl p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">📝 Recent Session History</div>
              <button onClick={() => navigate("/trainer/sessions")} className="px-3 py-2 bg-gray-100 rounded text-sm">View All Sessions</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-600">
                    <th className="py-2 pr-4">Date & Time</th>
                    <th className="py-2 pr-4">Learner</th>
                    <th className="py-2 pr-4">Program</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Notes</th>
                    <th className="py-2 pr-4">Recording</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 6).map((s) => (
                    <tr key={s.id || s.session_id} className="border-t">
                      <td className="py-3 pr-4">
                        {s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString() : "—"}
                        <div className="text-xs text-gray-400">{s.scheduled_date ? new Date(s.scheduled_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                      </td>
                      <td className="py-3 pr-4">{s.learner?.name || s.learner_name || "—"}</td>
                      <td className="py-3 pr-4">{s.program || "—"}</td>
                      <td className="py-3 pr-4">{s.duration ? `${s.duration} min` : "—"}</td>
                      {/* <td>{l.name}</td> */}
                      <td className="py-3 pr-4">
                        <button onClick={() => navigate(`/trainer/session/${s.session_id || s.id}/notes`)} className="text-sm text-blue-600">📝 View</button>
                      </td>
                      <td className="py-3 pr-4">
                        <button onClick={() => handleViewRecording(s.recording_url)} className="text-sm text-blue-600">▶️ Watch</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Messages & Notifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">💬 Recent Messages ({messages.length})</div>
                <button onClick={() => navigate("/trainer/messages")} className="px-3 py-2 bg-gray-100 rounded text-sm">View All Messages</button>
              </div>

              <div className="space-y-4">
                {messages.slice(0, 5).map((m, idx) => (
                  <div key={m.id || idx} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <strong>{m.from || m.title || "Unknown"}</strong>
                      <span className="text-xs text-gray-400">{m.time || m.when || ""}</span>
                    </div>
                    <div className="text-xs text-gray-600">{m.body || m.summary || ""}</div>
                  </div>
                ))}
              </div>

            </div>

            <div className="bg-white rounded-xl p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">🔔 Notifications ({notifications.length})</div>
                <button onClick={() => navigate("/trainer/notifications")} className="px-3 py-2 bg-gray-100 rounded text-sm">View All</button>
              </div>

              <div className="space-y-3">
                {notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className={`p-3 rounded ${n.type === "reminder" ? "bg-yellow-50 border-l-4 border-yellow-400" : n.type === "content" ? "bg-green-50 border-l-4 border-green-400" : "bg-cyan-50 border-l-4 border-cyan-400"}`}>
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="text-xs text-gray-700 mt-1">{n.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions & Content Library */}
          <div className="bg-white rounded-xl p-6 shadow space-y-4">
            <div className="text-lg font-semibold">⚡ Quick Actions</div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <button onClick={() => navigate("/trainer/session/create")} className="py-4 rounded-lg bg-green-600 text-white text-sm">🎓 Start New Session</button>
              <button onClick={() => navigate("/content")} className="py-4 rounded-lg border text-sm">📚 Browse Learning Content</button>
              <button onClick={() => navigate("/trainer/schedule")} className="py-4 rounded-lg border text-sm">📅 View Full Schedule</button>
              <button onClick={() => navigate("/trainer/messages/compose")} className="py-4 rounded-lg border text-sm">💬 Send Message</button>
              <button onClick={() => navigate("/trainer/reports")} className="py-4 rounded-lg border text-sm">📊 View Reports</button>
              <button onClick={() => navigate("/training-videos")} className="py-4 rounded-lg border text-sm">🎥 Watch Training Videos</button>
            </div>

            <div className="text-lg font-semibold mt-4">📚 Learning Content Library</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: "images", title: "Images", count: 245, icon: "🖼️" },
                { key: "videos", title: "Videos", count: 128, icon: "🎥" },
                { key: "activities", title: "Activities", count: 189, icon: "🎮" },
                { key: "text", title: "Text Content", count: 167, icon: "📝" },
                { key: "interactive", title: "Interactive", count: 95, icon: "🎨" },
              ].map((c) => (
                <div key={c.key} className="bg-white border rounded p-4 cursor-pointer shadow-sm">
                  <div className="bg-gray-100 h-24 rounded flex items-center justify-center text-4xl mb-3">{c.icon}</div>
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-gray-400">{c.count} items</div>
                </div>
              ))}
              <div className="border-2 border-dashed border-gray-300 rounded p-6 flex items-center justify-center cursor-pointer">
                <div className="text-center text-gray-600">
                  <div className="font-semibold">Browse All</div>
                  <div className="text-sm mt-1">824 total items</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
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
    "bg-[#3498db]",
    "bg-[#e74c3c]",
    "bg-[#27ae60]",
    "bg-[#9b59b6]",
    "bg-[#f39c12]",
    "bg-[#1abc9c]",
  ];
  const n = name
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[n % colors.length];
}

export default TrainerDashboard;
