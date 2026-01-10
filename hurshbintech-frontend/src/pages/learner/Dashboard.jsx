import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";
import learningProgramsService from "../../api/services/learningProgramsService";
import programAssignmentService from "../../api/services/programAssignmentService";
import orderService from "../../api/services/ecommerce/orderService";

const LearnerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Track if we've shown the initial error toast
  const sessionErrorToastShownRef = useRef(false);
  const programErrorToastShownRef = useRef(false);

  // Refs for auto-scroll
  const sessionsRef = useRef(null);
  const homeProgamsRef = useRef(null);
  const learningContentRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [learningPrograms, setLearningPrograms] = useState([]);
  const [groupedPrograms, setGroupedPrograms] = useState({}); // { title: [programs] }
  const [learningContents, setLearningContents] = useState([]); // All assigned learning contents
  const [programContents, setProgramContents] = useState({}); // { programId: [contents] }
  const [expandedPrograms, setExpandedPrograms] = useState(new Set()); // Track which programs are expanded
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(null);

  // Track which sessions have been joined - persist to localStorage
  const [joinedSessions, setJoinedSessions] = useState(() => {
    const saved = localStorage.getItem('joinedSessions');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Toggle states for sections
  const [showSessions, setShowSessions] = useState(false);
  const [showLearningContent, setShowLearningContent] = useState(false);
  const [showHomePrograms, setShowHomePrograms] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Final submission modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProgramForSubmit, setSelectedProgramForSubmit] = useState(null);
  const [submittingProgram, setSubmittingProgram] = useState(false);
  const [learnerNotesForSubmit, setLearnerNotesForSubmit] = useState('');
  const [proofOfWorkForSubmit, setProofOfWorkForSubmit] = useState(null);

  // Profile and Order History state
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set()); // Track which orders are expanded
  const [orderStatusFilter, setOrderStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'delivered', 'rejected'
  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const profileRef = useRef(null);


  useEffect(() => {
    fetchSessions();
    fetchAssignedPrograms();
    fetchAllLearningContents();

    // Auto-refresh sessions every 30 seconds
    const refreshInterval = setInterval(() => {
      console.log('[LearnerDashboard] Auto-refreshing sessions...');
      fetchSessions();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist joinedSessions to localStorage
  useEffect(() => {
    localStorage.setItem('joinedSessions', JSON.stringify([...joinedSessions]));
  }, [joinedSessions]);

  // Auto-scroll to My Sessions when visible
  useEffect(() => {
    if (showSessions && sessionsRef.current) {
      setTimeout(() => {
        sessionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showSessions]);

  // Auto-scroll to Home Programs when visible
  useEffect(() => {
    if (showHomePrograms && homeProgamsRef.current) {
      setTimeout(() => {
        homeProgamsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showHomePrograms]);

  // Auto-scroll to Learning Content when visible
  useEffect(() => {
    if (showLearningContent && learningContentRef.current) {
      setTimeout(() => {
        learningContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showLearningContent]);

  // Auto-scroll to Profile when visible
  useEffect(() => {
    if (showProfile && profileRef.current) {
      setTimeout(() => {
        profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showProfile]);

  const fetchSessions = async () => {
    try {
      const data = await sessionService.getLearnerSessions();
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      // Show error toast only once on initial login
      if (!sessionErrorToastShownRef.current) {
        // toast.info("No active sessions created yet");
        sessionErrorToastShownRef.current = true;
      }
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchAssignedPrograms = async () => {
    try {
      const data = await programAssignmentService.getMyAssignments();
      console.log("📌 Fetched assigned programs data:", data);

      // Log first item to see structure
      if (data && data.length > 0) {
        console.log("🔍 First program item structure:", data[0]);
      }

      // Ensure data is an array to prevent runtime errors
      if (Array.isArray(data)) {
        // Sort by assignment_title
        const sortedData = data.sort((a, b) => {
          const titleA = (a.assignment_title || a.program_name || a.name || '').toLowerCase();
          const titleB = (b.assignment_title || b.program_name || b.name || '').toLowerCase();
          return titleA.localeCompare(titleB);
        });
        setLearningPrograms(sortedData);

        // Group by assignment_title (each group represents one "Home Program" assignment)
        const grouped = sortedData.reduce((acc, prog) => {
          const title = prog.assignment_title;
          if (!acc[title]) {
            acc[title] = [];
          }
          acc[title].push(prog);
          return acc;
        }, {});
        setGroupedPrograms(grouped);

        console.log(`✅ Grouped ${sortedData.length} programs into ${Object.keys(grouped).length} assignment titles`);
      } else {
        console.warn("⚠️ Fetched data is not an array:", data);
        setLearningPrograms([]);
        setGroupedPrograms({});
      }
    } catch (error) {
      console.error("❌ Error fetching assigned programs:", error);
      // Show error toast only once on initial login
      if (!programErrorToastShownRef.current) {
        // toast.info("No programs assigned yet");
        programErrorToastShownRef.current = true;
      }
      setLearningPrograms([]); // Set to empty array on error
      setGroupedPrograms({});
    } finally {
      setLoadingPrograms(false);
    }
  };

  const fetchAllLearningContents = async () => {
    try {
      setLoadingContents(true);
      const contents = await programAssignmentService.getMyLearningContents();
      console.log("🔍 API Response - Fetched all learning contents:", contents);
      console.log(`📊 Total items in response: ${Array.isArray(contents) ? contents.length : 'NOT AN ARRAY'}`);

      if (Array.isArray(contents)) {
        contents.forEach((item, idx) => {
          console.log(`  ${idx + 1}. "${item.title}" (ID: ${item.id}, Type: ${item.content_type}, Assignment: ${item.program_assignment_id}, From Program: ${item.from_program})`);
        });

        // Organize contents by program_assignment_id (the assignment they belong to)
        // This ensures contents are properly grouped under their assignments
        const byAssignment = {};
        contents.forEach(content => {
          const assignmentId = content.program_assignment_id;
          if (assignmentId) {
            if (!byAssignment[assignmentId]) {
              byAssignment[assignmentId] = [];
            }
            byAssignment[assignmentId].push(content);
          }
        });

        setProgramContents(byAssignment);
        console.log(`📂 Organized contents into ${Object.keys(byAssignment).length} assignments:`, Object.keys(byAssignment));
      }

      setLearningContents(Array.isArray(contents) ? contents : []);
      console.log(`✅ State updated with ${Array.isArray(contents) ? contents.length : 0} contents`);
    } catch (error) {
      console.error("❌ Error fetching learning contents:", error);
      setLearningContents([]);
    } finally {
      setLoadingContents(false);
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

  // Helper function to get status badge with proper styling
  const getStatusBadge = (status) => {
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
  const toggleProgramExpand = (programId) => {
    setExpandedPrograms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(programId)) {
        newSet.delete(programId);
      } else {
        newSet.add(programId);
      }
      return newSet;
    });
  };

  const handleJoinSession = (sessionId) => {
    // Mark this session as joined
    setJoinedSessions(prev => new Set([...prev, sessionId]));
    navigate(`/learner/session/${sessionId}`);
  };

  const handleViewContent = (content) => {
    setSelectedContent(content);
    setShowContentModal(true);
    setContentLoading(true);

    // Set a timeout to stop loading after 3 seconds in case content fails to load
    const timeout = setTimeout(() => {
      setContentLoading(false);
    }, 3000);

    setLoadingTimeout(timeout);
  };

  const handleCloseModal = () => {
    setShowContentModal(false);
    setSelectedContent(null);
    setContentLoading(false);
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  };

  const handleOpenSubmitModal = (program) => {
    setSelectedProgramForSubmit(program);
    setShowSubmitModal(true);
    setLearnerNotesForSubmit('');
    setProofOfWorkForSubmit(null);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
    setSelectedProgramForSubmit(null);
    setLearnerNotesForSubmit('');
    setProofOfWorkForSubmit(null);
  };

  const handleProofFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (selectedFile.size > maxSize) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setProofOfWorkForSubmit(selectedFile);
    }
  };

  const handleStartProgram = async (programId) => {
    try {
      console.log(`🚀 Starting program assignment ${programId}...`);

      // Update assignment status to IN_PROGRESS
      await programAssignmentService.updateMyAssignment(programId, {
        completion_status: 'IN_PROGRESS'
      });

      console.log(`✅ Program started successfully`);

      // Refresh programs to update button state
      await fetchAssignedPrograms();

      // Navigate to program details
      navigate(`/learner/program-assignment/${programId}`);
    } catch (error) {
      console.error('Failed to start program:', error);
      // Still navigate even if update fails
      navigate(`/learner/program-assignment/${programId}`);
    }
  };

  const handleFinalProgramSubmit = async () => {
    if (!selectedProgramForSubmit) return;

    if (!learnerNotesForSubmit.trim() && !proofOfWorkForSubmit) {
      toast.error('Please add notes or upload proof of work');
      return;
    }

    try {
      setSubmittingProgram(true);
      console.log(`🎯 Submitting program assignment ${selectedProgramForSubmit.id}...`);

      // Upload proof of work if provided
      if (proofOfWorkForSubmit) {
        console.log('📤 Uploading proof of work...');
        await programAssignmentService.uploadMyAttachment(
          selectedProgramForSubmit.id,
          proofOfWorkForSubmit,
          'Proof of Work'
        );
      }

      // Update assignment with notes and mark as completed
      const updateData = {
        completion_status: 'COMPLETED'
      };

      if (learnerNotesForSubmit.trim()) {
        // Preserve existing notes and append new ones
        const currentNotes = selectedProgramForSubmit.learner_notes || '';
        const timestamp = new Date().toLocaleString();
        const newNote = `[${timestamp}] ${learnerNotesForSubmit.trim()}`;
        updateData.learner_notes = currentNotes ? `${currentNotes}\n---\n${newNote}` : newNote;
      }

      await programAssignmentService.updateMyAssignment(selectedProgramForSubmit.id, updateData);

      toast.success('Program submitted successfully!');
      handleCloseSubmitModal();

      // Refresh programs to show updated status
      await fetchAssignedPrograms();
    } catch (error) {
      console.error('Failed to submit program:', error);
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to submit program';
      toast.error(errorMessage);
    } finally {
      setSubmittingProgram(false);
    }
  };

  const renderContentViewer = () => {
    if (!selectedContent) return null;

    const { content_type, file_url, title } = selectedContent;
    const fullUrl = file_url?.startsWith('http') ? file_url : file_url;

    const handleLoad = () => {
      setContentLoading(false);
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
    };
    const handleError = () => {
      setContentLoading(false);
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
      toast.error("Failed to load content");
    };

    switch (content_type?.toLowerCase()) {
      case 'image':
        return (
          <div className="flex justify-center">
            <img
              src={fullUrl}
              alt={title}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        );

      case 'video':
        return (
          <div className="flex justify-center">
            <video
              src={fullUrl}
              controls
              className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
              onLoadedData={handleLoad}
              onError={handleError}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="flex justify-center">
            <audio
              src={fullUrl}
              controls
              className="w-full max-w-md"
              onLoadedData={handleLoad}
              onError={handleError}
            >
              Your browser does not support the audio tag.
            </audio>
          </div>
        );

      case 'pdf':
      case 'document':
        return (
          <div className="flex justify-center">
            <iframe
              src={fullUrl}
              className="w-full h-[70vh] border rounded-lg shadow-lg"
              title={title}
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-gray-600 mb-4">This content type is not supported for inline viewing.</p>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open in New Tab
            </a>
          </div>
        );
    }
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 p-6 md:p-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex justify-between items-center mb-6 pb-3 border-b-3" style={{ borderColor: '#DB9D32' }}>
            <h1 className="text-3xl font-bold" style={{ color: '#000000' }}>
              HurshBin Learner Dashboard
            </h1>
            <div className="text-base text-gray-600">
              Welcome, <span className="font-bold text-gray-900">{user?.name || "Learner"}</span>!
            </div>
          </div>

          {/* Quick Access Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {[
              {
                icon: "🎓",
                title: "Individualised Intervention Program(IIP)",
                onClick: () => setShowSessions(!showSessions),
              },
              {
                icon: "📚",
                title: "Home Program (HP)",
                onClick: () => setShowHomePrograms(!showHomePrograms),
              },
              {
                icon: "📖",
                title: "Learning Content",
                onClick: () => setShowLearningContent(!showLearningContent),
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
              {
                icon: "🛒",
                title: "Buy Learning Material",
                onClick: () => navigate("/learner/learning-material"), // Add path if available
              },
              {
                icon: "💬",
                title: "Communication",
                onClick: () => navigate("/learner/communication"), // optional
              },
              {
                icon: "📅",
                title: "Book Appointment",

                onClick: () => navigate("/book-appointment"), // New booking page
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
                <div className="text-sm text-amber-100 relative z-10">{card.desc}</div>
              </div>
            ))}
          </div>


          {/* Upcoming Sessions */}
          {showSessions && (
            <div ref={sessionsRef} className="mt-10 bg-white rounded-xl shadow-md p-6 animate-fadeInUp transition-all duration-500 ease-in-out">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex-1">
                  My Sessions
                </h2>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    {sessions.length} total sessions
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

              {loadingSessions ? (
                <div className="text-center py-6 text-gray-500">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-6 text-gray-500">No sessions scheduled.</div>
              ) : (
                <div className="space-y-3">
                  {sessions
                    .sort((a, b) => {
                      // Sort by date (newest first)
                      return new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0);
                    })
                    .slice(0, itemsPerPage)
                    .map((session) => {
                      const isActive = session.status === 'active';
                      const isScheduled = session.status === 'scheduled';
                      const isEnded = session.status === 'ended';
                      const isCancelled = session.status === 'cancelled';
                      // Check if learner has actually joined before (not just if trainer started)
                      const learnerHasJoined = session.learner_joined_at || session.joined_at;
                      const statusColor = isActive ? 'border-green-500 bg-green-50' :
                        isScheduled ? 'border-amber-500 bg-amber-50' :
                          isCancelled ? 'border-red-500 bg-red-50' :
                            'border-gray-300 bg-gray-50';
                      const statusBadge = isActive ? 'bg-green-100 text-green-800' :
                        isScheduled ? 'bg-amber-100 text-amber-800' :
                          isCancelled ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800';

                      return (
                        <div
                          key={session.session_id || session.id}
                          className={`border-l-4 rounded-lg p-4 flex items-center justify-between ${statusColor} transition-all hover:shadow-md`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-800 truncate">
                                {session.title || `Session with ${session.trainer?.name || session.trainer_name || 'Trainer'}`}
                              </h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge}`}>
                                {(session.status || 'scheduled').charAt(0).toUpperCase() + (session.status || 'scheduled').slice(1)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                              <span>📅 {formatShortDate(session.scheduled_date ?? session.started_at)}</span>
                              {session.scheduled_date && (
                                <span>🕐 {new Date(session.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                              <span>👨‍🏫 {session.trainer?.name || session.trainer_name || '—'}</span>
                              {session.duration && <span>⏱️ {session.duration} min</span>}
                            </div>
                            {session.program && (
                              <p className="text-xs text-gray-500 mt-1">Program: {session.program}</p>
                            )}
                          </div>

                          <div className="ml-4 flex-shrink-0">
                            {(isActive || isScheduled) && (
                              <button
                                onClick={() => handleJoinSession(session.session_id)}
                                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shadow-md"
                              >
                                {joinedSessions.has(session.session_id) ? 'Rejoin Session' : 'Join Session'}
                              </button>
                            )}
                            {isEnded && (
                              <span className="text-gray-500 text-sm">Completed</span>
                            )}
                            {isCancelled && (
                              <span className="text-red-600 text-sm font-semibold">Cancelled</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ✅ Assigned Home Programs */}
          {showHomePrograms && (
            <div ref={homeProgamsRef} className="mt-10 bg-white rounded-xl shadow-md p-6 animate-fadeInUp transition-all duration-500 ease-in-out">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4">
                📚 Assigned Programs (Grouped by Assignment Title)
              </h2>

              {loadingPrograms ? (
                <p className="text-gray-500">Loading assigned programs...</p>
              ) : learningPrograms.length === 0 ? (
                <p className="text-gray-500">No home programs assigned yet.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedPrograms).map(([titleKey, programsList]) => {
                    // Use first program's data for the group (they share same status if from same assignment)
                    const firstProg = programsList[0];
                    const completionStatus = firstProg.completion_status || 'NOT_STARTED';
                    const hasFinalFeedback = firstProg.final_feedback_rating && firstProg.final_feedback_rating > 0;
                    const isSubmitted = completionStatus === 'COMPLETED';
                    const needsResubmission = isSubmitted && hasFinalFeedback;
                    const isInProgress = completionStatus === 'IN_PROGRESS';
                    const isNotStarted = completionStatus === 'NOT_STARTED';

                    return (
                      <div
                        key={titleKey}
                        className="p-5 rounded-lg border bg-gray-50 hover:bg-gray-100 transition relative"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 mb-2">
                              📌 {titleKey}
                            </h3>

                            {/* Programs List */}
                            <div className="mb-3">
                              <p className="text-xs text-gray-600 font-semibold mb-1 uppercase">Programs:</p>
                              <div className="ml-3 space-y-1">
                                {firstProg.program_names && firstProg.program_names.length > 0 ? (
                                  firstProg.program_names.map((name, idx) => (
                                    <p key={idx} className="text-sm text-gray-700">
                                      • {name}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-sm text-gray-700">
                                    • {firstProg.program_name || 'Untitled Program'}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Timeline Info */}
                            <div className="space-y-1 text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center gap-2">
                                <span>📅 Start:</span>
                                <span>{new Date(firstProg.start_date || firstProg.assigned_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span>⏰ Deadline:</span>
                                <span className="font-semibold">{new Date(firstProg.end_date).toLocaleDateString()}</span>
                              </div>
                              {firstProg.duration_days && (
                                <div className="flex items-center gap-2">
                                  <span>⏱️ Duration:</span>
                                  <span>{firstProg.duration_days} days</span>
                                </div>
                              )}

                            </div>
                          </div>

                          <div className="flex flex-row gap-2 items-center justify-end ml-4 flex-shrink-0">
                            {/* Show Remarks button when final feedback exists */}
                            {hasFinalFeedback && (
                              <button
                                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-amber-600 hover:to-orange-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl relative"
                                onClick={() => {
                                  setSelectedFeedback({
                                    rating: firstProg.final_feedback_rating,
                                    remarks: firstProg.final_feedback_remarks,
                                    programName: titleKey,
                                    givenAt: firstProg.final_feedback_given_at
                                  });
                                  setShowFeedbackModal(true);
                                }}
                              >
                                <span className="text-base">💬</span>
                                <span>Remarks</span>
                              </button>
                            )}

                            {/* Show Submit button only for IN_PROGRESS or RESUBMISSION_REQUIRED */}
                            {(isInProgress || needsResubmission) && (
                              <button
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                onClick={() => handleOpenSubmitModal(firstProg)}
                              >
                                Submit
                              </button>
                            )}

                            {/* Button Logic Based on Status */}
                            {isNotStarted && (
                              <button
                                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                onClick={() => handleStartProgram(firstProg.id)}
                              >
                                Start
                              </button>
                            )}

                            {isInProgress && (
                              <button
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                onClick={() => navigate(`/learner/program-assignment/${firstProg.id}`)}
                              >
                                Continue
                              </button>
                            )}

                            {isSubmitted && (
                              <button
                                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                onClick={() => navigate(`/learner/program-assignment/${firstProg.id}`)}
                              >
                                View
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ✅ Learning Contents Assigned by Head */}
          {showLearningContent && (
            <div ref={learningContentRef} id="learning-content-section" className="mt-10 bg-white rounded-xl shadow-md p-6 animate-fadeInUp transition-all duration-500 ease-in-out">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4">
                Learning Content ({learningContents.length})
              </h2>

              {loadingContents ? (
                <p className="text-gray-500">Loading learning contents...</p>
              ) : learningContents.length === 0 ? (
                <p className="text-gray-500">No learning content assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {learningContents.map((content, idx) => (
                    <div
                      key={`content-${content.id}-${idx}`}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer"
                      onClick={() => handleViewContent(content)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-base hover:text-blue-600">
                          {content.title || 'Untitled Content'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded border">
                            {content.content_type || 'Unknown Type'}
                          </span>
                          {content.assigned_by && (
                            <span className="text-xs text-gray-500">
                              Assigned by: {content.assigned_by}
                            </span>
                          )}
                          {content.from_program && (
                            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                              📚 From Program
                            </span>
                          )}
                          {!content.from_program && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              ✨ Extra Material
                            </span>
                          )}
                        </div>
                        {content.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                            {content.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    <p className="text-lg font-bold text-gray-900">{user?.role || "Learner"}</p>
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
                ) : getFilteredOrders().length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-2xl mb-2">�</p>
                    <p className="text-gray-600 font-medium">No delivered orders yet</p>
                    <p className="text-gray-500 text-sm mt-1">Your delivered orders will appear here!</p>
                    <button
                      onClick={() => navigate("/learner/learning-material")}
                      className="mt-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-md"
                    >
                      Browse Store
                    </button>
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
                                  {getStatusBadge(order.status)}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setExpandedOrders(prev => {
                                    const newSet = new Set(prev);
                                    const orderId = getOrderId(order);
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
                                  className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${expandedOrders.has(getOrderId(order)) ? 'rotate-180' : ''
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
                          {expandedOrders.has(getOrderId(order)) && (
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
                          {expandedOrders.has(getOrderId(order)) && (
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

      {/* Content Viewer Modal */}
      {showContentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 truncate">
                  {selectedContent?.title}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    {selectedContent?.content_type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-140px)]">
              {contentLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading content...</p>
                  </div>
                </div>
              ) : (
                renderContentViewer()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold mb-1">Head's Feedback</h3>
                  <p className="text-amber-100 text-sm">{selectedFeedback.programName}</p>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-white hover:bg-amber-600 rounded-full p-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Rating */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-gray-600 mb-2 block">Rating</label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-2xl ${star <= selectedFeedback.rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                      >
                        ⭐
                      </span>
                    ))}
                  </div>
                  <span className="text-lg font-bold text-yellow-600">
                    {selectedFeedback.rating}/5
                  </span>
                </div>
              </div>

              {/* Remarks */}
              {selectedFeedback.remarks && (
                <div className="mb-6">
                  <label className="text-sm font-semibold text-gray-600 mb-2 block">Remarks</label>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                    <p className="text-gray-800 italic leading-relaxed">
                      "{selectedFeedback.remarks}"
                    </p>
                  </div>
                </div>
              )}

              {/* Timestamp */}
              {selectedFeedback.givenAt && (
                <div className="text-xs text-gray-500 text-center pt-4 border-t">
                  Feedback given on {new Date(selectedFeedback.givenAt).toLocaleDateString()} at{' '}
                  {new Date(selectedFeedback.givenAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-0">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Program Submission Modal */}
      {showSubmitModal && selectedProgramForSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold mb-1">Submit Program</h3>
                </div>
                <button
                  onClick={handleCloseSubmitModal}
                  className="text-white hover:bg-green-600 rounded-full p-2 transition-colors"
                  disabled={submittingProgram}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">

              {/* Learner Notes */}
              <div className="form-group mb-4">
                <label htmlFor="submit-notes" className="text-sm font-semibold text-gray-600 mb-2 block">
                  Notes (Required)
                </label>
                <textarea
                  id="submit-notes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  rows="4"
                  placeholder="Add your notes about this submission..."
                  value={learnerNotesForSubmit}
                  onChange={(e) => setLearnerNotesForSubmit(e.target.value)}
                  disabled={submittingProgram}
                />
              </div>

              {/* Proof of Work */}
              <div className="form-group mb-6">
                <label htmlFor="submit-proof" className="text-sm font-semibold text-gray-600 mb-2 block">
                  Proof of Work (Optional)
                </label>
                <input
                  type="file"
                  id="submit-proof"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  onChange={handleProofFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                  disabled={submittingProgram}
                />
                {proofOfWorkForSubmit && (
                  <p className="text-xs text-green-600 mt-2">
                    Selected: {proofOfWorkForSubmit.name} ({(proofOfWorkForSubmit.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Max file size: 50MB</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={handleCloseSubmitModal}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 rounded-lg transition-all duration-200"
                disabled={submittingProgram}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalProgramSubmit}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submittingProgram || (!learnerNotesForSubmit.trim() && !proofOfWorkForSubmit)}
              >
                {submittingProgram ? 'Submitting...' : 'Submit Program'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetailsModal && selectedOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 sticky top-0 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Order {getFormattedOrderId(selectedOrderDetails)} Details</h3>
                  <p className="text-blue-100 text-sm">Complete order information</p>
                </div>
                <button
                  onClick={() => setShowOrderDetailsModal(false)}
                  className="text-white hover:bg-blue-600 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Order Status & Timeline */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-2">Status</p>
                    {getStatusBadge(selectedOrderDetails.status)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Date</p>
                    <p className="font-semibold text-gray-900">
                      {selectedOrderDetails.created_at ? new Date(selectedOrderDetails.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Time</p>
                    <p className="font-semibold text-gray-900">
                      {selectedOrderDetails.created_at ? new Date(selectedOrderDetails.created_at).toLocaleTimeString() : "N/A"}
                    </p>
                  </div>
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

              {/* Delivery Address */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📍</span> Delivery Address
                </h4>
                <div className="space-y-2 text-gray-700">
                  <p className="font-semibold text-lg">{selectedOrderDetails.delivery_address || "N/A"}</p>
                  <div className="flex gap-4 text-sm">
                    <p><span className="font-semibold">City:</span> {selectedOrderDetails.delivery_city || "N/A"}</p>
                    <p><span className="font-semibold">Postal Code:</span> {selectedOrderDetails.delivery_pincode || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>💳</span> Payment Information
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-700 font-semibold">Payment Method:</p>
                    <p className="text-gray-900 font-bold">{selectedOrderDetails.payment_method || "N/A"}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-gray-700 font-semibold">Total Amount:</p>
                    <p className="text-2xl font-bold text-green-700">{formatPrice(selectedOrderDetails.total_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Ordered Items */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📦</span> Ordered Items ({selectedOrderDetails.items?.length || 0})
                </h4>

                {selectedOrderDetails.items && selectedOrderDetails.items.length > 0 ? (
                  <div className="space-y-4">
                    {selectedOrderDetails.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-base">
                              {item.name || item.title || item.product_name || "Unknown Item"}
                            </p>
                            {item.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="text-lg font-bold text-gray-900">
                              {formatPrice(getItemPrice(item))}
                            </p>
                            <p className="text-xs text-gray-500">per unit</p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600 pt-3 border-t border-gray-300">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold">Qty:</span>
                            <span className="font-bold text-gray-900">{item.quantity || 1}</span>
                          </span>
                          {item.category && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                              {item.category}
                            </span>
                          )}
                          <span className="ml-auto font-semibold text-gray-900">
                            Subtotal: {formatPrice(getItemPrice(item) * (item.quantity || 1))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No items in this order.</p>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-gray-700">Subtotal:</p>
                    <p className="font-semibold text-gray-900">{formatPrice(selectedOrderDetails.total_amount)}</p>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between text-base font-bold">
                    <p className="text-gray-900">Total Amount:</p>
                    <p className="text-green-700">{formatPrice(selectedOrderDetails.total_amount)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 sticky bottom-0">
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
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

export default LearnerDashboard;
