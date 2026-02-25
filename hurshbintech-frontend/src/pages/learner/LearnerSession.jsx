

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaBars, FaTimes } from 'react-icons/fa';
import sessionService from '../../api/services/sessionService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import Whiteboard from '../../components/common/Whiteboard';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import Emoji from '../../components/common/Emoji';
import YouTubePopup from '../../components/common/YouTubePopup';
import Exercise from '../../components/session/Exercise';
import LearnerVideoConference from '../../components/videoConference/LearnerVideoConference';
import MoveableVideoFeed from '../../components/videoConference/MoveableVideoFeed';
import useStopwatch from '../../hooks/useStopwatch';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { playTickSound, playCelebrationSound } from '../../utils/stopwatchSounds';
import { markSessionActive, clearSessionActivity, updateSessionActivity } from '../../utils/sessionActivityTracker';
import { denormalizeItem } from '../../utils/drawingSync';
import { setupAttendeeWhiteboardCallbacks } from '../../components/session/InstructorSessionLayout';
import IOSNavBar from '../../components/common/IOSNavBar';
import '../../styles/components/common/sessionHeader.css';

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
  AttendeeUpperSection,
  AttendeeWhiteboardSection,
  LearnerWhiteboardWithVideo,
  AttendeeWaitingModal,
  usePromptAnimation,
  useBulbGlowAnimation,
  ExerciseOverlay,
  attendeeSessionStyles
} from '../../components/session/AttendeeSessionLayout';


const LearnerSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // Auto-hide navbar hook
  const { navbarClassName, pageClassName } = useAutoHideNavbar();

  // Shared attendee session state
  const sessionState = useAttendeeSessionState();
  const {
    webRTC,
    setWebRTC,
    whiteboardService,
    setWhiteboardService,
    toolsService,
    setToolsService,
    isInitializingRef,
    remoteStream,
    setRemoteStream,
    remoteVideoRef,
    sessionInfo,
    setSessionInfo,
    loading,
    setLoading,
    connectionStatus,
    setConnectionStatus,
    timeLeft,
    setTimeLeft,
    canvasItems,
    setCanvasItems,
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
    tool,
    setTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    buckets,
    setBuckets,
    erasePenTrigger,
    setErasePenTrigger,
    redrawCanvasTrigger,
    setRedrawCanvasTrigger,
    micEnabled,
    setCameraEnabled,
    cameraEnabled,
    backgroundMusicPlaying,
    setBackgroundMusicPlaying,
    selectedMusic,
    setSelectedMusic,
    musicVolume,
    setMusicVolume,
    audioRef,
    promptMeter,
    setPromptMeter,
    reinforcementMeter,
    setReinforcementMeter,
    bucketColor,
    setBucketColor,
    trainerComments,
    setTrainerComments,
    isCommentsOpen,
    setIsCommentsOpen
  } = sessionState;

  // Canvas ref for denormalization
  const whiteboardCanvasRef = useRef(null);

  // Learner-specific states
  const [promptText, setPromptText] = useState('');
  const [promptVisible, setPromptVisible] = useState(false);
  const [isEyeBlinking, setIsEyeBlinking] = useState(false);
  const [youtubePopups, setYoutubePopups] = useState([]);
  const [isPrompterMeterOpen, setIsPrompterMeterOpen] = useState(false);
  const [isReinforcementMeterOpen, setIsReinforcementMeterOpen] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [awaitingAdmission, setAwaitingAdmission] = useState(false); // Waiting for trainer to admit
  const [admissionDenied, setAdmissionDenied] = useState(false); // Trainer rejected the join request

  // Use shared animation hooks
  const { isPromptLineOpen, setIsPromptLineOpen, promptLineAnimating } = usePromptAnimation(promptText);
  const isBulbGlowing = useBulbGlowAnimation(bucketColor);

  // Comment send functions (using shared utility)
  const [commentInput, setCommentInput] = useState('');
  const commentHandlerRef = useRef(null);

  useEffect(() => {
    // Initialize comment handler with shared utility
    commentHandlerRef.current = createCommentSendHandler(whiteboardService, 'learner');
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

  // Listen for feedback message state changes to debug
  useEffect(() => {
    if (!feedbackMessage) return;
    // console.log('[LearnerSession] feedbackMessage state changed to:', feedbackMessage);
  }, [feedbackMessage]);

  // Set up WebRTC message callback for prompt text
  useEffect(() => {
    if (webRTC) {
      webRTC.onPromptText = (data) => {
        setPromptText(data.text);

        // Eye blinking animation when new prompt received (unique to learner)
        setIsEyeBlinking(true);
        setTimeout(() => {
          setIsEyeBlinking(false);
        }, 3000);
      };
    }
    return () => {
      if (webRTC) {
        webRTC.onPromptText = null;
      }
    };
  }, [webRTC]);

  // Listen for session end from trainer
  useEffect(() => {
    if (!whiteboardService) return;

    whiteboardService.onSessionEnded = (data) => {
      // console.log('[LearnerSession] Session ended by trainer:', data);
      toast.info('Session has been ended by the trainer');

      // Clean up and redirect after a short delay
      setTimeout(() => {
        if (webRTC?.localStream) {
          webRTC.localStream.getTracks().forEach(track => track.stop());
        }
        if (webRTC) {
          webRTC.close();
        }
        if (whiteboardService) {
          whiteboardService.close();
        }
        navigate('/learner/dashboard');
      }, 2000);
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onSessionEnded = null;
      }
    };
  }, [whiteboardService, webRTC, navigate]);

  // Set up remote video stream
  useEffect(() => {
    if (remoteStream) {
      // Clear admission gate as soon as any stream arrives (ref may not be mounted yet)
      setAwaitingAdmission(false);
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, awaitingAdmission]);

  // Detect admission rejection or removal from trainer via waiting_message signal
  useEffect(() => {
    if (waitingMessage === '__ADMISSION_REJECTED__') {
      setAdmissionDenied(true);
      setAwaitingAdmission(false);
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
      setTimeout(() => navigate('/learner/dashboard'), 2000);
    } else if (waitingMessage === '__REMOVED_FROM_SESSION__') {
      toast.warning('You have been removed from the session by the trainer.');
      cleanupAttendeeSession(webRTC, whiteboardService, toolsService, isInitializingRef);
      setTimeout(() => navigate('/learner/dashboard'), 1500);
    }
  }, [waitingMessage, navigate]);

  // Learner-specific: Tool access permissions from trainer
  const [toolAccess, setToolAccess] = useState({
    select: false,
    drag: false,
    draw: false
  });

  // Learner-specific: Background music player ref
  const learnerAudioRef = useRef(null); // Reference to audio element

  // Learner-specific: Canvas clear triggers (for syncing with trainer)
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);

  // Learner-specific states
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [trainerJoined, setTrainerJoined] = useState(false); // Track if trainer has joined
  const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]); // Track remote user's selections

  // -----------------------------------------------------------
  // 🔹 Purpose: Exercise tool state
  // 🔸 How it works: manages exercise display and learner responses
  // -----------------------------------------------------------
  const [exerciseData, setExerciseData] = useState({
    question: ''
  });

  // -----------------------------------------------------------
  // 🔹 Purpose: Stopwatch hook for session timing
  // 🔸 How it works: learner has its own stopwatch display (read-only)
  // -----------------------------------------------------------
  const stopwatch = useStopwatch();
  const [syncedElapsedTime, setSyncedElapsedTime] = useState(0);
  const [syncedIsRunning, setSyncedIsRunning] = useState(false);
  const lastTickSecondRef = useRef(null);
  const hasPlayedCelebrationRef = useRef(false);
  const restrictionAlertShownRef = useRef(false); // Prevent duplicate toast alerts
  const pollingIntervalRef = useRef(null); // For auto-joining when trainer starts session

  // -----------------------------------------------------------
  // 🔹 Purpose: Reusable AudioContext (optimized)
  // 🔸 How it works: Single AudioContext instance to prevent lag
  // -----------------------------------------------------------
  const audioContextRef = useRef(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Play pop sound effect based on animation type (optimized)
  // 🔸 How it works: Uses Web Audio API with reusable context and simplified sounds
  // -----------------------------------------------------------
  const playPopSound = (animationType) => {
    try {
      const audioContext = getAudioContext();
      const now = audioContext.currentTime;

      switch (animationType) {
        case 'bubble': {
          // Bubble: Simple "bloop" (1 oscillator)
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(700, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        case 'smiley': {
          // Smiley: Simple "ding" (1 oscillator)
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1000, now);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'balloon': {
          // Balloon: Quick pop with minimal white noise
          const bufferSize = audioContext.sampleRate * 0.05; // Reduced to 50ms
          const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
          const data = buffer.getChannelData(0);

          // Generate white noise
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }

          const noiseSource = audioContext.createBufferSource();
          noiseSource.buffer = buffer;
          const noiseGain = audioContext.createGain();
          noiseGain.gain.setValueAtTime(0.4, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          noiseSource.connect(noiseGain);
          noiseGain.connect(audioContext.destination);
          noiseSource.start(now);

          // Single low thump
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(50, now + 0.04);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        }

        case 'star': {
          // Star: Simple twinkle (1 oscillator)
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1600, now);
          osc.frequency.exponentialRampToValueAtTime(2000, now + 0.05);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        default: {
          // Default quick pop
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        }
      }
    } catch (error) {
      // console.log('[LearnerSession] Could not play pop sound:', error);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle animation pop by learner
  // 🔸 How it works: marks animation as popped and broadcasts to trainer/other learners
  // -----------------------------------------------------------
  const handleAnimationPop = (animationId, poppedLeft, poppedTop) => {
    // Find the animation to get its type
    const animation = floatingAnimations.find(a => a.id === animationId);
    if (animation) {
      playPopSound(animation.type);
    }

    // Update animation state
    updateAnimationPopped(animationId, poppedLeft, poppedTop);

    // Broadcast pop event to all participants
    if (whiteboardService) {
      whiteboardService.send('animation_popped', {
        animationId: animationId,
        poppedLeft: poppedLeft,
        poppedTop: poppedTop,
        timestamp: Date.now()
      });
    }
  };

  // 🔹 Purpose: Update animation state when received from other participants
  // 🔸 How it works: marks animation as popped without broadcasting (to avoid circular messages)
  // -----------------------------------------------------------
  const updateAnimationPopped = (animationId, poppedLeft, poppedTop) => {
    setFloatingAnimations(prev =>
      prev.map(a => a.id === animationId ? { ...a, popped: true, poppedLeft, poppedTop } : a)
    );
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle exercise submission from learner
  // 🔸 How it works: sends learner's answer to trainer for evaluation
  // -----------------------------------------------------------
  const handleExerciseSubmit = (response) => {
    // console.log('[LearnerSession] Exercise response:', response);

    if (whiteboardService) {
      if (response.qaItems) {
        // New multiple Q&A format
        whiteboardService.send('exercise_response', {
          qaItems: response.qaItems,
          status: response.status,
          timestamp: Date.now()
        });
      } else {
        // Backward compatibility for single answer
        whiteboardService.send('exercise_response', {
          question: response.question,
          learnerAnswer: response.learnerAnswer,
          keyword: response.keyword,
          status: response.status,
          timestamp: Date.now()
        });
      }
    }
  };

  const handleExerciseAnswerChange = (answerData) => {
    // console.log('[LearnerSession] Answer changed:', answerData);

    // Update local state with the answer
    if (answerData.qaItems) {
      setExerciseData(prev => ({
        ...prev,
        qaItems: answerData.qaItems
      }));

      // Send qaItems update to trainer
      if (whiteboardService) {
        whiteboardService.send('exercise_answer_update', {
          qaItems: answerData.qaItems,
          timestamp: answerData.timestamp
        });
      }
    } else {
      // Backward compatibility for single answer
      setExerciseData(prev => ({
        ...prev,
        learnerAnswer: answerData.learnerAnswer
      }));

      // Send answer update to trainer
      if (whiteboardService) {
        whiteboardService.send('exercise_answer_update', {
          question: answerData.question,
          learnerAnswer: answerData.learnerAnswer,
          timestamp: answerData.timestamp
        });
      }
    }
  };

  const handleExerciseKeywordMatched = (matchData) => {
    // console.log('[LearnerSession] Keyword matched:', matchData);
    // toast.success('Keyword found! ✓');
  };

  // Listen for stopwatch updates from trainer
  useEffect(() => {
    if (!whiteboardService) {
      return;
    }

    // Create the handler function
    const handleStopwatchSync = (data) => {
      setSyncedElapsedTime(data.elapsedTime);
      setSyncedIsRunning(data.isRunning);
    };

    // Attach the handler
    whiteboardService.onStopwatchSync = handleStopwatchSync;

    // Cleanup
    return () => {
      if (whiteboardService) {
        whiteboardService.onStopwatchSync = null;
      }
    };
  }, [whiteboardService]);

  // Sound effects for learner stopwatch - clean implementation
  const prevElapsedTimeRef = useRef(null);
  const prevIsRunningRef = useRef(false);

  useEffect(() => {
    const currentSeconds = Math.floor(syncedElapsedTime / 1000);
    const prevTime = prevElapsedTimeRef.current;
    const prevSeconds = prevTime !== null ? Math.floor(prevTime / 1000) : null;
    const wasRunning = prevIsRunningRef.current;

    // Play tick sound at 10, 9, 8... 1 seconds (when second changes)
    if (syncedIsRunning && currentSeconds <= 10 && currentSeconds >= 1) {
      if (lastTickSecondRef.current !== currentSeconds) {
        lastTickSecondRef.current = currentSeconds;
        playTickSound();
      }
    }

    // Play celebration when countdown reaches 0
    // Multiple conditions to catch the finish:
    // 1. Time was > 0 and is now 0
    // 2. Timer was running and stopped with time at 0
    // 3. Time dropped below 500ms (almost finished)
    const timeJustHitZero = prevTime !== null && prevTime > 0 && syncedElapsedTime === 0;
    const timerJustStopped = wasRunning && !syncedIsRunning && syncedElapsedTime === 0;
    const timeAlmostZero = prevTime !== null && prevTime > 500 && syncedElapsedTime <= 500 && syncedElapsedTime >= 0;

    const justFinished = timeJustHitZero || timerJustStopped || timeAlmostZero;

    if (justFinished && !hasPlayedCelebrationRef.current) {
      // console.log('🎉 Learner: Countdown finished! Playing celebration...', {
      //   prevTime, syncedElapsedTime, wasRunning, syncedIsRunning
      // });
      hasPlayedCelebrationRef.current = true;
      playCelebrationSound();
    }

    // Reset flags when timer is set above 10 seconds
    if (currentSeconds > 10) {
      hasPlayedCelebrationRef.current = false;
      lastTickSecondRef.current = null;
    }

    // Store for next comparison
    prevElapsedTimeRef.current = syncedElapsedTime;
    prevIsRunningRef.current = syncedIsRunning;

  }, [syncedElapsedTime, syncedIsRunning]);

  // Initialize session
  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    initializeSession(user.id);

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Listen for tool access messages from trainer
  useEffect(() => {
    if (!whiteboardService) return;

    // Use centralized callback setup for attendee sessions
    const cleanup = setupAttendeeWhiteboardCallbacks({
      whiteboardService,
      setToolAccess,
      setTool,
      setPromptText,
      setPromptVisible,
      setIsEyeBlinking,
      setFeedbackMessage,
      setWaitingMessage,
      setFloatingAnimations,
      floatingAnimations,
      setCanvasItems,
      setBuckets,
      buckets,
      setErasePenTrigger,
      setRedrawCanvasTrigger,
      setClearCanvasTrigger,
      setYoutubePopups,
      setBackgroundMusicPlaying,
      setSelectedMusic,
      setMusicVolume,
      audioRef: learnerAudioRef,
      setExerciseData,
      sessionInfo,
      whiteboardCanvasRef,
      denormalizeItem
    });

    return cleanup;
  }, [whiteboardService, sessionInfo, floatingAnimations, buckets]);

  // Countdown timer with auto-end
  useEffect(() => {
    if (!sessionInfo?.started_at) return;

    const startTimeStr = sessionInfo.started_at.includes('Z')
      ? sessionInfo.started_at
      : sessionInfo.started_at + 'Z';
    const endTime = new Date(startTimeStr).getTime() + sessionInfo.duration * 60 * 1000;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = endTime - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('00:00');
        toast.info('Session time has ended.');

        // Auto-end session and redirect
        try {
          if (webRTC?.localStream) {
            webRTC.localStream.getTracks().forEach(track => track.stop());
          }
          webRTC?.close();
          whiteboardService?.close();
          clearSessionActivity(sessionId, 'learner');
        } catch (error) {
          console.error('[LearnerSession] Error during cleanup:', error);
        }

        // Redirect to dashboard after cleanup
        setTimeout(() => {
          navigate('/learner/dashboard');
        }, 500);
        return;
      }

      const totalSeconds = Math.floor(distance / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours > 0) {
        setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo, navigate, webRTC, whiteboardService, sessionId]);

  // Auto check for session end
  useEffect(() => {
    if (!sessionInfo || sessionInfo.status !== 'active') return;

    const checkInterval = setInterval(async () => {
      try {
        // Update session activity to mark session as still active
        updateSessionActivity(sessionId, 'learner');

        const updatedSession = await sessionService.getSessionDetails(sessionId);
        if (updatedSession.status === 'ended') {
          toast.info('Session has ended');
          cleanup();
          navigate('/learner/dashboard');
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    }, 30000);

    return () => clearInterval(checkInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo, sessionId]);

  // --------------------------
  // Session initialization
  // --------------------------
  const initializeSession = async () => {
    try {
      const session = await sessionService.getSessionDetails(sessionId);
      setSessionInfo(session);

      // 🔹 Purpose: Check if session is already active on another device/tab
      // 🔸 How it works: uses sessionActivityTracker to prevent multiple access
      const sessionCheck = markSessionActive(sessionId, 'learner');
      if (!sessionCheck.success) {
        // Only show alert once (prevent duplicate toasts in StrictMode)
        if (!restrictionAlertShownRef.current) {
          restrictionAlertShownRef.current = true;
          toast.error(sessionCheck.message);
          navigate('/learner/dashboard');
        }
        return;
      }

      await sessionService.joinSession(sessionId);
      await initializeWebRTC();
      setLoading(false);
      setAwaitingAdmission(true); // Show awaiting-admission screen until trainer's offer arrives
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to join session';
      setLoading(false);

      // If session is not active, show the waiting modal without showing a toast
      if (error.response?.status === 400 && errorMessage.includes('not active')) {
        setShowWaitingModal(true);
      } else {
        // For other errors, show a toast then redirect after a delay
        toast.error(`Error: ${errorMessage}`);
        setTimeout(() => navigate('/learner/dashboard'), 3000);
      }
    }
  };

  // Handle retry when trainer starts session
  const handleRetryJoin = async () => {
    setRetrying(true);
    try {
      const session = await sessionService.getSessionDetails(sessionId);
      setSessionInfo(session);

      const sessionCheck = markSessionActive(sessionId, 'learner');
      if (!sessionCheck.success) {
        if (!restrictionAlertShownRef.current) {
          restrictionAlertShownRef.current = true;
          toast.error(sessionCheck.message);
          navigate('/learner/dashboard');
        }
        setRetrying(false);
        return;
      }

      await sessionService.joinSession(sessionId);
      setShowWaitingModal(false);
      await initializeWebRTC();
      setLoading(false);
      setAwaitingAdmission(true);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to join session';
      // Suppress 'Session is not active' toast while the waiting modal is shown
      if (!(error.response?.status === 400 && errorMessage.includes('not active'))) {
        toast.error(`Still waiting: ${errorMessage}`);
      }
      setRetrying(false);
    }
  };

  // Auto-join when trainer starts session
  useEffect(() => {
    if (!showWaitingModal) {
      // Clear polling if modal is closed
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Start polling more frequently to catch status changes
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const session = await sessionService.getSessionDetails(sessionId);

        // Check if session is now active (status can be 'ACTIVE' or 'active')
        const isActive = session.status === 'ACTIVE' || session.status === 'active';

        if (isActive) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;

          // Auto-join immediately
          setTimeout(async () => {
            setRetrying(true);
            try {
              const sessionCheck = markSessionActive(sessionId, 'learner');
              if (!sessionCheck.success) {
                if (!restrictionAlertShownRef.current) {
                  restrictionAlertShownRef.current = true;
                  toast.error(sessionCheck.message);
                  navigate('/learner/dashboard');
                }
                setRetrying(false);
                return;
              }

              await sessionService.joinSession(sessionId);
              setShowWaitingModal(false);
              await initializeWebRTC();
              setLoading(false);
              setAwaitingAdmission(true);
            } catch (error) {
              const errorMessage = error.response?.data?.detail || error.message || 'Failed to join session';
              setRetrying(false);
            }
          }, 300);
        }
      } catch (error) {
        // Silently continue polling
      }
    }, 500); // Check every 500ms for faster detection

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [showWaitingModal, sessionId, navigate]);


  // --------------------------
  // WebRTC Initialization
  // --------------------------

  const initializeWebRTC = async () => {
    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, sessionId, 'learner');
    try {
      wbService.initialize();
      setWhiteboardService(wbService);

      // Listen for item selections from remote user (trainer)
      wbService.onItemSelected = (data) => {
        // console.log('[LearnerSession] Remote user selected items:', data);
        if (data.itemIds && Array.isArray(data.itemIds)) {
          setRemoteSelectedItemIds(data.itemIds);
        }
      };
    } catch {
      // toast.error('Failed to initialize whiteboard');
    }

    // Initialize Video Conference Service
    const videoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'learner');

    try {
      // console.log('[LearnerSession] Initializing Video Conference service');

      // Set callback for local stream (learner's camera/mic)
      videoService.onLocalStream = (stream) => {
        // console.log('[LearnerSession] Local stream received');
        // Learner doesn't display their own video to minimize distraction
      };

      // Set callback for remote stream (trainer's video)
      videoService.onRemoteStream = (stream) => {
        // console.log('[LearnerSession] Remote stream received from trainer');
        setRemoteStream(stream);
        setTrainerJoined(true); // Trainer has joined
      };

      // Set callback for connection state changes
      videoService.onConnectionStateChange = (state) => {
        // console.log('[LearnerSession] Connection state:', state);
        const statusMap = {
          'new': 'connecting',
          'connecting': 'connecting',
          'connected': 'connected',
          'disconnected': 'disconnected',
          'failed': 'failed',
          'closed': 'disconnected'
        };
        const mappedStatus = statusMap[state] || state;
        setConnectionStatus(mappedStatus);

        // If disconnected or failed, trainer might have left
        if (state === 'disconnected' || state === 'closed') {
          setTrainerJoined(false);
        }
      };

      // Set error callback
      videoService.onError = (error) => {
        console.error('[LearnerSession] Video conference error:', error);
        toast.error(`Video error: ${error.message}`);
      };

      // Set callback for prompt meter updates from trainer
      videoService.onPromptMeterUpdate = (value) => {
        // console.log('[LearnerSession] Prompt meter update received:', value);
        setPromptMeter(value);
      };

      // Set callback for reinforcement meter updates from trainer
      videoService.onReinforcementMeterUpdate = (value) => {
        // console.log('[LearnerSession] Reinforcement meter update received:', value);
        setReinforcementMeter(value);
      };

      // Set callback for freeze signal from trainer
      videoService.onFreeze = async (message) => {
        // console.log('[LearnerSession] Freeze signal received:', message);
        setIsFrozen(message.frozen);
        if (message.frozen) {
          // Show prompt for user to click - fullscreen MUST be triggered by user gesture
          setShowFullscreenPrompt(true);
          // console.log('[LearnerSession] Waiting for user interaction to trigger fullscreen');

          // Listen for first user interaction to trigger fullscreen
          const triggerFullscreenOnInteraction = async (event) => {
            // console.log('[LearnerSession] User interaction detected, triggering fullscreen...');
            try {
              await enterKioskMode();
              // console.log('[LearnerSession] Successfully entered fullscreen mode');
            } catch (err) {
              // console.log('[LearnerSession] Fullscreen entry failed, will retry on next interaction');
              return; // Don't remove listener, keep trying
            }
            // Remove listeners once fullscreen is successful
            document.removeEventListener('click', triggerFullscreenOnInteraction, true);
            document.removeEventListener('touchstart', triggerFullscreenOnInteraction, true);
            document.removeEventListener('keydown', triggerFullscreenOnInteraction, true);
          };

          // Add listeners for any user interaction
          document.addEventListener('click', triggerFullscreenOnInteraction, true);
          document.addEventListener('touchstart', triggerFullscreenOnInteraction, true);
          document.addEventListener('keydown', triggerFullscreenOnInteraction, true);

          // Store reference to remove if unfreeze happens
          window.fullscreenTriggerHandler = triggerFullscreenOnInteraction;
        } else {
          setShowFullscreenPrompt(false);
          // Remove interaction listeners if unfrozen before fullscreen activated
          if (window.fullscreenTriggerHandler) {
            document.removeEventListener('click', window.fullscreenTriggerHandler, true);
            document.removeEventListener('touchstart', window.fullscreenTriggerHandler, true);
            document.removeEventListener('keydown', window.fullscreenTriggerHandler, true);
            window.fullscreenTriggerHandler = null;
          }
          exitKioskMode();
          // Silent unfreeze - no toast notification
        }
      };

      // Initialize video conference (gets local media and sets up connection)
      await videoService.initialize();
      setWebRTC(videoService);

      // console.log('[LearnerSession] Video Conference service initialized');
    } catch (error) {
      console.error('[LearnerSession] Video Conference init error:', error);
      toast.error('Failed to initialize video connection: ' + error.message);
    }
  };

  const _handleSessionEnded = () => {
    toast.info('Session has been ended by the trainer');
    cleanup();
    navigate('/learner/dashboard');
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Enter kiosk mode (freeze window)
  // 🔸 How it works: Enters fullscreen and prevents window switching
  // -----------------------------------------------------------
  const enterKioskMode = async () => {
    try {
      // console.log('[LearnerSession] Entering kiosk mode');

      // Request fullscreen AGGRESSIVELY - must be triggered by user gesture
      const elem = document.documentElement;
      let fullscreenSuccess = false;

      // console.log('[LearnerSession] Requesting fullscreen...');
      // console.log('[LearnerSession] Current fullscreen element:', document.fullscreenElement);

      try {
        if (elem.requestFullscreen) {
          // console.log('[LearnerSession] Using requestFullscreen');
          await elem.requestFullscreen({ navigationUI: 'hide' });
          fullscreenSuccess = true;
        } else if (elem.webkitRequestFullscreen) {
          // console.log('[LearnerSession] Using webkitRequestFullscreen');
          await elem.webkitRequestFullscreen();
          fullscreenSuccess = true;
        } else if (elem.msRequestFullscreen) {
          // console.log('[LearnerSession] Using msRequestFullscreen');
          await elem.msRequestFullscreen();
          fullscreenSuccess = true;
        } else if (elem.mozRequestFullScreen) {
          // console.log('[LearnerSession] Using mozRequestFullScreen');
          await elem.mozRequestFullScreen();
          fullscreenSuccess = true;
        } else {
          // console.warn('[LearnerSession] No fullscreen API available');
          // Silently fail - user will see the prompt to retry
          throw new Error('Fullscreen API not available');
        }

        if (fullscreenSuccess) {
          // console.log('[LearnerSession] Fullscreen activated successfully');
          setShowFullscreenPrompt(false);
        }
      } catch (err) {
        // console.warn('[LearnerSession] Fullscreen request failed (this is normal on first try):', err.message);
        // Don't show error toast - user already sees the prompt to click
        // Keep the prompt visible for retry
        throw err;
      }

      // Hide fullscreen exit button with CSS
      const existingStyle = document.getElementById('freeze-fullscreen-style');
      if (!existingStyle) {
        const style = document.createElement('style');
        style.id = 'freeze-fullscreen-style';
        style.textContent = `
          *::-webkit-full-screen-ancestor:not(iframe) {
            display: none !important;
          }
          video::-webkit-media-controls-fullscreen-button {
            display: none !important;
          }
          button[title="Exit full screen"],
          button[aria-label="Exit full screen"],
          .exit-fullscreen-button {
            display: none !important;
            pointer-events: none !important;
          }
        `;
        document.head.appendChild(style);
      }

      // Prevent window closing
      window.addEventListener('beforeunload', preventWindowClose);

      // Prevent context menu
      document.addEventListener('contextmenu', preventDefaultAction);

      // Prevent ALL keyboard shortcuts aggressively
      document.addEventListener('keydown', preventKeyboardShortcuts, true);
      document.addEventListener('keyup', preventKeyboardShortcuts, true);

      // Prevent window blur (switching windows)
      window.addEventListener('blur', refocusWindow);
      window.addEventListener('focusout', refocusWindow);

      // Monitor visibility changes
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Prevent text selection during freeze
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';

      // Prevent mouse clicks at top of screen (where exit button appears)
      document.addEventListener('click', preventTopClicks, true);
      document.addEventListener('mousedown', preventTopClicks, true);

      // Lock screen orientation on mobile (separate try-catch to prevent blocking other features)
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
          // Try portrait if landscape fails
          return screen.orientation.lock('portrait');
        }).catch(err => {
          // console.log('[LearnerSession] Could not lock orientation:', err);
        });
      }

      // Set up refocus interval (less aggressive to prevent flickering)
      if (window.freezeRefocusInterval) {
        clearInterval(window.freezeRefocusInterval);
      }
      window.freezeRefocusInterval = setInterval(() => {
        if (document.hidden) {
          window.focus();
        }
      }, 500);

      // Set up fullscreen monitoring interval to keep fullscreen enforced (more frequent)
      if (window.freezeFullscreenInterval) {
        clearInterval(window.freezeFullscreenInterval);
      }
      window.freezeFullscreenInterval = setInterval(() => {
        if (isFrozen && !document.fullscreenElement && !document.webkitFullscreenElement) {
          // console.log('[LearnerSession] Fullscreen exited, re-entering...');
          const elem = document.documentElement;
          if (elem.requestFullscreen) {
            elem.requestFullscreen({ navigationUI: 'hide' }).catch(() => { });
          } else if (elem.webkitRequestFullscreen) {
            try {
              elem.webkitRequestFullscreen();
            } catch (err) { }
          }
          // Silent re-entry - no error toast to avoid spam
        }
      }, 300);

      // console.log('[LearnerSession] Kiosk mode activated');
    } catch (error) {
      console.warn('[LearnerSession] Kiosk mode setup incomplete (waiting for user interaction):', error.message);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Exit kiosk mode (unfreeze window)
  // 🔸 How it works: Exits fullscreen and removes restrictions
  // -----------------------------------------------------------
  const exitKioskMode = () => {
    try {
      // console.log('[LearnerSession] Exiting kiosk mode');

      // Clear refocus interval
      if (window.freezeRefocusInterval) {
        clearInterval(window.freezeRefocusInterval);
        window.freezeRefocusInterval = null;
      }

      // Clear fullscreen monitoring interval
      if (window.freezeFullscreenInterval) {
        clearInterval(window.freezeFullscreenInterval);
        window.freezeFullscreenInterval = null;
      }

      // Exit fullscreen (only if currently in fullscreen)
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
              console.warn('[LearnerSession] Exit fullscreen failed:', err);
            });
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        }
      } catch (fsError) {
        console.warn('[LearnerSession] Fullscreen exit not supported or failed:', fsError);
      }

      // Remove event listeners
      window.removeEventListener('beforeunload', preventWindowClose);
      document.removeEventListener('contextmenu', preventDefaultAction);
      document.removeEventListener('keydown', preventKeyboardShortcuts, true);
      document.removeEventListener('keyup', preventKeyboardShortcuts, true);
      window.removeEventListener('blur', refocusWindow);
      window.removeEventListener('focusout', refocusWindow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', preventTopClicks, true);
      document.removeEventListener('mousedown', preventTopClicks, true);

      // Remove fullscreen CSS style
      const freezeStyle = document.getElementById('freeze-fullscreen-style');
      if (freezeStyle) {
        freezeStyle.remove();
      }

      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

      // Unlock screen orientation
      if (screen.orientation && screen.orientation.unlock) {
        try {
          screen.orientation.unlock();
        } catch (err) {
          // console.log('[LearnerSession] Could not unlock orientation:', err);
        }
      }

      // console.log('[LearnerSession] Kiosk mode deactivated');
    } catch (error) {
      console.warn('[LearnerSession] Kiosk mode cleanup error:', error.message);
    }
  };

  // Helper functions for kiosk mode
  const preventWindowClose = (e) => {
    e.preventDefault();
    e.returnValue = 'The window is frozen by trainer. You cannot close it.';
    return 'The window is frozen by trainer. You cannot close it.';
  };

  const preventDefaultAction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  const preventTopClicks = (e) => {
    // Prevent clicks in the top 100px of the screen (where fullscreen exit button appears)
    if (e.clientY < 100) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  };

  const preventKeyboardShortcuts = (e) => {
    // Prevent ALL keyboard shortcuts and function keys
    if (
      e.altKey ||
      e.metaKey ||
      e.key === 'F11' ||
      e.key === 'F4' ||
      e.key === 'F5' ||
      e.key === 'F12' || // Dev tools
      e.key === 'Escape' ||
      e.key === 'Esc' || // Alternative Escape key name
      e.keyCode === 27 || // Escape keyCode
      e.key === 'Tab' ||
      (e.ctrlKey && (
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === 't' ||
        e.key === 'T' ||
        e.key === 'n' ||
        e.key === 'N' ||
        e.key === 'r' ||
        e.key === 'R' ||
        e.key === 'q' ||
        e.key === 'Q' ||
        e.shiftKey // Ctrl+Shift+... (dev tools shortcuts)
      )) ||
      (e.ctrlKey && e.shiftKey) // Block all Ctrl+Shift combinations
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // toast.warning('This action is blocked while window is frozen', { autoClose: 1000 });
      return false;
    }
  };

  const refocusWindow = (e) => {
    if (isFrozen) {
      e?.preventDefault();
      window.focus();
    }
  };

  const handleVisibilityChange = () => {
    if (isFrozen && document.hidden) {
      // Page is hidden, try to bring it back
      window.focus();
      // toast.error('You cannot switch windows while frozen!', { autoClose: 2000 });
    }
  };

  // Cleanup kiosk mode on unmount
  useEffect(() => {
    return () => {
      if (isFrozen) {
        exitKioskMode();
      }
    };
  }, [isFrozen]);

  // Monitor fullscreen changes - re-enter if user exits
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isFrozen && !document.fullscreenElement && !document.webkitFullscreenElement) {
        // User tried to exit fullscreen while frozen - re-enter it
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(err => {
            console.warn('[LearnerSession] Could not re-enter fullscreen:', err);
          });
        } else if (elem.webkitRequestFullscreen) {
          try {
            elem.webkitRequestFullscreen();
          } catch (err) {
            console.warn('[LearnerSession] Could not re-enter webkit fullscreen:', err);
          }
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFrozen]);




  const cleanup = () => {
    try {
      // Stop all media tracks (camera and microphone)
      if (webRTC?.localStream) {
        webRTC.localStream.getTracks().forEach(track => {
          track.stop();
          // console.log(`[LearnerSession] Stopped ${track.kind} track`);
        });
      }
      webRTC?.close();
      // console.log('[LearnerSession] WebRTC closed and media access revoked');
    } catch (error) {
      console.error('[LearnerSession] Error closing WebRTC:', error);
    }
    try {
      whiteboardService?.close();
    } catch (error) {
      console.error('[LearnerSession] Error closing whiteboard:', error);
    }

    // Clear session activity tracking
    clearSessionActivity(sessionId, 'learner');
  };

  // --------------------------
  // Keyboard controls
  // --------------------------
  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  // Show waiting overlay if trainer hasn't joined yet
  if (!loading && !trainerJoined && sessionInfo?.status === 'scheduled') {
    return (
      <div className={`learner-session-page ${pageClassName}`}>
        {/* Navigation / Header - Hidden completely */}
        <div className={`session-header ${navbarClassName}`} style={{ display: 'none' }}>
          <div className="session-header-main">
            <div>
              <div className="session-header-title">HurshBin Learner</div>
              <div className="session-header-subtitle">
                {sessionInfo?.title ?? 'Training Session'} — Trainer: {sessionInfo?.trainer_name ?? 'Trainer'}
              </div>
            </div>
            <div className="session-header-controls">
              <button
                className="btn-session btn-session-end"
                onClick={() => navigate('/learner/dashboard')}
              >
                🏠 Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Waiting Overlay */}
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 150px)' }}>
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
            <div className="text-6xl mb-4 animate-bounce">⏳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Waiting for Trainer
            </h2>
            <p className="text-gray-600 mb-4">
              Your session is scheduled and you're ready to join!
            </p>
            <p className="text-gray-600 mb-6">
              Please wait while <strong>{sessionInfo?.trainer_name ?? 'your trainer'}</strong> joins the session.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-[#DB9D32] rounded-full animate-pulse"></div>
              <span>Connecting...</span>
            </div>
            <div className="mt-6 p-4 bg-[#fef3e2] rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Session Details:</strong>
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {sessionInfo?.scheduled_date && (
                  <>📅 {new Date(sessionInfo.scheduled_date).toLocaleString()}</>
                )}
              </p>
              {sessionInfo?.duration && (
                <p className="text-xs text-gray-600 mt-1">
                  ⏱️ Duration: {sessionInfo.duration} minutes
                </p>
              )}
            </div>
          </div>
        </div>

        {/* iOS / PWA floating nav (back + refresh) */}
        <IOSNavBar
          onBack={() => navigate('/learner/dashboard')}
          onRefresh={() => window.location.reload()}
          position="bottom-right"
        />
      </div>
    );
  }

  // Admission denied by trainer
  if (admissionDenied) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', background: '#f8f8f8' }}>
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🚫</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Request Denied</h2>
          <p className="text-gray-600 mb-4">
            Your request to join the session was not accepted by the trainer.
          </p>
          <p className="text-sm text-gray-500">Redirecting you back to the dashboard...</p>
        </div>
      </div>
    );
  }

  // Waiting for trainer to admit
  if (awaitingAdmission) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', background: '#f8f8f8' }}>
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
          <div style={{ fontSize: '56px', marginBottom: '16px', animation: 'bounce 1s infinite' }}>⏳</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Awaiting Admission</h2>
          <p className="text-gray-600 mb-2">
            You have joined the session. Please wait for your trainer to admit you.
          </p>
          <p className="text-gray-600 mb-6">
            <strong>{sessionInfo?.trainer_name ?? 'Your trainer'}</strong> will admit you shortly.
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
    <div className={`learner-session-page ${pageClassName}`} style={{
      width: '100%',
      height: '100dvh',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative'
      // overflow removed from inline style - handled by CSS media queries
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
          /* overflow controlled by media queries */
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
          padding: 0 !important;
          min-height: 0 !important;
          /* overflow controlled by media queries for mobile scrolling */
        }

        /* Desktop: Hide overflow in main container */
        @media (min-width: 769px) {
          .learner-main-container {
            overflow: hidden !important;
          }
        }

        /* Mobile: Allow main container to expand and scroll */
        @media (max-width: 768px) {
          .learner-main-container {
            overflow-y: visible !important;
            overflow-x: hidden !important;
            min-height: 100% !important;
          }
        }

        /* Header with Metrics - Full width */
        .learner-metrics-header {
          width: 100% !important;
          box-sizing: border-box !important;
          flex-shrink: 0 !important;
          padding: 8px 8px !important;
          margin: 0 !important;
          gap: 12px !important;
          overflow: visible !important;
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

        /* Mobile: Ensure whiteboard wrapper takes proper height */
        @media (max-width: 768px) {
          .learner-whiteboard-wrapper {
            flex: 1 1 auto !important;
            /* Shorter height for mobile portrait - accounting for metrics header */
            /* Use smaller value to fit better on mobile screens */
            min-height: calc(100svh - 120px) !important;
            /* Use dvh (dynamic viewport) for when address bar hides */
            min-height: calc(100dvh - 120px) !important;
            /* iOS Safari fallback */
            min-height: calc(-webkit-fill-available - 120px) !important;
            /* Limit max height to prevent excessive scrolling */
            max-height: calc(100dvh - 60px) !important;
            max-height: calc(-webkit-fill-available - 60px) !important;
            /* Account for safe area insets at bottom (navigation bars, rounded corners) */
            padding-bottom: env(safe-area-inset-bottom, 0) !important;
          }

          /* Ensure whiteboard container and canvas fill available space */
          .session-whiteboard-container {
            min-height: 100% !important;
          }

          .learner-whiteboard-wrapper canvas {
            /* Touch-action for better mobile interaction */
            touch-action: none !important;
          }
        }

        /* Very small phones (iPhone SE, etc.) */
        @media (max-width: 375px) and (max-height: 667px) {
          .learner-metrics-header {
            padding: 4px 4px !important;
            gap: 8px !important;
          }

          .learner-whiteboard-wrapper {
            /* Smaller height for tiny screens */
            min-height: calc(100svh - 100px) !important;
            min-height: calc(100dvh - 100px) !important;
            min-height: calc(-webkit-fill-available - 100px) !important;
            max-height: calc(100dvh - 50px) !important;
          }
        }

        /* Mobile Landscape Mode - Optimize for horizontal orientation */
        @media (max-width: 768px) and (orientation: landscape) {
          .learner-session-page {
            /* In landscape, use full height - browser chrome typically hidden when scrolled */
            height: 100vh !important;
            height: 100dvh !important;
            height: -webkit-fill-available !important;
            /* Prevent scrolling in landscape - should fit perfectly */
            overflow: hidden !important;
          }

          .learner-main-container {
            /* No scrolling needed in landscape */
            overflow: hidden !important;
          }

          .learner-metrics-header {
            /* Minimize header in landscape to maximize whiteboard space */
            padding: 2px 4px !important;
            gap: 6px !important;
            font-size: 12px !important;
          }

          .learner-whiteboard-wrapper {
            /* In landscape, fit perfectly in viewport when browser chrome is hidden */
            min-height: calc(100vh - 40px) !important;
            max-height: calc(100vh - 40px) !important;
            height: calc(100vh - 40px) !important;
            /* Use dvh for dynamic adjustment */
            min-height: calc(100dvh - 40px) !important;
            max-height: calc(100dvh - 40px) !important;
            height: calc(100dvh - 40px) !important;
            /* iOS Safari fallback */
            min-height: calc(-webkit-fill-available - 40px) !important;
            max-height: calc(-webkit-fill-available - 40px) !important;
            /* Remove bottom padding in landscape */
            padding-bottom: 0 !important;
          }
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

        /* Mobile: Use dynamic viewport height and allow scrolling to hide browser chrome */
        @media (max-width: 768px) {
          .learner-session-page {
            /* IMPORTANT: Use 100svh (small viewport height) initially - shows full content even with browser bars */
            height: 100svh !important;
            /* Use 100dvh (dynamic viewport height) for browsers that support it - adjusts as address bar shows/hides */
            height: 100dvh !important;
            /* Fallback: -webkit-fill-available for iOS Safari */
            height: -webkit-fill-available !important;
            /* Set minimum height to ensure content is always accessible */
            min-height: 100svh !important;
            min-height: 100dvh !important;
            /* Allow scrolling on mobile to hide browser chrome */
            overflow-y: auto !important;
            overflow-x: hidden !important;
            /* Enable momentum scrolling on iOS */
            -webkit-overflow-scrolling: touch !important;
            /* Handle safe areas (notches, rounded corners) */
            padding-top: env(safe-area-inset-top, 0) !important;
            padding-bottom: env(safe-area-inset-bottom, 0) !important;
            padding-left: env(safe-area-inset-left, 0) !important;
            padding-right: env(safe-area-inset-right, 0) !important;
          }

          /* On mobile, ensure body/html allow the page to expand */
          html {
            /* iOS Safari specific - prevents issues with 100vh */
            height: -webkit-fill-available !important;
            overflow-x: hidden !important;
            /* Allow vertical scrolling to hide browser chrome */
            overflow-y: auto !important;
          }
          
          body {
            /* Ensure body can expand beyond initial viewport */
            min-height: 100vh !important;
            min-height: 100svh !important;
            min-height: 100dvh !important;
            min-height: -webkit-fill-available !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            /* Remove default margins that can cause layout issues */
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Metrics header - Account for safe area insets */
          .learner-metrics-header {
            padding-top: max(8px, env(safe-area-inset-top, 8px)) !important;
            padding-left: max(8px, env(safe-area-inset-left, 8px)) !important;
            padding-right: max(8px, env(safe-area-inset-right, 8px)) !important;
          }
        }

        /* Desktop: Use regular viewport height and prevent overflow */
        @media (min-width: 769px) {
          .learner-session-page {
            height: 100vh !important;
            min-height: 100vh !important;
            overflow: hidden !important;
          }
        }

        /* Fixed Video Overlay - Mobile safe area handling */
        @media (max-width: 768px) {
          .trainer-video-overlay {
            /* Adjust for safe areas (notches, rounded corners) */
            top: max(55px, calc(55px + env(safe-area-inset-top, 0px))) !important;
            right: max(2px, env(safe-area-inset-right, 2px)) !important;
            /* Smaller video on mobile */
            width: clamp(120px, 25vw, 200px) !important;
            height: clamp(90px, 18.75vw, 150px) !important;
          }
        }

        /* Landscape mode - minimize video and adjust positioning */
        @media (max-width: 768px) and (orientation: landscape) {
          .trainer-video-overlay {
            /* Position closer to top in landscape */
            top: max(35px, calc(35px + env(safe-area-inset-top, 0px))) !important;
            /* Smaller video in landscape */
            width: clamp(90px, 18vw, 140px) !important;
            height: clamp(68px, 13.5vw, 105px) !important;
          }

          /* Make metrics header elements more compact */
          .learner-metrics-header > div {
            font-size: 11px !important;
          }

          .learner-metrics-header span {
            font-size: 11px !important;
          }

          /* Ensure whiteboard container doesn't exceed viewport in landscape */
          .session-whiteboard-container {
            max-height: 100% !important;
            overflow: hidden !important;
          }

          .learner-whiteboard-wrapper > div {
            max-height: 100% !important;
          }

          /* Constrain canvas to fit perfectly */
          .learner-whiteboard-wrapper canvas {
            max-height: calc(100dvh - 45px) !important;
            max-height: calc(-webkit-fill-available - 45px) !important;
            object-fit: contain !important;
          }

          .learner-whiteboard-wrapper .w-full {
            max-height: 100% !important;
          }
        }
      `}</style>
      {/* Hidden audio element for background music */}
      <audio
        ref={learnerAudioRef}
        crossOrigin="anonymous"
      />



      {/* Sidebar Toggles (Mobile Only) */}
      <div className="session-sidebar-toggles">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="sidebar-toggle-button"
          aria-label="Toggle Sidebar"
        >
          {isSidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        </button>
      </div>

      {/* Overlay backdrop for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Fullscreen activation triggers on first user interaction */}
      {showFullscreenPrompt && <div style={{ display: 'none' }} />}

      {/* Main Container - Flexbox column layout */}
      <div className="learner-main-container">

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
          showExercise={!!exerciseData && (!!exerciseData.question || !!exerciseData.qaItems?.length)}
          Exercise={Exercise}
          whiteboardService={whiteboardService}
          onExerciseSubmit={handleExerciseSubmit}
          onExerciseUpdate={handleExerciseAnswerChange}
          onExerciseDelete={null}

          // Video Panel Props
          remoteVideoRef={remoteVideoRef}
          remoteStream={remoteStream}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          onToggleMic={null}
          onToggleCamera={null}
          onLeaveSession={null}
          videoLabel="Trainer"
          showVideoControls={false}

          sessionType="learner"
        />

        {/* Whiteboard - Fills remaining space */}
        <AttendeeWhiteboardSection>
          <LearnerWhiteboardWithVideo
            remoteVideoRef={remoteVideoRef}
            remoteStream={remoteStream}
            whiteboardCanvasRef={whiteboardCanvasRef}
            whiteboardService={whiteboardService}
            canvasItems={canvasItems}
            setCanvasItems={setCanvasItems}
            toolAccess={toolAccess}
            remoteSelectedItemIds={remoteSelectedItemIds}
            feedbackMessage={feedbackMessage}
            waitingMessage={waitingMessage}
            floatingAnimations={floatingAnimations}
            onAnimationPop={handleAnimationPop}
            clearCanvasTrigger={clearCanvasTrigger}
            erasePenTrigger={erasePenTrigger}
            redrawCanvasTrigger={redrawCanvasTrigger}
            buckets={buckets}
            setBuckets={setBuckets}
            bucketColor={bucketColor}
            setBucketColor={setBucketColor}
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            lineWidth={lineWidth}
            setLineWidth={setLineWidth}
            syncedElapsedTime={syncedElapsedTime}
            syncedIsRunning={syncedIsRunning}
            stopwatch={stopwatch}
            Whiteboard={Whiteboard}
          />

          {/* Exercise Overlay - Displays question/answer on top of whiteboard */}
          <ExerciseOverlay
            exerciseData={exerciseData}
            showExercise={!!exerciseData && (!!exerciseData.question || !!exerciseData.qaItems?.length)}
            onExerciseUpdate={handleExerciseAnswerChange}
            sessionType="learner"
          />
        </AttendeeWhiteboardSection>

        {/* YouTube Popups - Synced from trainer (read-only for learner) */}
        {youtubePopups.map(popup => (
          <YouTubePopup
            key={popup.id}
            popupId={popup.id}
            videoId={popup.videoId}
            title={popup.title}
            onClose={() => { }} // Learner cannot close, but provide empty handler
            initialPosition={popup.position}
            isTrainer={false}
            isReadOnly={true} // Learner: view and resize only, cannot drag
          />
        ))}

        {/* Waiting Modal - Uses shared component */}
        <AttendeeWaitingModal
          show={showWaitingModal}
          title="Waiting for Trainer"
          description="The trainer is starting the session. You'll be automatically added once they begin! ✨"
          retrying={retrying}
          onRetry={handleRetryJoin}
          onCancel={() => {
            setShowWaitingModal(false);
            navigate('/learner/dashboard');
          }}
        />

        {/* Background Music Audio Element */}
        <audio ref={audioRef} crossOrigin="anonymous" />

        {/* iOS / PWA floating nav (back + refresh) */}
        <IOSNavBar
          onBack={() => navigate('/learner/dashboard')}
          onRefresh={() => window.location.reload()}
          position="bottom-right"
        />
      </div>
    </div>
  );
};

export default LearnerSession;
