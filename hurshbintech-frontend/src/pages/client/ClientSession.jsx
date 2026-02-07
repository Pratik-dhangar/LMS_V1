// ClientSession.jsx
// Client session page - Mirrors LearnerSession.jsx
// Simplified version without prompt meter and voice prompt features

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import Whiteboard from '../../components/common/Whiteboard';
import MessageList from '../../components/common/MessageList';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useMessages from '../../hooks/useMessages';
import { useMediaControl } from '../../context/MediaControlContext';
import { FaBars, FaTimes } from 'react-icons/fa';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import {
  useAttendeeSessionState,
  formatTime,
  initializeAttendeeServices,
  cleanupAttendeeSession,
  createAnimationPopHandler,
  sendLeaveNotification
} from '../../utils/attendeeSession';


const ClientSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // Use shared session state hook
  const sessionState = useAttendeeSessionState();
  const {
    webRTC,
    setWebRTC,
    whiteboardService,
    setWhiteboardService,
    toolsService,
    setToolsService,
    isInitializingRef,
    localStream,
    setLocalStream,
    remoteStream,
    setRemoteStream,
    remoteVideoRef,
    micEnabled,
    setMicEnabled,
    cameraEnabled,
    setCameraEnabled,
    sessionInfo,
    setSessionInfo,
    loading,
    setLoading,
    connectionStatus,
    setConnectionStatus,
    instructorJoined,
    setInstructorJoined,
    timeLeft,
    setTimeLeft,
    canvasItems,
    setCanvasItems,
    keyboardMode,
    setKeyboardMode,
    keyboardText,
    setKeyboardText,
    keyboardPosition,
    setKeyboardPosition,
    remoteSelectedItemIds,
    setRemoteSelectedItemIds,
    textMessages,
    setTextMessages,
    feedbackMessage,
    setFeedbackMessage,
    waitingMessage,
    setWaitingMessage,
    floatingAnimations,
    setFloatingAnimations,
    isSidebarOpen,
    setIsSidebarOpen,
    isFrozen,
    setIsFrozen,
    showHeader,
    setShowHeader,
    headerTimeoutRef,
    erasePenTrigger,
    setErasePenTrigger,
    redrawCanvasTrigger,
    setRedrawCanvasTrigger,
    tool,
    setTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    buckets,
    setBuckets,
    textBoxes,
    setTextBoxes,
    activeTextBoxId,
    setActiveTextBoxId,
    toolAccess,
    setToolAccess,
    stopwatchElapsedTime,
    setStopwatchElapsedTime,
    stopwatchIsRunning,
    setStopwatchIsRunning
  } = sessionState;

  // Messages
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress,
    addReceivedMessage
  } = useMessages(webRTC, 'client');
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        addReceivedMessage({
          sender: message.sender === 'client' ? 'You' : 'Coach',
          text: message.text,
          timestamp: message.timestamp
        });
      };
    }
    return () => {
      if (webRTC) {
        webRTC.onMessage = null;
      }
    };
  }, [webRTC, addReceivedMessage]);

  // Listen for session end from coach
  useEffect(() => {
    if (!whiteboardService) return;

    whiteboardService.onSessionEnded = (data) => {
      console.log('[ClientSession] Session ended by coach:', data);
      toast.info('Session has been ended by the coach');

      // Clean up and redirect after a short delay
      setTimeout(() => {
        cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
        navigate('/my-appointments');
      }, 2000);
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onSessionEnded = null;
      }
    };
  }, [whiteboardService, webRTC, navigate, toolsService]);

  // Component mount - initialize session
  useEffect(() => {
    console.log('[ClientSession] Component mounted, sessionId:', sessionId);
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.error('[ClientSession] No user data found in localStorage');
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    console.log('[ClientSession] User data:', { id: user.id, role: user.role, name: user.name });

    // Prevent multiple initialization attempts
    if (initAttemptedRef.current) {
      console.log('[ClientSession] Initialization already attempted, skipping');
      return;
    }
    initAttemptedRef.current = true;

    // Initialize session
    initializeSession(user.id);

    return () => {
      console.log('[ClientSession] Component unmounting, cleaning up');
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
    };
  }, [sessionId, navigate]);

  // Connect remote stream to video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('[ClientSession] Connecting remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Countdown timer
  useEffect(() => {
    if (!sessionInfo || !sessionInfo.started_at || !sessionInfo.duration) return;

    const startTime = new Date(sessionInfo.started_at).getTime();
    const durationMs = sessionInfo.duration * 60 * 1000;
    const endTime = startTime + durationMs;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeLeft('00:00');
        clearInterval(intervalId);
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sessionInfo]);

  // Auto-hide header after 5 seconds on mobile/tablet
  useEffect(() => {
    if (showHeader) {
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
      headerTimeoutRef.current = setTimeout(() => {
        if (window.innerWidth < 1024) {
          setShowHeader(false);
        }
      }, 5000);
    }

    return () => {
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
    };
  }, [showHeader]);

  const handleHeaderClick = () => {
    setShowHeader(true);
  };

  const initializeSession = async (userId) => {
    try {
      const session = await coachSessionService.getSessionDetails(sessionId);
      console.log('[ClientSession] Session details:', session);
      setSessionInfo(session);

      // Call the shared utility with ClientSession-specific state
      await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'client', sessionState);

      // Custom keyboard handler for ClientSession
      if (whiteboardService) {
        whiteboardService.onTriggerKeyboard = () => {
          setKeyboardMode(true);
          setKeyboardText('');
          setKeyboardPosition({ x: 100, y: 100 });
          toast.info('Keyboard tool activated by coach');
        };
      }

      setLoading(false);
    } catch (error) {
      console.error('[ClientSession] Error initializing session:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to initialize session';
      toast.error(errorMsg);
      navigate('/my-appointments');
    }
  };

  const handleToggleMic = () => {
    if (webRTC) {
      const newState = webRTC.toggleMicrophone();
      setMicEnabled(newState);
    }
  };

  const handleToggleCamera = () => {
    if (webRTC) {
      const newState = webRTC.toggleCamera();
      setCameraEnabled(newState);
    }
  };

  const handleLeaveSession = () => {
    sendLeaveNotification(webRTC);
    cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
    navigate('/my-appointments');
  };

  const handleAnimationPop = createAnimationPopHandler(floatingAnimations, setFloatingAnimations, whiteboardService);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  // Show waiting overlay if coach hasn't joined yet and session is not yet started
  // Only show waiting screen if session status is 'scheduled', not 'in_progress'
  if (!loading && !instructorJoined && sessionInfo?.status === 'scheduled') {
    return (
      <div className={`learner-session-page ${pageClassName}`}>
        {/* Navigation / Header - Auto-hide on mobile after 5 seconds */}
        <div className={`session-header ${navbarClassName}`}>
          <div className="session-header-main">
            <div>
              <div className="session-header-title">HurshBin Client</div>
              <div className="session-header-subtitle">
                {sessionInfo?.title ?? 'Coach Session'} — Coach: {sessionInfo?.coach_name ?? 'Coach'}
              </div>
            </div>
            <div className="session-header-controls">
              <button
                className="btn-session btn-session-end"
                onClick={() => navigate('/my-appointments')}
              >
                🏠 Back to Appointments
              </button>
            </div>
          </div>
        </div>

        {/* Waiting Overlay */}
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 150px)' }}>
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
            <div className="text-6xl mb-4 animate-bounce">⏳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Waiting for Coach
            </h2>
            <p className="text-gray-600 mb-4">
              Your session is ready and you're connected!
            </p>
            <p className="text-gray-600 mb-6">
              Please wait while <strong>{sessionInfo?.coach_name ?? 'your coach'}</strong> joins the session.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-[#DB9D32] rounded-full animate-pulse"></div>
              <span>Connecting...</span>
            </div>
            {sessionInfo && (
              <div className="mt-6 p-4 bg-[#fef3e2] rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Session Details:</strong>
                </p>
                {sessionInfo?.duration && (
                  <p className="text-xs text-gray-600 mt-1">
                    ⏱️ Duration: {sessionInfo.duration} minutes
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`learner-session-page ${pageClassName}`} style={{
      width: '100%',
      height: '100vh',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* Learner Session Full-Width Layout */
        .learner-session-page {
          width: 100% !important;
          height: 100vh !important;
          display: flex !important;
          flex-direction: column !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          position: relative !important;
          overflow: hidden !important;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: 100% !important;
          width: 100% !important;
          overflow-x: hidden !important;
        }

        /* Session Header - Fixed at top */
        .session-header {
          flex-shrink: 0;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Main Container - Takes remaining height */
        .learner-main-container {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important;
          width: 100% !important;
          height: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 0 100px 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }

        /* Whiteboard Wrapper - Takes all remaining space */
        .learner-whiteboard-wrapper {
          flex: 1 !important;
          width: 100% !important;
          height: 100% !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          margin: 0 !important;
          padding: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }

        .session-whiteboard-container {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        /* Ensure inner divs fill the space */
        .learner-whiteboard-wrapper > div {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        .learner-whiteboard-wrapper .w-full {
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        .learner-whiteboard-wrapper canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }

        /* Hide sidebar toggles in full-width learner mode */
        .session-sidebar-toggles {
          display: none !important;
        }

        /* Mobile: Use dynamic viewport height (100dvh for modern browsers, 100vh fallback) */
        @media (max-width: 768px) {
          .learner-session-page {
            height: 100vh !important;
          }
        }

        /* Desktop: Use regular viewport height */
        @media (min-width: 769px) {
          .learner-session-page {
            height: 100vh !important;
            min-height: 100vh !important;
          }
        }
      `}</style>
      {/* Navigation / Header */}
      <div className={`session-header ${navbarClassName}`}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">HurshBin Client</div>
            <div className="session-header-subtitle">
              {sessionInfo?.title ?? 'Coach Session'} — Coach: {sessionInfo?.coach_name ?? 'Coach'}
            </div>
          </div>

          <div className="session-header-controls">
            <div className="session-header-info">
              Status: <strong>{connectionStatus}</strong>
            </div>
            <div className="session-header-info">
              Time Left: <strong>{timeLeft ?? '--:--'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container - Flexbox column layout */}
      <div className="learner-main-container">
        {/* Whiteboard - Fills remaining space */}
        <div className="learner-whiteboard-wrapper">
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="session-whiteboard-container">
              {/* Fixed Video Feed Overlay - Coach's Video (Top Right Corner) */}
              {remoteStream && (
                <div style={{
                  position: 'fixed',
                  top: '55px',
                  right: '2px',
                  width: 'clamp(120px, 15vw, 250px)',
                  height: 'clamp(90px, 12vw, 180px)',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  border: '2px solid #374151',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 100,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Video Stream */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                      flex: 1,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      backgroundColor: '#1a1a1a'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    Coach
                  </div>
                </div>
              )}

              {/* Whiteboard component */}
              <div className="w-full h-full">
                <Whiteboard
                  whiteboardService={whiteboardService}
                  isTrainer={false}
                  canvasItems={canvasItems}
                  setCanvasItems={setCanvasItems}
                  isFrozen={false}
                  isPaused={false}
                  toolAccess={toolAccess}
                  remoteSelectedItemIds={remoteSelectedItemIds}
                  textMessages={textMessages}
                  setTextMessages={setTextMessages}
                  feedbackMessage={feedbackMessage}
                  waitingMessage={waitingMessage}
                  floatingAnimations={floatingAnimations}
                  onAnimationPop={handleAnimationPop}
                  erasePenTrigger={erasePenTrigger}
                  redrawCanvasTrigger={redrawCanvasTrigger}
                  buckets={buckets}
                  setBuckets={setBuckets}
                  textBoxes={textBoxes}
                  activeTextBoxId={activeTextBoxId}
                  setActiveTextBoxId={setActiveTextBoxId}
                  tool={tool}
                  setTool={setTool}
                  color={color}
                  setColor={setColor}
                  lineWidth={lineWidth}
                  setLineWidth={setLineWidth}
                  keyboardMode={keyboardMode}
                  keyboardText={keyboardText}
                  setKeyboardText={setKeyboardText}
                  keyboardPosition={keyboardPosition}
                  setKeyboardPosition={setKeyboardPosition}
                  stopwatchFormattedTime={stopwatchElapsedTime > 0 ? formatTime(stopwatchElapsedTime).display : null}
                  stopwatchIsRunning={stopwatchIsRunning}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Controls - Bottom Center - Outside main container */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '12px',
        zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '12px 16px',
        borderRadius: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button
          onClick={handleToggleMic}
          className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            gap: '6px',
            border: 'none',
            cursor: 'pointer'
          }}
          title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
        >
          <span>{micEnabled ? '🎤 Mic On' : '🔇 Mic Off'}</span>
        </button>
        <button
          onClick={handleToggleCamera}
          className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            gap: '6px',
            border: 'none',
            cursor: 'pointer'
          }}
          title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          <span>{cameraEnabled ? '📹 Video On' : '📷 Video Off'}</span>
        </button>
        <button
          onClick={handleLeaveSession}
          className="bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center transition-all duration-200 shadow-md"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            gap: '6px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          🚪 Leave Session
        </button>
      </div>
    </div>
  );
};

export default ClientSession;
