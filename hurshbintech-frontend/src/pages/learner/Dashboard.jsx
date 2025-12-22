import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";
import learningProgramsService from "../../api/services/learningProgramsService";
import learningContentAssignmentService from "../../api/services/learningContentAssignmentService";
import programAssignmentService from "../../api/services/programAssignmentService";

const LearnerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [learningPrograms, setLearningPrograms] = useState([]);
  const [assignedContents, setAssignedContents] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingContents, setLoadingContents] = useState(true);
  const [showContentModal, setShowContentModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(null);


  useEffect(() => {
    fetchSessions();
    fetchAssignedPrograms();
    fetchAssignedContents();

    // Add keyboard event listener for ESC key to close modal
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showContentModal) {
        handleCloseModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContentModal]);

  const fetchSessions = async () => {
    try {
      const data = await sessionService.getLearnerSessions();
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchAssignedPrograms = async () => {
    try {
      const data = await programAssignmentService.getMyAssignments();
      console.log("Fetched assigned programs data:", data); // Debug log
      // Ensure data is an array to prevent runtime errors
      setLearningPrograms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching assigned programs:", error);
      toast.error("Failed to load assigned home programs. Please try refreshing the page.");
      setLearningPrograms([]); // Set to empty array on error
    } finally {
      setLoadingPrograms(false);
    }
  };

  const fetchAssignedContents = async () => {
    try {
      console.log('Fetching content for learner ID:', user.id);
      const data = await learningContentAssignmentService.getAssignmentsByLearner(user.id);
      console.log("Fetched assigned contents data:", data); // Debug log
      console.log("Data type:", typeof data, "Is array:", Array.isArray(data));

      // Ensure data is an array to prevent runtime errors
      setAssignedContents(Array.isArray(data) ? data : []);

      if (data && data.length > 0) {
        console.log(`Successfully loaded ${data.length} assigned content(s)`);
        console.log('First content:', data[0]);
      } else {
        console.log('No content assignments found for this learner');
      }
    } catch (error) {
      console.error("Error fetching assigned contents:", error);
      console.error("Error details:", error.response?.data || error.message);
      toast.error("Failed to load assigned learning contents. Please try refreshing the page.");
      setAssignedContents([]); // Set to empty array on error
    } finally {
      setLoadingContents(false);
    }
  };

  const handleJoinSession = (sessionId) => {
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

  const renderContentViewer = () => {
    if (!selectedContent) return null;

    const { content_type, file_url, content_title } = selectedContent;
    // Use file_url directly - Vite proxy will handle routing to backend
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

    switch (content_type.toLowerCase()) {
      case 'image':
        return (
          <div className="flex justify-center">
            <img
              src={fullUrl}
              alt={content_title}
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
              title={content_title}
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

  // Get next active or scheduled session
  const nextSession = sessions.find(
    (s) => s.status === "active" || s.status === "scheduled"
  );

  const formatShortDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 p-6 md:p-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <h1 className="text-3xl font-bold text-gray-800 border-b-4 border-blue-600 pb-2 mb-6">
            HurshBin Learner Dashboard
          </h1>

          {/* Welcome Banner */}
          <div className="text-center p-10 rounded-xl text-white mb-8 bg-gradient-to-br from-blue-400 to-cyan-400 shadow-md">
            <h2 className="text-2xl font-semibold mb-2">
              Welcome, {user?.name || "Learner"}!
            </h2>
            <p className="text-white/90">Your personalized learning journey starts here</p>

          </div>

          {/* Quick Access Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {[
              {
                icon: "📚",
                title: "Home Program (HP)",
                desc: "View IIP and Home Programs",
                onClick: () => navigate("/learner/learning-programs"),
              },
              {
                icon: "📖",
                title: "Learning Content",
                desc: "Access assigned learning content",
                onClick: () => {
                  // Scroll to learning content section
                  const contentSection = document.getElementById('learning-content-section');
                  if (contentSection) {
                    contentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                },
              },
              {
                icon: "🛒",
                title: "Learning Material",
                desc: "Recommended resources to buy",
                onClick: () => navigate("/learner/learning-material"), // Add path if available
              },
              {
                icon: "🎓",
                title: "Enter Learning Session",
                desc: "Join your therapy session",
                onClick: () => navigate("/learner/session"), // If you already have this route
              },
              {
                icon: "💬",
                title: "Communication",
                desc: "Message your team",
                onClick: () => navigate("/learner/communication"), // optional
              },
              {
                icon: "📅",
                title: "Book Appointment",
                desc: "Schedule with professionals",
                onClick: () => navigate("/book-appointment"), // New booking page
              },
            ].map((card, index) => (
              <div
                key={index}
                onClick={card.onClick}
                className="relative bg-white rounded-2xl p-8 text-center cursor-pointer transition-all duration-500 ease-out transform group shadow-md hover:-translate-y-3 hover:scale-[1.05] hover:shadow-2xl hover:border-green-400 hover:border"
              >
                <div className="text-5xl mb-4 transition-transform duration-500 group-hover:scale-110">
                  {card.icon}
                </div>
                <div className="text-lg font-semibold text-gray-800 mb-1">{card.title}</div>
                <div className="text-sm text-gray-500">{card.desc}</div>
              </div>
            ))}
          </div>


          {/* Upcoming Sessions */}
          <div className="mt-10 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4">
              Upcoming Sessions
            </h2>

            {loadingSessions ? (
              <div className="text-center py-6 text-gray-500">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No sessions scheduled.</div>
            ) : nextSession ? (
              <div className="border rounded-lg p-4 flex items-center justify-between bg-white">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {nextSession.title || 'Next Session'}: {formatShortDate(nextSession.scheduled_date ?? nextSession.started_at)}
                  </h3>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    Time: {nextSession.scheduled_date ? new Date(nextSession.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'} | Trainer: {nextSession.trainer?.name || nextSession.trainer_name || '—'}
                  </p>
                </div>

                <div className="ml-4">
                  <button
                    onClick={() => handleJoinSession(nextSession.session_id)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors"
                  >
                    Join Session
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* ✅ Assigned Home Programs */}
          <div className="mt-10 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4">
              Your Home Programs (HP)
            </h2>

            {loadingPrograms ? (
              <p className="text-gray-500">Loading assigned programs...</p>
            ) : learningPrograms.length === 0 ? (
              <p className="text-gray-500">No home programs assigned yet.</p>
            ) : (
              <div className="space-y-4">
                {learningPrograms.map((prog) => {
                  // Calculate completion percentage
                  const completionPercentage = prog.completion_percentage || 0;

                  return (
                    <div
                      key={prog.id}
                      className="p-5 rounded-lg border bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-1">
                            {prog.program_name || prog.name || 'Unnamed Program'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Assigned: {new Date(prog.assigned_at || prog.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                          onClick={() => navigate(`/learner/program-assignment/${prog.id}`)}
                        >
                          Start
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-600">Progress</span>
                          <span className="text-xs font-semibold text-blue-600">{completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${completionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ✅ Assigned Learning Contents */}
          <div id="learning-content-section" className="mt-10 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4">
              Your Assigned Learning Content
            </h2>

            {loadingContents ? (
              <p className="text-gray-500">Loading assigned contents...</p>
            ) : assignedContents.length === 0 ? (
              <p className="text-gray-500">No learning content assigned yet.</p>
            ) : (
              <div className="space-y-6">
                {assignedContents.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-5 rounded-lg border bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {assignment.content_title || 'Untitled Content'}
                    </h3>

                    <p className="text-sm text-gray-600 mb-2">
                      Type: {assignment.content_type} | Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                    </p>

                    {assignment.assigned_by_name && (
                      <p className="text-xs text-gray-500 mb-2">
                        Assigned by: {assignment.assigned_by_name}
                      </p>
                    )}

                    <button
                      className="mt-3 bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"
                      onClick={() => handleViewContent(assignment)}
                    >
                      View Content
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  {selectedContent?.content_title}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    {selectedContent?.content_type}
                  </span>
                  <span className="flex items-center gap-1">
                    📅 {new Date(selectedContent?.assigned_at).toLocaleDateString()}
                  </span>
                  {selectedContent?.assigned_by_name && (
                    <span className="flex items-center gap-1">
                      👤 {selectedContent.assigned_by_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a
                  href={selectedContent?.file_url?.startsWith('http') ? selectedContent.file_url : selectedContent?.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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

      <Footer />
    </div>
  );
};

export default LearnerDashboard;
