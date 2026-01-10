import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";
import { Calendar, MessageSquare, ShoppingCart, GraduationCap, User } from 'lucide-react';
import '../../styles/admin/index.css';

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
  const [_loadingExtras, setLoadingExtras] = useState(true);
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

  const menuItems = [
    {
      id: '1',
      title: 'IIP Programs',
      description: "View today's schedule and manage sessions",
      icon: GraduationCap,
      onClick: () => navigate('/trainer/schedule')
    },
    {
      id: '2',
      title: 'Communication',
      description: 'Send messages and communicate with team',
      icon: MessageSquare,
      onClick: () => navigate('/trainer/communication')
    },
    {
      id: '3',
      title: 'Book Appointment',
      description: 'Schedule appointments with coaches',
      icon: Calendar,
      onClick: () => navigate('/book-appointment')
    },
    {
      id: '4',
      title: 'Buy Learning Material',
      description: 'Browse and purchase learning resources',
      icon: ShoppingCart,
      onClick: () => navigate('/store')
    },
    {
      id: '5',
      title: 'Profile & Order History',
      description: 'View your profile and manage orders',
      icon: User,
      onClick: () => navigate('/trainer/profile-order-history')
    },
  ];

  return (
    <div className="admin-dashboard-container">
      <Navbar />
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Trainer Dashboard
            </h1>
            <div className="admin-dashboard-welcome">
              Welcome, <span className="admin-dashboard-welcome-name">{user?.name || "Trainer"}</span>!
            </div>
          </div>

          {/* Quick Stats */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-value admin-stat-value-blue">
                {stats.totalSessions ?? 0}
              </div>
              <div className="admin-stat-label">Total Sessions</div>
              <div className="admin-stat-sublabel">
                This Month: {stats.thisMonthSessions ?? 0}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value admin-stat-value-green">
                {stats.activeLearners ?? 0}
              </div>
              <div className="admin-stat-label">Active Learners</div>
              <div className="admin-stat-sublabel">Assigned to you</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value admin-stat-value-purple">
                {stats.totalHours ?? 0}
              </div>
              <div className="admin-stat-label">Total Hours</div>
              <div className="admin-stat-sublabel">This Month</div>
            </div>
          </div>

          {/* Trainer Menu */}
          <div className="admin-dashboard-menu">
            <div className="admin-menu-title">
              <h2>Trainer Menu - Click to Open</h2>
            </div>

            <div className="admin-menu-grid">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className="admin-menu-card"
                  >
                    <div className="admin-menu-card-icon">
                      <IconComponent size={48} />
                    </div>
                    <h3 className="admin-menu-card-title">
                      {item.title}
                    </h3>
                    <p className="admin-menu-card-description">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TrainerDashboard;
