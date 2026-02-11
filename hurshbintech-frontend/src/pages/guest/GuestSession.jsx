// GuestSession.jsx
// Guest session page for non-authenticated users
// Based on ClientSession.jsx but uses token-based authentication instead of user auth

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import Whiteboard from '../../components/common/Whiteboard';
import Exercise from '../../components/session/Exercise';
import { useMediaControl } from '../../context/MediaControlContext';
import sessionService from '../../api/services/sessionService';
import { markSessionActive } from '../../utils/sessionActivityTracker';
import { FaBars, FaTimes } from 'react-icons/fa';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import {
  useAttendeeSessionState,
  formatTime,
  initializeAttendeeServices,
  cleanupAttendeeSession,
  createAnimationPopHandler,
  createCommentSendHandler,
  setupAttendeeCommentListeners
} from '../../utils/attendeeSession';
import {
  AttendeeWaitingScreen,
  AttendeeVideoControls,
  RemoteVideoFeed,
  AttendeeCommentsPanel,
  attendeeSessionStyles
} from '../../components/session/AttendeeSessionLayout';


const GuestSession = () => {
  const { token } = useParams(); // Guest session token from URL
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

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
    setStopwatchIsRunning,
    backgroundMusicPlaying,
    selectedMusic,
    musicVolume,
    audioRef,
    promptMeter,
    setPromptMeter,
    reinforcementMeter,
    setReinforcementMeter,
    bucketColor,
    setBucketColor,
    promptText,
    setPromptText,
    trainerComments,
    setTrainerComments,
    isCommentsOpen,
    setIsCommentsOpen
  } = sessionState;

  // Prompt line UI states
  const [isPromptLineOpen, setIsPromptLineOpen] = useState(false);
  const [promptLineAnimating, setPromptLineAnimating] = useState(false);

  // Update prompt text handler
  useEffect(() => {
    if (!promptText || promptText === '[Prompts from instructor will appear here]') return;

    // Auto-open Prompt Line when new prompt is received
    setIsPromptLineOpen(true);

    // Trigger animation
    setPromptLineAnimating(true);
    setTimeout(() => {
      setPromptLineAnimating(false);
    }, 2000);
  }, [promptText]);

  // Bulb glow animation state
  const [isBulbGlowing, setIsBulbGlowing] = useState(false);
  const bulbGlowTimerRef = useRef(null);

  // Trigger bulb glow when bucket color changes
  useEffect(() => {
    if (bucketColor) {
      setIsBulbGlowing(true);
      if (bulbGlowTimerRef.current) {
        clearTimeout(bulbGlowTimerRef.current);
      }
      bulbGlowTimerRef.current = setTimeout(() => {
        setIsBulbGlowing(false);
      }, 2000);
    }
    return () => {
      if (bulbGlowTimerRef.current) {
        clearTimeout(bulbGlowTimerRef.current);
      }
    };
  }, [bucketColor]);

  // Comment send functions (using shared utility)
  const [commentInput, setCommentInput] = useState('');
  const commentHandlerRef = useRef(null);

  useEffect(() => {
    // Initialize comment handler with shared utility
    commentHandlerRef.current = createCommentSendHandler(whiteboardService, 'guest');
    return () => {
      if (commentHandlerRef.current) {
        commentHandlerRef.current.cleanup();
      }
    };
  }, [whiteboardService]);

  const debouncedSendComment = (message) => {
    if (commentHandlerRef.current) {
      commentHandlerRef.current.sendComment(message);
    }
  };

  const flushSendComment = (message) => {
    if (commentHandlerRef.current) {
      commentHandlerRef.current.flushComment(message);
    }
  };

  // Setup comment listeners (using shared utility)
  useEffect(() => {
    if (!whiteboardService) return;
    const cleanup = setupAttendeeCommentListeners(whiteboardService, setTrainerComments, setIsCommentsOpen);
    return cleanup;
  }, [whiteboardService]);

  // Exercise state
  const [showExercise, setShowExercise] = useState(false);
  const [exerciseData, setExerciseData] = useState({ question: '', answer: '' });

  // Exercise handlers
  const handleExerciseUpdate = (response) => {
    console.log('[GuestSession] Exercise update received:', response);
    setExerciseData({
      question: response.question || '',
      answer: response.answer || ''
    });
    if (response.question) {
      setShowExercise(true);
      console.log('[GuestSession] Exercise opened');
    }
  };

  const handleExerciseSubmit = (response) => {
    console.log('[GuestSession] Exercise response submitted:', response);
    // Send answer back to coach
    if (response.status === 'submitted' && whiteboardService) {
      whiteboardService.send('exercise_answer_update', {
        question: response.question,
        answer: response.answer,
        timestamp: Date.now()
      });
      console.log('[GuestSession] Exercise answer sent to coach');
    }
  };

  const handleExerciseDelete = () => {
    console.log('[GuestSession] Exercise closed');
    setShowExercise(false);
    setExerciseData({ question: '', answer: '' });
  };

  // Setup exercise listeners
  useEffect(() => {
    if (!whiteboardService) return;

    whiteboardService.onExerciseUpdate = (data) => {
      console.log('[GuestSession] onExerciseUpdate fired with:', data);
      handleExerciseUpdate(data);
    };

    whiteboardService.onExerciseClosed = (data) => {
      console.log('[GuestSession] onExerciseClosed fired');
      handleExerciseDelete();
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onExerciseUpdate = null;
        whiteboardService.onExerciseClosed = null;
      }
    };
  }, [whiteboardService]);

  // Guest-specific state
  const [guestInfo, setGuestInfo] = useState(null);
  const [authError, setAuthError] = useState(null);
  const authAttemptedRef = useRef(false);
  const pollingIntervalRef = useRef(null);
  const restrictionAlertShownRef = useRef(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const mediaControl = useMediaControl();

  // Listen for session end from coach
  useEffect(() => {
    if (!whiteboardService) return;

    whiteboardService.onSessionEnded = (data) => {
      console.log('[GuestSession] Session ended by coach:', data);
      toast.info('Session has been ended by the coach');

      // Clean up and redirect after a short delay
      setTimeout(() => {
        cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
        navigate('/');
      }, 2000);
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onSessionEnded = null;
      }
    };
  }, [whiteboardService, webRTC, navigate, toolsService]);

  // Component mount - authenticate guest and initialize session
  useEffect(() => {
    console.log('[GuestSession] Component mounted, token:', token);

    if (!token) {
      toast.error('Invalid session link');
      setAuthError('No session token provided');
      setLoading(false);
      return;
    }

    // Prevent multiple authentication attempts
    if (authAttemptedRef.current) {
      console.log('[GuestSession] Authentication already attempted, skipping');
      return;
    }
    authAttemptedRef.current = true;

    // Authenticate guest with token
    authenticateGuestSession();

    return () => {
      console.log('[GuestSession] Component unmounting, cleaning up');
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
    };
  }, [token]);

  // Authenticate guest session with backend
  const authenticateGuestSession = async () => {
    try {
      console.log('[GuestSession] Authenticating with token...');
      const response = await axios.post(`${API_BASE_URL}/guest-sessions/auth`, {
        token: token
      });

      const sessionData = response.data;
      console.log('[GuestSession] Authentication successful:', sessionData);

      setSessionInfo(sessionData);
      setGuestInfo({
        name: sessionData.guest_name,
        email: sessionData.guest_email
      });

      // Initialize WebRTC and Whiteboard with the session_id
      try {
        await initializeAttendeeServices(WS_BASE_URL, sessionData.session_id, 'guest', sessionState);
        setLoading(false);
      } catch (err) {
        const errMsg = err.response?.data?.detail || err.message || '';
        if (err.response?.status === 400 && errMsg.includes('not active')) {
          setShowWaitingModal(true);
          setLoading(false);
          return;
        }
        throw err;
      }
    } catch (error) {
      console.error('[GuestSession] Authentication failed:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to authenticate session';
      // If session hasn't been created or is not active yet, show waiting modal instead of error
      const lower = errorMsg.toLowerCase();
      const isWaiting = ((error.response?.status === 400 || error.response?.status === 404) && (lower.includes('not active') || lower.includes('not been created') || lower.includes('not been created yet') || lower.includes('not created') || lower.includes('not created yet') || lower.includes('has not been created')));
      if (isWaiting) {
        setShowWaitingModal(true);
        setLoading(false);
      } else {
        setAuthError(errorMsg);
        toast.error(errorMsg);
        setLoading(false);
      }
    }
  };

  // Handle retry when coach/trainer starts session
  const handleRetryJoin = async () => {
    setRetrying(true);
    try {
      const sessionIdInternal = sessionInfo?.session_id;
      if (!sessionIdInternal) {
        setRetrying(false);
        return;
      }

      const session = await sessionService.getSessionDetails(sessionIdInternal);
      setSessionInfo(session);

      const sessionCheck = markSessionActive(sessionIdInternal, 'guest');
      if (!sessionCheck.success) {
        if (!restrictionAlertShownRef.current) {
          restrictionAlertShownRef.current = true;
          toast.error(sessionCheck.message);
          navigate('/');
        }
        setRetrying(false);
        return;
      }

      await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'guest', sessionState);
      setShowWaitingModal(false);
      setLoading(false);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to join session';
      if (!(error.response?.status === 400 && errorMessage.includes('not active'))) {
        toast.error(`Still waiting: ${errorMessage}`);
      }
      setRetrying(false);
    }
  };

  // Auto-join when coach starts session - unified polling logic
  // Handles both cases:
  // 1. Session exists but not active yet - polls getSessionDetails()
  // 2. Session not created yet - retries guest authentication
  useEffect(() => {
    if (!showWaitingModal) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Case 1: Session exists, check if it's now active
        if (sessionInfo?.session_id) {
          const session = await sessionService.getSessionDetails(sessionInfo.session_id);
          const isActive = session.status === 'ACTIVE' || session.status === 'active';

          if (isActive) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;

            setTimeout(async () => {
              setRetrying(true);
              try {
                const sessionCheck = markSessionActive(sessionInfo.session_id, 'guest');
                if (!sessionCheck.success) {
                  if (!restrictionAlertShownRef.current) {
                    restrictionAlertShownRef.current = true;
                    toast.error(sessionCheck.message);
                    navigate('/');
                  }
                  setRetrying(false);
                  return;
                }

                await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'guest', sessionState);
                setShowWaitingModal(false);
                setLoading(false);
              } catch (error) {
                setRetrying(false);
              }
            }, 300);
          }
        } else {
          // Case 2: Session not created yet, retry authentication
          try {
            console.log('[GuestSession] Retrying guest authentication (session not created yet)...');
            await authenticateGuestSession();
            // If authenticateGuestSession succeeds it will clear the waiting modal
          } catch (err) {
            // Silently continue polling
          }
        }
      } catch (error) {
        // Silently continue polling for session updates
      }
    }, 10000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [showWaitingModal, sessionInfo, navigate]);

  // Connect remote stream to video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('[GuestSession] Connecting remote stream to video element');
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
    // Redirect to a thank you page or home
    window.location.href = '/';
  };

  const handleAnimationPop = createAnimationPopHandler(floatingAnimations, setFloatingAnimations, whiteboardService);

  // Show error screen if authentication failed
  if (authError) {
    return (
      <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Session Access Error</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>{authError}</p>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#DB9D32',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Verifying session access...</p>
      </div>
    );
  }

  // Show waiting overlay if coach hasn't joined yet and session is not yet started
  // Only show waiting screen if session status is 'scheduled', not 'in_progress'
  if (!loading && !instructorJoined && (sessionInfo?.status === 'scheduled' || showWaitingModal)) {
    return (
      <AttendeeWaitingScreen
        sessionInfo={sessionInfo}
        attendeeName={guestInfo?.name || 'Guest'}
        onBackClick={() => window.location.href = '/'}
        backButtonText="Back to Home"
        pageClassName={pageClassName}
        navbarClassName={navbarClassName}
        localVideoRef={remoteVideoRef}
        localStream={localStream}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
      />
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
      {/* Hidden audio element for background music */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
      <style>{attendeeSessionStyles}</style>


      {/* Metrics Header - Full width (P:, R:, Bucket Color) - ✅ Responsive */}
      <div className="learner-metrics-header" style={{
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        gap: 'clamp(6px, 1.5vw, 12px)',
        padding: 'clamp(6px, 1.2vh, 8px) clamp(6px, 1.2vw, 8px)',
        backgroundColor: 'white',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        flexWrap: 'wrap',
        margin: '0',
        width: '100%',
        boxSizing: 'border-box',
        fontSize: 'clamp(10px, 1.8vw, 12px)'
      }}>
        {/* Divider */}
        <div style={{ width: '1px', height: 'clamp(16px, 3vh, 24px)', backgroundColor: '#d1d5db' }}></div>

        {/* Prompt Level */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.8vw, 6px)' }}>
          <span style={{ fontWeight: 'bold', fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#d97706' }}>P:</span>
          <span style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 'bold', color: '#d97706' }}>{promptMeter ?? 0}</span>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: 'clamp(16px, 3vh, 24px)', backgroundColor: '#d1d5db' }}></div>

        {/* Reinforcement Level */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.8vw, 6px)' }}>
          <span style={{ fontWeight: 'bold', fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#16a34a' }}>R:</span>
          <span style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 'bold', color: '#16a34a' }}>{reinforcementMeter ?? 0}</span>
        </div>



        {/* Divider */}
        <div style={{ width: '1px', height: 'clamp(16px, 3vh, 24px)', backgroundColor: '#d1d5db' }}></div>

        {/* Prompt Line with Bulb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.2vw, 8px)' }}>
          <span
            onClick={() => setIsPromptLineOpen(!isPromptLineOpen)}
            style={{
              fontSize: 'clamp(20px, 3.5vw, 24px)',
              cursor: 'pointer',
              filter: promptLineAnimating ? 'drop-shadow(0 0 12px #fbbf24) drop-shadow(0 0 20px rgba(251, 191, 36, 0.6))' : promptText !== '[Prompts from instructor will appear here]' ? 'drop-shadow(0 0 8px #fbbf24)' : 'none',
              animation: promptLineAnimating ? 'pulse 1.5s ease-in-out infinite' : 'none',
              transition: 'filter 0.3s ease, transform 0.2s ease',
              transform: isPromptLineOpen ? 'scale(1.1)' : 'scale(1)',
              userSelect: 'none'
            }}
          >
            💡
          </span>
          {isPromptLineOpen && (
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: 'clamp(4px, 0.8vw, 6px)',
              padding: 'clamp(6px, 1.2vw, 8px) clamp(8px, 1.5vw, 12px)',
              border: promptText !== '[Prompts from instructor will appear here]' ? '2px solid #fbbf24' : '1px solid #e5e7eb',
              maxWidth: 'clamp(200px, 40vw, 300px)',
              transition: 'border 0.3s ease'
            }}>
              <p style={{
                fontSize: 'clamp(10px, 1.8vw, 12px)',
                color: '#374151',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {promptText !== '[Prompts from instructor will appear here]' ? promptText : 'Waiting for prompt...'}
              </p>
            </div>
          )}
          {/* Video Controls (moved to centered overlay below) */}
        </div>

        {/* Centered Video Controls - absolute centered within metrics header */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 60,
          pointerEvents: 'auto'
        }}>
          <AttendeeVideoControls
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onLeaveSession={handleLeaveSession}
          />
        </div>
      </div>

      {/* Main Container - Flexbox column layout */}
      <div className="learner-main-container">
        {/* Whiteboard - Fills remaining space */}
        <div className="learner-whiteboard-wrapper">
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="session-whiteboard-container">
              {/* Remote Video Feed - Coach */}
              <RemoteVideoFeed
                remoteVideoRef={remoteVideoRef}
                remoteStream={remoteStream}
                topPosition="4px"
                label="Coach"
              />

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

        {/* Exercise Tool */}
        {showExercise && (
          <div className="exercise-tool-container" style={{ marginTop: '20px', padding: '0 10px', position: 'relative' }}>
            <Exercise
              isTrainer={false}
              onExerciseSubmit={handleExerciseSubmit}
              onExerciseUpdate={() => { }}
              onExerciseDelete={handleExerciseDelete}
              onAnswerChange={() => { }}
              whiteboardService={whiteboardService}
              initialExercise={exerciseData.question ? exerciseData : null}
            />
          </div>
        )}
      </div>

      {/* Comments Panel */}
      <AttendeeCommentsPanel
        isOpen={isCommentsOpen}
        setIsOpen={setIsCommentsOpen}
        trainerComments={trainerComments}
        commentInput={commentInput}
        setCommentInput={setCommentInput}
        onSendComment={debouncedSendComment}
        onFlushComment={flushSendComment}
        sessionType="guest"
      />

      {/* Background Music Audio Element */}
      <audio ref={audioRef} crossOrigin="anonymous" />

    </div>
  );
};

export default GuestSession;
