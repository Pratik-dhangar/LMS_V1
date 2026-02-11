// ClientSession.jsx
// Client session page - Simplified with shared components

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
  AttendeeWaitingScreen,
  AttendeeWaitingModal,
  usePromptAnimation,
  useBulbGlowAnimation,
  attendeeSessionStyles
} from '../../components/session/AttendeeSessionLayout';


const ClientSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

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
    promptMeter, setPromptMeter,
    reinforcementMeter, setReinforcementMeter,
    bucketColor, setBucketColor,
    promptText, setPromptText,
    trainerComments, setTrainerComments,
    isCommentsOpen, setIsCommentsOpen,
    audioRef
  } = sessionState;

  // Client-specific state
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showExercise, setShowExercise] = useState(false);
  const [exerciseData, setExerciseData] = useState({ question: '', answer: '' });

  const pollingIntervalRef = useRef(null);
  const restrictionAlertShownRef = useRef(false);

  // Use shared animation hooks
  const { isPromptLineOpen, setIsPromptLineOpen, promptLineAnimating } = usePromptAnimation(promptText);
  const isBulbGlowing = useBulbGlowAnimation(bucketColor);

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

  // Setup comment listeners (using shared utility)
  useEffect(() => {
    if (!whiteboardService) return;
    const cleanup = setupAttendeeCommentListeners(whiteboardService, setTrainerComments, setIsCommentsOpen);
    return cleanup;
  }, [whiteboardService]);

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
        onExerciseUpdate={() => { }}
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

        sessionType="client"
      />

      {/* Main Container - Whiteboard */}
      <div className="learner-main-container">
        <AttendeeWhiteboardSection>
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
          navigate('/client/dashboard');
        }}
      />
    </AttendeeSessionRoot>
  );
};

export default ClientSession;
