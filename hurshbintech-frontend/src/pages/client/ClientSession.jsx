// ClientSession.jsx
// Client session page - Mirrors LearnerSession.jsx
// Simplified version without prompt meter and voice prompt features

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import { markSessionActive } from '../../utils/sessionActivityTracker';
import Whiteboard from '../../components/common/Whiteboard';
import Exercise from '../../components/session/Exercise';
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
    setStopwatchIsRunning,
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
    setIsCommentsOpen,
    audioRef
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

  // Messages
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress,
    addReceivedMessage
  } = useMessages(webRTC, 'client');

  // Comment send functions (using shared utility)
  const [commentInput, setCommentInput] = useState('');
  const commentHandlerRef = useRef(null);

  useEffect(() => {
    // Initialize comment handler with shared utility
    commentHandlerRef.current = createCommentSendHandler(whiteboardService, 'client');
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
    console.log('[ClientSession] Exercise update received:', response);
    setExerciseData({
      question: response.question || '',
      answer: response.answer || ''
    });
    if (response.question) {
      setShowExercise(true);
      console.log('[ClientSession] Exercise opened');
    }
  };

  const handleExerciseSubmit = (response) => {
    console.log('[ClientSession] Exercise response submitted:', response);
    // Send answer back to coach
    if (response.status === 'submitted' && whiteboardService) {
      whiteboardService.send('exercise_answer_update', {
        question: response.question,
        answer: response.answer,
        timestamp: Date.now()
      });
      console.log('[ClientSession] Exercise answer sent to coach');
    }
  };

  const handleExerciseDelete = () => {
    console.log('[ClientSession] Exercise closed');
    setShowExercise(false);
    setExerciseData({ question: '', answer: '' });
  };

  // Setup exercise listeners
  useEffect(() => {
    if (!whiteboardService) return;

    whiteboardService.onExerciseUpdate = (data) => {
      console.log('[ClientSession] onExerciseUpdate fired with:', data);
      handleExerciseUpdate(data);
    };

    whiteboardService.onExerciseClosed = (data) => {
      console.log('[ClientSession] onExerciseClosed fired');
      handleExerciseDelete();
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onExerciseUpdate = null;
        whiteboardService.onExerciseClosed = null;
      }
    };
  }, [whiteboardService]);

  const initAttemptedRef = useRef(false);
  const pollingIntervalRef = useRef(null);
  const restrictionAlertShownRef = useRef(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
      try {
        await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'client', sessionState);
      } catch (err) {
        const errMsg = err.response?.data?.detail || err.message || '';
        const lower = errMsg.toLowerCase();
        // If session is not active yet or not created, show waiting modal and start polling
        if ((err.response?.status === 400 || err.response?.status === 404) && (lower.includes('not active') || lower.includes('not been created') || lower.includes('not been created yet') || lower.includes('not created') || lower.includes('has not been created'))) {
          setShowWaitingModal(true);
          setLoading(false);
          return;
        }
        throw err;
      }

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
      // If session is not active or not created yet, show waiting modal instead of redirect/error
      const lower = errorMsg.toLowerCase();
      const isWaiting = ((error.response?.status === 400 || error.response?.status === 404) && (lower.includes('not active') || lower.includes('not been created') || lower.includes('not been created yet') || lower.includes('not created') || lower.includes('has not been created')));
      if (isWaiting) {
        setShowWaitingModal(true);
        setLoading(false);
        return;
      }

      toast.error(errorMsg);
      navigate('/my-appointments');
    }
  };

  // Handle retry when coach/trainer starts session
  const handleRetryJoin = async () => {
    setRetrying(true);
    try {
      const session = await coachSessionService.getSessionDetails(sessionId);
      setSessionInfo(session);

      const sessionCheck = markSessionActive(sessionId, 'client');
      if (!sessionCheck.success) {
        if (!restrictionAlertShownRef.current) {
          restrictionAlertShownRef.current = true;
          toast.error(sessionCheck.message);
          navigate('/my-appointments');
        }
        setRetrying(false);
        return;
      }

      await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'client', sessionState);
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

  // Auto-join when coach/trainer starts session
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
        const session = await coachSessionService.getSessionDetails(sessionId);
        const isActive = session.status === 'ACTIVE' || session.status === 'active';
        if (isActive) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;

          setTimeout(async () => {
            setRetrying(true);
            try {
              const sessionCheck = markSessionActive(sessionId, 'client');
              if (!sessionCheck.success) {
                if (!restrictionAlertShownRef.current) {
                  restrictionAlertShownRef.current = true;
                  toast.error(sessionCheck.message);
                  navigate('/my-appointments');
                }
                setRetrying(false);
                return;
              }

              await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'client', sessionState);
              setShowWaitingModal(false);
              setLoading(false);
            } catch (error) {
              setRetrying(false);
            }
          }, 300);
        }
      } catch (error) {
      }
    }, 10000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [showWaitingModal, sessionId, navigate]);

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
  if (!loading && !instructorJoined && (sessionInfo?.status === 'scheduled' || showWaitingModal)) {
    return (
      <AttendeeWaitingScreen
        sessionInfo={sessionInfo}
        attendeeName={sessionInfo?.client_name || 'Client'}
        onBackClick={() => navigate('/my-appointments')}
        backButtonText="Back to Appointments"
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
        {/* Bucket Color - Bulb with Glow */}
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
        sessionType="client"
      />

      {/* Background Music Audio Element */}
      <audio ref={audioRef} crossOrigin="anonymous" />
    </div>
  );
};

export default ClientSession;
