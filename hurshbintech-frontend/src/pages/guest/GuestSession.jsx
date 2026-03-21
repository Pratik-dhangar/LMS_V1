// GuestSession.jsx
// Guest session page for non-authenticated users
// Token-based authentication - Simplified with shared components

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import Whiteboard from '../../components/common/Whiteboard';
import Exercise from '../../components/session/Exercise';
import { useMediaControl } from '../../context/MediaControlContext';
import sessionService from '../../api/services/sessionService';
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
  AttendeeSessionRoot,
  AttendeeUpperSection,
  AttendeeWhiteboardSection,
  AttendeeWhiteboardWithVideo,
  DrawColorPalette,
  AttendeeWaitingScreen,
  AttendeeWaitingModal,
  usePromptAnimation,
  useBulbGlowAnimation,
  attendeeSessionStyles,
  SessionFeedbackModal
} from '../../components/session/AttendeeSessionLayout';


const GuestSession = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

  // Shared session state
  const sessionState = useAttendeeSessionState();
  const {
    webRTC, setWebRTC,
    whiteboardService, setWhiteboardService,
    toolsService, setToolsService,
    isInitializingRef,
    localStream, setLocalStream,
    remoteStream, setRemoteStream,
    remoteVideoRef,
    micEnabled, setMicEnabled,
    cameraEnabled, setCameraEnabled,
    sessionInfo, setSessionInfo,
    loading, setLoading,
    connectionStatus, setConnectionStatus,
    instructorJoined, setInstructorJoined,
    timeLeft, setTimeLeft,
    canvasItems, setCanvasItems,
    keyboardMode, setKeyboardMode,
    keyboardText, setKeyboardText,
    keyboardPosition, setKeyboardPosition,
    remoteSelectedItemIds, setRemoteSelectedItemIds,
    textMessages, setTextMessages,
    feedbackMessage, setFeedbackMessage,
    waitingMessage, setWaitingMessage,
    floatingAnimations, setFloatingAnimations,
    isSidebarOpen, setIsSidebarOpen,
    isFrozen, setIsFrozen,
    showHeader, setShowHeader,
    headerTimeoutRef,
    erasePenTrigger, setErasePenTrigger,
    redrawCanvasTrigger, setRedrawCanvasTrigger,
    tool, setTool,
    color, setColor,
    lineWidth, setLineWidth,
    buckets, setBuckets,
    textBoxes, setTextBoxes,
    activeTextBoxId, setActiveTextBoxId,
    toolAccess, setToolAccess,
    stopwatchElapsedTime, setStopwatchElapsedTime,
    stopwatchIsRunning, setStopwatchIsRunning,
    backgroundMusicPlaying,
    selectedMusic,
    musicVolume,
    audioRef,
    promptMeter, setPromptMeter,
    reinforcementMeter, setReinforcementMeter,
    bucketColor, setBucketColor,
    promptText, setPromptText,
    trainerComments, setTrainerComments,
    isCommentsOpen, setIsCommentsOpen
  } = sessionState;

  // Guest-specific state
  const [guestInfo, setGuestInfo] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [awaitingAdmission, setAwaitingAdmission] = useState(false); // Waiting for coach to admit
  const [admissionDenied, setAdmissionDenied] = useState(false); // Coach rejected the join request
  const [showExercise, setShowExercise] = useState(false);
  const [exerciseData, setExerciseData] = useState({ question: '', answer: '' });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const authAttemptedRef = useRef(false);
  const pollingIntervalRef = useRef(null);
  const pendingCleanupRef = useRef(null);
  const mediaControl = useMediaControl();

  // Use shared animation hooks
  const { isPromptLineOpen, setIsPromptLineOpen, promptLineAnimating } = usePromptAnimation(promptText);
  const isBulbGlowing = useBulbGlowAnimation(bucketColor);

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

  // Exercise handlers
  // Debounce timer for exercise answer updates
  const exerciseAnswerDebounceRef = useRef(null);

  const handleExerciseUpdate = (response) => {
    console.log('[GuestSession] Exercise update received:', response);
    setExerciseData({
      question: response.question || '',
      answer: response.answer || '',
      learnerAnswer: response.learnerAnswer || response.answer || ''
    });

    // Debounced send answer to coach (avoid per-keystroke sends)
    if (response.learnerAnswer !== undefined && whiteboardService) {
      if (exerciseAnswerDebounceRef.current) {
        clearTimeout(exerciseAnswerDebounceRef.current);
      }

      exerciseAnswerDebounceRef.current = setTimeout(() => {
        whiteboardService.send('exercise_answer_update', {
          question: response.question || '',
          answer: response.learnerAnswer,
          learnerAnswer: response.learnerAnswer,
          timestamp: Date.now()
        });
        console.log('[GuestSession] Answer sent to coach:', response.learnerAnswer);
        exerciseAnswerDebounceRef.current = null;
      }, 500); // Send after 500ms of inactivity
    }

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

  // Cleanup exercise debounce on unmount
  useEffect(() => {
    return () => {
      if (exerciseAnswerDebounceRef.current) {
        clearTimeout(exerciseAnswerDebounceRef.current);
        exerciseAnswerDebounceRef.current = null;
      }
    };
  }, []);

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

  // Listen for session end from coach
  useEffect(() => {
    if (!whiteboardService) return;

    whiteboardService.onSessionEnded = (data) => {
      console.log('[GuestSession] Session ended by coach:', data);
      toast.info('Session has been ended by the coach');
      setShowFeedbackModal(true);
      pendingCleanupRef.current = () => {
        cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
        navigate('/');
      };
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
        setShowWaitingModal(false);
        setLoading(false);
        setAwaitingAdmission(true); // Show awaiting-admission screen until coach's offer arrives
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

      await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'guest', sessionState);
      setShowWaitingModal(false);
      setLoading(false);
      setAwaitingAdmission(true); // Show awaiting-admission screen until coach's offer arrives
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
                await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'guest', sessionState);
                setShowWaitingModal(false);
                setLoading(false);
                setAwaitingAdmission(true); // Show awaiting-admission screen until coach's offer arrives
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

  // Connect remote stream to video element; clear awaiting gate when stream arrives
  useEffect(() => {
    if (remoteStream) {
      setAwaitingAdmission(false);
    }
    if (remoteStream && remoteVideoRef.current) {
      console.log('[GuestSession] Connecting remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, awaitingAdmission]);

  // Detect admission rejection or removal from coach via waiting_message signal
  useEffect(() => {
    if (waitingMessage === '__ADMISSION_REJECTED__') {
      setAdmissionDenied(true);
      setAwaitingAdmission(false);
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
      setTimeout(() => navigate('/'), 2000);
    } else if (waitingMessage === '__REMOVED_FROM_SESSION__') {
      toast.warning('You have been removed from the session by the coach.');
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
      setTimeout(() => navigate('/'), 1500);
    }
  }, [waitingMessage, navigate]);

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
        toast.info('Session time has ended.');

        // Auto-end: cleanup and redirect
        setTimeout(() => {
          try {
            cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
          } catch (error) {
            console.error('[GuestSession] Error during auto-end cleanup:', error);
          }
          navigate('/');
        }, 1500);
        return;
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sessionInfo, webRTC, whiteboardService, toolsService, isInitializingRef, navigate]);

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

  const handleHeaderClick = () => setShowHeader(true);

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
    if (webRTC && webRTC.socket && webRTC.socket.readyState === WebSocket.OPEN) {
      webRTC.socket.send(JSON.stringify({
        type: 'attendee_left',
        role: 'guest',
        name: guestInfo?.name || 'Guest'
      }));
    }
    cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
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

  // Admission denied by coach
  if (admissionDenied) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', background: '#f8f8f8' }}>
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🚫</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            Your request to join the session was not accepted by the coach.
          </p>
          <p className="text-sm text-gray-500">Redirecting you back...</p>
        </div>
      </div>
    );
  }

  // Waiting for coach to admit
  if (awaitingAdmission) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', background: '#f8f8f8' }}>
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Awaiting Instructor</h2>
          <p className="text-gray-600 mb-2">
            You have joined the session. Please wait for your instructor to admit you.
          </p>
          <p className="text-gray-600 mb-6">
            <strong>{sessionInfo?.coach_name ?? 'Your instructor'}</strong> will admit you shortly.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-[#DB9D32] rounded-full animate-pulse"></div>
            <span>Waiting for admission...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show waiting screen if instructor hasn't joined
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
    <AttendeeSessionRoot pageClassName={pageClassName} audioRef={audioRef}>
      {/* Upper Section: Metrics (20%) | Prompt (60%) | Video (20%) */}
      <AttendeeUpperSection
        // Metrics Panel Props
        promptMeter={promptMeter}
        reinforcementMeter={reinforcementMeter}
        bucketColor={bucketColor}

        // Prompt Panel Props
        promptText={promptText}
        isCommentsOpen={isCommentsOpen}
        commentInput={commentInput}
        setCommentInput={setCommentInput}
        onSendComment={debouncedSendComment}
        onFlushComment={flushSendComment}
        exerciseData={exerciseData}
        showExercise={showExercise}
        Exercise={Exercise}
        whiteboardService={whiteboardService}
        onExerciseSubmit={handleExerciseSubmit}
        onExerciseUpdate={handleExerciseUpdate}
        onExerciseDelete={handleExerciseDelete}

        // Video Panel Props
        remoteVideoRef={remoteVideoRef}
        remoteStream={remoteStream}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onLeaveSession={handleLeaveSession}
        videoLabel="Coach"
        showVideoControls={true}

        sessionType="guest"
      />

      {/* Main Container - Whiteboard */}
      <div className="learner-main-container">
        <AttendeeWhiteboardSection>
          <div className="w-full h-full" style={{ position: 'relative' }}>
            <DrawColorPalette
              toolAccess={toolAccess}
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
            />
            <Whiteboard
              whiteboardService={whiteboardService}
              isTrainer={false}
              canvasItems={canvasItems}
              setCanvasItems={setCanvasItems}
              isFrozen={isFrozen}
              isPaused={false}
              toolAccess={toolAccess}
              remoteSelectedItemIds={remoteSelectedItemIds}
              setRemoteSelectedItemIds={setRemoteSelectedItemIds}
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
        </AttendeeWhiteboardSection>
      </div>

      {/* Waiting Modal */}
      <AttendeeWaitingModal
        show={showWaitingModal}
        title="Waiting for Coach"
        description="The coach is starting the session. You'll be automatically added once they begin! ✨"
        retrying={retrying}
        onRetry={handleRetryJoin}
        onCancel={() => {
          setShowWaitingModal(false);
          navigate('/');
        }}
      />
      {showFeedbackModal && (
        <SessionFeedbackModal
          onSubmit={async (rating, remark) => {
            try {
              // guests use token-based session; submit without auth
              const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
              await fetch(`${API_URL}/sessions/${sessionInfo?.session_id}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, remark: remark || null, attendee_role: 'guest', attendee_name: sessionInfo?.learner_name || null }),
              });
              toast.success('Thank you for your feedback!');
            } catch {
              // silently ignore
            }
            setShowFeedbackModal(false);
            if (pendingCleanupRef.current) pendingCleanupRef.current();
          }}
          onSkip={() => {
            setShowFeedbackModal(false);
            if (pendingCleanupRef.current) pendingCleanupRef.current();
          }}
        />
      )}
    </AttendeeSessionRoot>
  );
};

export default GuestSession;
