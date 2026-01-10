import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";
import orderService from "../../api/services/ecommerce/orderService";

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

  // Order History state
  const [showProfile, setShowProfile] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [orderStatusFilter, setOrderStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'delivered', 'rejected'
  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const profileRef = useRef(null);

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

  const fetchOrderHistory = async () => {
    try {
      setLoadingOrders(true);
      // Fetch all orders (including delivered and rejected)
      const response = await orderService.getOrders();
      console.log("🛍️ Order History Response:", response);

      // Handle both direct array and paginated response
      const orders = Array.isArray(response) ? response : (response.orders || []);
      setOrderHistory(orders);
      console.log(`✅ Fetched ${orders.length} orders`);
    } catch (error) {
      console.error("❌ Error fetching order history:", error);
      setOrderHistory([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload JPG, PNG, or PDF file');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should not exceed 5MB');
        return;
      }
      setReceiptFile(file);
      toast.success('Receipt selected: ' + file.name);
    }
  };

  const handleReuploadReceipt = async () => {
    if (!receiptFile || !selectedOrderDetails) {
      toast.error('Please select a receipt file');
      return;
    }

    // Get the actual order UUID from various possible fields
    const orderId = selectedOrderDetails.id || selectedOrderDetails.uuid || selectedOrderDetails.order_id;
    if (!orderId) {
      toast.error('Order ID not found. Please try again.');
      return;
    }

    try {
      setUploading(true);
      await orderService.uploadReceipt(orderId, receiptFile);
      toast.success('Receipt uploaded successfully! Admin will verify the payment.');
      setShowReuploadModal(false);
      setReceiptFile(null);
      setShowOrderDetailsModal(false);
      // Reload orders to show updated status
      fetchOrderHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload receipt');
    } finally {
      setUploading(false);
    }
  };

  // Helper function to get order ID from various possible field names
  const getOrderId = (order) => {
    // Priority: code field (formatted order number) > other numeric IDs > fallback to UUID
    if (order?.code && order.code !== "N/A") return order.code;
    if (order?.order_number) return order.order_number;
    if (order?.reference_number) return order.reference_number;
    if (order?.order_id) return order.order_id;

    // Fallback to ID (UUID)
    const id = order?.id || order?.uuid || "N/A";
    return id;
  };

  // Helper function to format order ID as display
  const getFormattedOrderId = (order) => {
    const orderId = getOrderId(order);
    if (orderId === "N/A") return orderId;

    // If it's already a formatted code (contains - or starts with ORD), just add #
    if (orderId.includes('-') && !orderId.startsWith('Order')) {
      return orderId.startsWith('#') ? orderId : `#${orderId}`;
    }

    // If it's a UUID or ID without formatting, show first 8 chars with shortened format
    const shortId = orderId.substring(0, 8).toUpperCase();
    return `#${shortId}`;
  };

  // Helper function to get item price from various possible field names
  const getItemPrice = (item) => {
    // Try multiple price field names
    const price = item?.price || item?.unit_price || item?.amount || item?.item_price || item?.cost || 0;
    return parseFloat(price || 0);
  };

  // Helper function to format price with Rs.
  const formatPrice = (amount) => {
    return `Rs. ${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Helper function to filter orders by status
  const getFilteredOrders = () => {
    if (orderStatusFilter === 'all') return orderHistory;

    const statusMap = {
      'pending': ['CREATED', 'PAYMENT_UPLOADED'],
      'approved': ['PAYMENT_APPROVED'],
      'delivered': ['DELIVERED'],
      'rejected': ['PAYMENT_REJECTED']
    };

    const statuses = statusMap[orderStatusFilter] || [];
    return orderHistory.filter(order => statuses.includes(order.status));
  };

  // Helper function to get order status badge with proper styling
  const getOrderStatusBadge = (status) => {
    const statusConfig = {
      'CREATED': { bg: 'bg-yellow-200', text: 'text-yellow-800', label: '⏳ Pending', icon: '⏳' },
      'PAYMENT_UPLOADED': { bg: 'bg-blue-200', text: 'text-blue-800', label: '📤 Payment Uploaded', icon: '📤' },
      'PAYMENT_APPROVED': { bg: 'bg-green-200', text: 'text-green-800', label: '✅ Approved', icon: '✅' },
      'DELIVERED': { bg: 'bg-teal-200', text: 'text-teal-800', label: '🚚 Delivered', icon: '🚚' },
      'PAYMENT_REJECTED': { bg: 'bg-red-200', text: 'text-red-800', label: '❌ Rejected', icon: '❌' },
      'SHIPPED': { bg: 'bg-purple-200', text: 'text-purple-800', label: '📦 Shipped', icon: '📦' },
      'CANCELLED': { bg: 'bg-gray-200', text: 'text-gray-800', label: '❌ Cancelled', icon: '❌' }
    };

    const config = statusConfig[status] || { bg: 'bg-gray-200', text: 'text-gray-800', label: status, icon: '?' };
    return (
      <span className={`inline-block px-3 py-1 ${config.bg} ${config.text} text-xs font-bold rounded-full`}>
        {config.label}
      </span>
    );
  };

  // Auto-scroll to profile when visible
  useEffect(() => {
    if (showProfile && profileRef.current) {
      setTimeout(() => {
        profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showProfile]);

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

  const getStatusBadge = (status, scheduledDate) => {
    const base = "px-3 py-1 rounded-full text-xs font-semibold";

    // Check if scheduled session is expired (time has passed and session not started)
    if (status === "scheduled" && scheduledDate) {
      const now = new Date();
      const scheduled = new Date(scheduledDate);
      if (scheduled < now) {
        return `${base} bg-gray-200 text-gray-800`;
      }
    }

    const map = {
      scheduled: "bg-amber-100 text-amber-800",
      active: "bg-green-100 text-green-800",
      ended: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
      expired: "bg-gray-200 text-gray-800",
    };
    return `${base} ${map[status] || "bg-gray-100 text-gray-800"}`;
  };

  const getSessionStatus = (session) => {
    // Check if scheduled session is expired (time has passed and session not started)
    if (session.status === "scheduled" && session.scheduled_date) {
      const now = new Date();
      const scheduled = new Date(session.scheduled_date);
      if (scheduled < now) {
        return "expired";
      }
    }
    return session.status;
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
          <div className="flex justify-between items-center mb-6 pb-3 border-b-3" style={{ borderColor: '#DB9D32' }}>
            <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>
              HurshBin Trainer Dashboard
            </h1>
            <div className="text-base text-gray-600">
              Welcome, <span className="font-bold text-gray-900">{user?.name || "Trainer"}</span>!
            </div>
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
              {
                icon: "👤",
                title: "Profile & Order History",
                onClick: () => {
                  setShowProfile(!showProfile);
                  if (!showProfile) {
                    fetchOrderHistory();
                  }
                },
              },
            ].map((card, index) => (
              <div
                key={index}
                onClick={card.onClick}
                className="relative p-8 text-center cursor-pointer transition-all duration-300 ease-out transform group shadow-md hover:-translate-y-2 hover:scale-[1.02] overflow-hidden"
                style={{
                  background: 'linear-gradient(to bottom right, #ffac1f, #fc781d, #ea580c)',
                  borderRadius: '1rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#DB9D32'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to bottom right, #ffac1f, #fc781d, #ea580c)'}
              >
                <div className="text-5xl mb-4 transition-transform duration-300 group-hover:scale-110 relative z-10">
                  {card.icon}
                </div>
                <div className="text-lg font-semibold text-white mb-1 relative z-10">{card.title}</div>
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
                        .sort((a, b) => {
                          // Sort by date (newest first)
                          return new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0);
                        })
                        .slice(0, itemsPerPage)
                        .map((session) => {
                          const sessionStatus = getSessionStatus(session);
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
                            sessionStatus === "active"
                              ? "border-l-4 border-green-500"
                              : sessionStatus === "scheduled"
                                ? "border-l-4 border-amber-500"
                                : sessionStatus === "cancelled"
                                  ? "border-l-4 border-red-500"
                                  : sessionStatus === "expired"
                                    ? "border-l-4 border-gray-400"
                                    : "border-l-4 border-orange-400";
                          const bgColor =
                            sessionStatus === "active"
                              ? "bg-green-50"
                              : sessionStatus === "scheduled"
                                ? "bg-amber-50"
                                : sessionStatus === "cancelled"
                                  ? "bg-red-50"
                                  : sessionStatus === "expired"
                                    ? "bg-gray-50"
                                    : "bg-white";
                          return (
                            <div
                              key={session.id || session.session_id}
                              className={`p-4 rounded-md shadow-sm ${borderColor} ${bgColor}`}
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
                                  {sessionStatus === "scheduled" && (
                                    <button
                                      onClick={() =>
                                        handleStartSession(session.session_id)
                                      }
                                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                                    >
                                      Start Session
                                    </button>
                                  )}
                                  {sessionStatus === "active" && (
                                    <button
                                      onClick={() =>
                                        handleResumeSession(session.session_id)
                                      }
                                      className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-orange-600 text-sm font-medium shadow-md"
                                    >
                                      Resume Session
                                    </button>
                                  )}


                                  <div className="flex flex-col gap-2 mt-2 items-center">
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
                                    <span
                                      className={getStatusBadge(sessionStatus, session.scheduled_date)}
                                    >
                                      {sessionStatus === "expired" ? "Expired" : (
                                        (sessionStatus || "scheduled")
                                          .charAt(0)
                                          .toUpperCase() +
                                        (sessionStatus || "scheduled").slice(1)
                                      )}
                                    </span>
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

          {/* Profile and Order History */}
          {showProfile && (
            <div ref={profileRef} className="mt-10 bg-white rounded-xl shadow-md p-6 animate-fadeInUp transition-all duration-500 ease-in-out">
              {/* Profile Header */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">
                  👤 My Profile & Order History
                </h2>

                {/* User Profile Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Name</p>
                    <p className="text-lg font-bold text-gray-900">{user?.name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Email</p>
                    <p className="text-lg font-bold text-gray-900">{user?.email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Role</p>
                    <p className="text-lg font-bold text-gray-900">{user?.role || "Trainer"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Phone</p>
                    <p className="text-lg font-bold text-gray-900">{user?.phone || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Order History Section */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 border-b pb-4 mb-6 flex items-center gap-2">
                  <span className="text-2xl">📦</span> Order History
                </h3>

                {/* Status Filter Radio Buttons */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Filter by Status:</p>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { value: 'all', label: 'All Orders', icon: '📦' },
                      { value: 'pending', label: 'Pending', icon: '⏳' },
                      { value: 'approved', label: 'Approved', icon: '✅' },
                      { value: 'delivered', label: 'Delivered', icon: '🚚' },
                      { value: 'rejected', label: 'Rejected', icon: '❌' }
                    ].map(filter => (
                      <label key={filter.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="orderStatus"
                          value={filter.value}
                          checked={orderStatusFilter === filter.value}
                          onChange={(e) => setOrderStatusFilter(e.target.value)}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <span className="text-sm text-gray-700 font-medium">
                          {filter.icon} {filter.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {loadingOrders ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mx-auto mb-2"></div>
                    Loading order history...
                  </div>
                ) : orderHistory.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-2xl mb-2">�</p>
                    <p className="text-gray-600 font-medium">No orders found</p>
                    <p className="text-gray-500 text-sm mt-1">No orders with the selected status</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {getFilteredOrders().map((order, orderIdx) => {
                      const orderId = getOrderId(order);
                      return (
                        <div key={orderId || orderIdx} className="border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                          {/* Order Header */}
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 border-b border-gray-300">
                            <div className="flex items-center justify-between">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order ID</p>
                                  <p className="font-mono text-sm font-bold text-gray-900">{getFormattedOrderId(order)}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Date</p>
                                  <p className="text-sm font-bold text-gray-900">
                                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total Amount</p>
                                  <p className="text-sm font-bold text-green-700">
                                    {formatPrice(order.total_amount)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Status</p>
                                  {getOrderStatusBadge(order.status)}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setExpandedOrders(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(orderId)) {
                                      newSet.delete(orderId);
                                    } else {
                                      newSet.add(orderId);
                                    }
                                    return newSet;
                                  });
                                }}
                                className="ml-4 flex-shrink-0 p-2 hover:bg-green-100 rounded-lg transition-colors"
                                title="Toggle details"
                              >
                                <svg
                                  className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${expandedOrders.has(orderId) ? 'rotate-180' : ''
                                    }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Order Items - Collapsible */}
                          {expandedOrders.has(orderId) && (
                            <div className="p-5 border-b border-gray-200 animate-fadeIn">
                              <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <span>📋</span> Ordered Items
                              </h4>

                              {order.items && order.items.length > 0 ? (
                                <div className="space-y-3">
                                  {order.items.map((item, itemIdx) => (
                                    <div key={itemIdx} className="flex justify-between items-start p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
                                      <div className="flex-1">
                                        <p className="font-semibold text-gray-800 text-base">
                                          {item.name || item.title || item.product_name || "Unknown Item"}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                                          <span>Qty: <span className="font-bold text-gray-800">{item.quantity || 1}</span></span>
                                          {item.category && (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                              {item.category}
                                            </span>
                                          )}
                                        </div>
                                        {item.description && (
                                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="ml-4 text-right flex-shrink-0">
                                        <p className="text-lg font-bold text-gray-900">
                                          {formatPrice(getItemPrice(item))}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">per item</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm py-4">No items in this order.</p>
                              )}
                            </div>
                          )}

                          {/* Order Details Footer - Collapsible */}
                          {expandedOrders.has(orderId) && (
                            <div className="bg-gray-50 p-5 border-t border-gray-300 flex justify-between items-center animate-fadeIn">
                              <div className="text-sm text-gray-600">
                                {order.delivery_address && (
                                  <p><span className="font-semibold">📍 Delivery:</span> {order.delivery_city || "City"} - {order.delivery_pincode || "PIN"}</p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedOrderDetails(order);
                                  setShowOrderDetailsModal(true);
                                }}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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

      {/* Order Details Modal */}
      {showOrderDetailsModal && selectedOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowOrderDetailsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Order Details</h2>
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Order ID and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Order ID</label>
                  <p className="text-lg font-bold text-gray-900 font-mono">{getFormattedOrderId(selectedOrderDetails)}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Status</label>
                  {getOrderStatusBadge(selectedOrderDetails.status)}
                </div>
              </div>

              {/* Order Date and Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Order Date</label>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedOrderDetails.created_at ? new Date(selectedOrderDetails.created_at).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">Total Amount</label>
                  <p className="text-lg font-bold text-green-700">{formatPrice(selectedOrderDetails.total_amount)}</p>
                </div>
              </div>

              {/* Rejection Reason - Show only if status is PAYMENT_REJECTED */}
              {selectedOrderDetails.status === 'PAYMENT_REJECTED' && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-red-800 block mb-2">Rejection Reason</label>
                      {selectedOrderDetails.rejection_reason ? (
                        <>
                          <p className="text-sm text-red-700 bg-white border border-red-200 rounded p-3">
                            {selectedOrderDetails.rejection_reason}
                          </p>
                          <p className="text-xs text-red-600 mt-2">
                            💡 Please review the reason above and reupload the correct payment receipt.
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-red-700 bg-white border border-red-200 rounded p-3">
                          Your payment was rejected. Please reupload the receipt.
                        </p>
                      )}
                      <button
                        onClick={() => setShowReuploadModal(true)}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                      >
                        🔄 Reupload Receipt
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-3">📋 Order Items</label>
                {selectedOrderDetails.items && selectedOrderDetails.items.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOrderDetails.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">
                            {item.name || item.title || item.product_name || "Unknown Item"}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                            <span>Qty: <span className="font-bold">{item.quantity || 1}</span></span>
                            {item.category && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 text-right flex-shrink-0">
                          <p className="text-base font-bold text-gray-900">
                            {formatPrice(getItemPrice(item))}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">per item</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm py-4">No items in this order.</p>
                )}
              </div>

              {/* Delivery Address */}
              {selectedOrderDetails.delivery_address && (
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">📍 Delivery Address</label>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-gray-800 font-semibold">{selectedOrderDetails.delivery_address}</p>
                    {selectedOrderDetails.delivery_city && (
                      <p className="text-gray-600 text-sm mt-2">
                        {selectedOrderDetails.delivery_city}
                        {selectedOrderDetails.delivery_state && `, ${selectedOrderDetails.delivery_state}`}
                        {selectedOrderDetails.delivery_pincode && ` - ${selectedOrderDetails.delivery_pincode}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal:</span>
                    <span className="font-semibold">
                      {formatPrice(selectedOrderDetails.subtotal || selectedOrderDetails.total_amount)}
                    </span>
                  </div>
                  {selectedOrderDetails.tax_amount && (
                    <div className="flex justify-between text-gray-700">
                      <span>Tax:</span>
                      <span className="font-semibold">{formatPrice(selectedOrderDetails.tax_amount)}</span>
                    </div>
                  )}
                  {selectedOrderDetails.shipping_cost && (
                    <div className="flex justify-between text-gray-700">
                      <span>Shipping:</span>
                      <span className="font-semibold">{formatPrice(selectedOrderDetails.shipping_cost)}</span>
                    </div>
                  )}
                  {selectedOrderDetails.discount_amount && (
                    <div className="flex justify-between text-gray-700">
                      <span>Discount:</span>
                      <span className="font-semibold text-red-600">
                        -{formatPrice(selectedOrderDetails.discount_amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-green-700">{formatPrice(selectedOrderDetails.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {selectedOrderDetails.notes && (
                <div>
                  <label className="text-sm font-semibold text-gray-600 block mb-2">📝 Order Notes</label>
                  <p className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">
                    {selectedOrderDetails.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reupload Receipt Modal */}
      {showReuploadModal && selectedOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🔄</span> Reupload Receipt
              </h2>
              <button
                onClick={() => {
                  setShowReuploadModal(false);
                  setReceiptFile(null);
                }}
                className="text-white hover:bg-red-700 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Order ID:</strong> {getFormattedOrderId(selectedOrderDetails)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Receipt File (JPG, PNG, or PDF)
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                />
                {receiptFile && (
                  <p className="text-sm text-green-600 mt-2">✓ {receiptFile.name}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">Max file size: 5MB</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
              <button
                onClick={() => {
                  setShowReuploadModal(false);
                  setReceiptFile(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReuploadReceipt}
                disabled={!receiptFile || uploading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium transition-colors"
              >
                {uploading ? '⏳ Uploading...' : '🔄 Reupload'}
              </button>
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
