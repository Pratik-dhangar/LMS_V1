// ClientSession.jsx
// Client session page - Simplified with shared components

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import sessionService from '../../api/services/sessionService';
import Whiteboard from '../../components/common/Whiteboard';
import Calculator from '../../components/common/Calculator';
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
  DrawColorPalette,
  AttendeeWaitingScreen,
  AttendeeWaitingModal,
  usePromptAnimation,
  useBulbGlowAnimation,
  attendeeSessionStyles,
  SessionFeedbackModal
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
    calculatorPermission,
    stopwatchElapsedTime, setStopwatchElapsedTime,
    stopwatchIsRunning, setStopwatchIsRunning,
    promptMeter, setPromptMeter,
    reinforcementMeter, setReinforcementMeter,
    bucketColor, setBucketColor,
    promptText, setPromptText,
    trainerComments, setTrainerComments,
    isCommentsOpen, setIsCommentsOpen,
    audioRef,
    inlineMedia, setInlineMedia
  } = sessionState;

  // Client-specific state
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [awaitingAdmission, setAwaitingAdmission] = useState(false); // Waiting for coach to admit
  const [admissionDenied, setAdmissionDenied] = useState(false); // Coach rejected the join request
  const [showExercise, setShowExercise] = useState(false);
  const [exerciseData, setExerciseData] = useState({ question: '', answer: '' });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const pollingIntervalRef = useRef(null);
  const pendingCleanupRef = useRef(null);

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
      setShowFeedbackModal(true);
      pendingCleanupRef.current = () => {
        cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
        navigate('/my-appointments');
      };
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
    if (remoteStream) {
      // Clear admission gate as soon as any stream arrives (ref may not be mounted yet)
      setAwaitingAdmission(false);
    }
    if (remoteStream && remoteVideoRef.current) {
      console.log('[ClientSession] Connecting remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, awaitingAdmission]);

  // Detect admission rejection or removal from coach via waiting_message signal
  useEffect(() => {
    if (waitingMessage === '__ADMISSION_REJECTED__') {
      setAdmissionDenied(true);
      setAwaitingAdmission(false);
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
      setTimeout(() => navigate('/my-appointments'), 2000);
    } else if (waitingMessage === '__REMOVED_FROM_SESSION__') {
      toast.warning('You have been removed from the session by the coach.');
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
      setTimeout(() => navigate('/my-appointments'), 1500);
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
            console.error('[ClientSession] Error during auto-end cleanup:', error);
          }
          navigate('/my-appointments');
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
      setAwaitingAdmission(true); // Show awaiting-admission screen until coach's offer arrives
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

      await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'client', sessionState);
      setShowWaitingModal(false);
      setLoading(false);
      setAwaitingAdmission(true);
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
              await initializeAttendeeServices(WS_BASE_URL, session.session_id, 'client', sessionState);
              setShowWaitingModal(false);
              setLoading(false);
              setAwaitingAdmission(true);
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
              inlineMedia={inlineMedia}
              setInlineMedia={setInlineMedia}
            />

            {calculatorPermission && (
              <div style={{ position: 'absolute', right: '12px', bottom: '12px', zIndex: 80, width: 'min(340px, 92vw)' }}>
                <Calculator
                  hasPermission={calculatorPermission}
                  onCalculatorChange={(payload) => {
                    if (!whiteboardService) return;

                    if (payload.action === 'clear') {
                      whiteboardService.send('calculator_clear', {
                        timestamp: Date.now()
                      });
                      return;
                    }

                    if (payload.action === 'equals') {
                      whiteboardService.send('calculator_result', {
                        result: payload.result,
                        calculation: payload.calculation,
                        display: payload.display,
                        history: payload.history || [],
                        timestamp: Date.now()
                      });
                      return;
                    }

                    whiteboardService.send('calculator_operation', {
                      action: payload.action,
                      display: payload.display,
                      previousValue: payload.previousValue,
                      operation: payload.operation,
                      history: payload.history || [],
                      timestamp: Date.now()
                    });
                  }}
                />
              </div>
            )}
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
      {showFeedbackModal && (
        <SessionFeedbackModal
          onSubmit={async (rating, remark) => {
            try {
              await sessionService.submitFeedback(sessionId, { rating, remark, attendeeRole: 'client' });
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

export default ClientSession;
