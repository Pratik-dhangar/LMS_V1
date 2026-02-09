

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaBars, FaTimes } from 'react-icons/fa';
import { Clock } from 'lucide-react';
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
  AttendeeVideoControls,
  RemoteVideoFeed,
  AttendeeCommentsPanel,
  attendeeSessionStyles
} from '../../components/session/AttendeeSessionLayout';


const LearnerSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // Auto-hide navbar hook
  const { navbarClassName, pageClassName } = useAutoHideNavbar();

  // Use shared attendee session state
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

  // Learner-specific states (not in shared utility)
  const [promptText, setPromptText] = useState('[Prompts from trainer will appear here]');
  const [promptVisible, setPromptVisible] = useState(false); // Toggle prompt line visibility (collapsed by default)
  const [isEyeBlinking, setIsEyeBlinking] = useState(false); // Eye blinking animation when new prompt received

  // YouTube popups synced from trainer
  const [youtubePopups, setYoutubePopups] = useState([]); // Array of { id, videoId, title, position }

  // Collapsible section states
  const [isPromptLineOpen, setIsPromptLineOpen] = useState(false);
  const [isPrompterMeterOpen, setIsPrompterMeterOpen] = useState(false);
  const [isReinforcementMeterOpen, setIsReinforcementMeterOpen] = useState(false);
  const [promptLineAnimating, setPromptLineAnimating] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [retrying, setRetrying] = useState(false);

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

  // Set up WebRTC message callback (removed - messaging feature disabled)
  useEffect(() => {
    if (webRTC) {
      // Set up prompt text handler
      webRTC.onPromptText = (data) => {
        // console.log('[LearnerSession] Prompt text received from trainer:', data);
        setPromptText(data.text);

        // Auto-open Prompt Line div when new prompt is received
        setIsPromptLineOpen(true);

        // Trigger animation
        setPromptLineAnimating(true);
        setTimeout(() => {
          setPromptLineAnimating(false);
        }, 2000);

        // Trigger eye blinking animation when new prompt is received
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
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Learner-specific: Tool access permissions from trainer
  const [toolAccess, setToolAccess] = useState({
    select: false,
    drag: false
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

    // Set up callback for tool access messages
    whiteboardService.onToolAccess = (data) => {
      // console.log('[LearnerSession] Tool access update:', data);
      setToolAccess(prevAccess => ({
        ...prevAccess,
        [data.toolName]: data.enabled
      }));

      // Clear selection when drag permission is disabled
      if (data.toolName === 'drag' && !data.enabled) {
        setSelectedItems([]);
      }

      // Auto-switch to select tool when drag is enabled
      if (data.toolName === 'drag' && data.enabled) {
        setTool('select');
      }
      // Auto-switch to select tool when select is enabled
      else if (data.toolName === 'select' && data.enabled) {
        setTool('select');
      }
    };

    // NOTE: Auto-send prompt via whiteboardService disabled - only manual send via webRTC.sendPrompt is used

    // Set up callback for feedback messages from trainer
    whiteboardService.onFeedbackMessage = (data) => {
      // console.log('[LearnerSession] Feedback message received from trainer:', data);
      setFeedbackMessage(data.text || '');

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setFeedbackMessage('');
      }, 3000);
    };

    // Set up callback for waiting messages from trainer
    whiteboardService.onWaitingMessage = (data) => {
      // console.log('[LearnerSession] Waiting message received from trainer:', data);
      setWaitingMessage(data.text || '');

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setWaitingMessage('');
      }, 3000);
    };

    // Set up callback for floating animations from trainer
    whiteboardService.onFloatingAnimations = (data) => {
      setFloatingAnimations(prev => [...prev, ...data.animations]);

      // Auto-remove after 13 seconds (same as trainer)
      setTimeout(() => {
        setFloatingAnimations(prev =>
          prev.filter(a => !data.animations.find(na => na.id === a.id))
        );
      }, 13000);
    };

    // Set up callback for animation pop events from other learners/trainer
    whiteboardService.onAnimationPopped = (data) => {
      // console.log('[LearnerSession] Animation popped by another user:', data);
      updateAnimationPopped(data.animationId, data.poppedLeft, data.poppedTop);
    };

    // Debug - log feedbackMessage state changes
    // (we'll watch this console in the learner's browser to confirm receipt)
    // useEffect can't be declared in this block; we add a top-level effect below

    // Set up callback for item removal from trainer
    whiteboardService.onItemRemove = (data) => {
      // console.log('[LearnerSession] Item remove received:', data);
      if (data?.id) {
        setCanvasItems(prev => prev.filter(item => item.id !== data.id));
      }
    };

    // Set up callback for item updates from trainer (including new exercises)
    whiteboardService.onItemUpdate = (data) => {
      // console.log('[LearnerSession] Item update received:', data);
      if (data?.id && data?.type) {
        // If the item has a `targetLearnerId`, only show it to that learner
        if (data.targetLearnerId) {
          // Convert both IDs to strings for comparison to handle string/number mismatches
          const targetId = String(data.targetLearnerId);
          const myId = String(sessionInfo?.learner_id || '');

          // console.log('[LearnerSession] Targeted item check:', {
          //   itemId: data.id,
          //   targetLearnerId: targetId,
          //   myLearnerId: myId,
          //   sessionInfoLoaded: !!sessionInfo,
          //   match: targetId === myId
          // });

          if (myId && targetId !== myId) {
            // console.log('[LearnerSession] Item not for this learner, ignoring');
            return; // Don't add this item
          }

          // console.log('[LearnerSession] Item is for this learner, adding to canvas');
        }

        setCanvasItems(prev => {
          const existingIndex = prev.findIndex(item => item.id === data.id);

          // If item is relative to a bucket container, convert normalized offset to absolute coordinates
          let processedData = { ...data };
          if (data.isRelativeToContainer && data.inBucket) {
            // Find the bucket this item belongs to
            const bucket = buckets.find(b => b.id === data.inBucket);
            if (bucket) {
              // Denormalize the offset coordinates based on bucket dimensions
              const bucketWidth = data.bucketDimensions?.width || bucket.width || 80;
              const bucketHeight = data.bucketDimensions?.height || bucket.height || 80;

              // Convert normalized offsets back to pixel offsets
              const pixelOffsetX = (data.x || 0) * bucketWidth;
              const pixelOffsetY = (data.y || 0) * bucketHeight;

              // Denormalize width/height if they're normalized (0-1)
              let itemWidth = data.width;
              let itemHeight = data.height;
              if (data.width && data.width >= 0 && data.width <= 1) {
                itemWidth = data.width * bucketWidth;
              }
              if (data.height && data.height >= 0 && data.height <= 1) {
                itemHeight = data.height * bucketHeight;
              }

              // Convert offset to absolute coordinates by adding bucket position
              processedData = {
                ...processedData,
                x: bucket.x + pixelOffsetX,
                y: bucket.y + pixelOffsetY,
                width: itemWidth,
                height: itemHeight
              };
            }
          }

          if (existingIndex >= 0) {
            // Update existing item
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...processedData };
            return updated;
          } else {
            // Add new item
            return [...prev, processedData];
          }
        });
      }
    };

    // Set up callback for erase pen strokes from trainer
    whiteboardService.onErasePen = (data) => {
      // console.log('[LearnerSession] Erase pen received from trainer:', data);
      setErasePenTrigger(prev => prev + 1); // Trigger canvas clear in Whiteboard component
      setRedrawCanvasTrigger(prev => prev + 1); // Trigger redraw of canvas items after clear
    };

    // Set up callback for clear canvas event (also clears video, items, and buckets)
    whiteboardService.onClearCanvas = () => {
      // console.log('[LearnerSession] Received clear canvas event from trainer');
      // console.log('[LearnerSession] 🗑️ CLEARING CANVAS NOW:');
      // console.log('[LearnerSession] Current floatingAnimations count:', floatingAnimations.length);

      setClearCanvasTrigger(prev => prev + 1);
      // console.log('[LearnerSession] ✅ setClearCanvasTrigger called');

      setCanvasItems([]);
      // console.log('[LearnerSession] ✅ setCanvasItems([]) called');

      setBuckets([]);
      // console.log('[LearnerSession] ✅ setBuckets([]) called');

      setFloatingAnimations([]);
      // console.log('[LearnerSession] ✅ setFloatingAnimations([]) called - SHOULD CLEAR ALL ANIMATIONS!');
    };

    // Set up callback for bucket added/updated
    whiteboardService.onBucketAdded = (data) => {
      // console.log('[LearnerSession] Bucket added:', data);
      setBuckets(prev => {
        const exists = prev.find(bucket => bucket.id === data.id);
        if (!exists) {
          // NOTE: Don't denormalize here - Whiteboard component handles it
          // This handler should not be used if Whiteboard is mounted
          return [...prev, data];
        }
        return prev;
      });
    };

    // NOTE: onBucketUpdate handler - updates bucket and moves items inside it
    whiteboardService.onBucketUpdate = (data) => {
      if (data.removed) {
        setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
      } else {
        setBuckets(prev => prev.map(bucket => {
          if (bucket.id === data.id) {
            // Calculate delta between old and new bucket position
            const dx = (data.x !== undefined ? data.x : bucket.x) - bucket.x;
            const dy = (data.y !== undefined ? data.y : bucket.y) - bucket.y;

            // Move items inside this bucket by the same delta
            setCanvasItems(prevItems => prevItems.map(item => {
              if (item.inBucket === data.id) {
                return {
                  ...item,
                  x: item.x + dx,
                  y: item.y + dy
                };
              }
              return item;
            }));

            // Update bucket position and size (width/height for resize operations)
            return {
              ...bucket,
              ...(data.x !== undefined && { x: data.x }),
              ...(data.y !== undefined && { y: data.y }),
              ...(data.width !== undefined && { width: data.width }),
              ...(data.height !== undefined && { height: data.height })
            };
          }
          return bucket;
        }));
      }
    };

    // YouTube popup event listeners
    whiteboardService.onYoutubePopupCreated = (data) => {
      // console.log('[LearnerSession] YouTube popup received from trainer:', data);
      const newPopup = {
        id: data.popupId,
        videoId: data.videoId,
        title: data.title,
        position: data.position,
      };
      setYoutubePopups(prev => [...prev, newPopup]);
    };

    whiteboardService.onYoutubePopupClosed = (data) => {
      // console.log('[LearnerSession] YouTube popup closed from trainer:', data.popupId);
      setYoutubePopups(prev => prev.filter(popup => popup.id !== data.popupId));
    };

    // Set up callback for background music from trainer
    whiteboardService.onBackgroundMusic = (data) => {
      // console.log('[LearnerSession] Background music command from trainer:', data);
      if (data.playing) {
        // Start playing music
        setBackgroundMusicPlaying(true);
        if (learnerAudioRef.current) {
          learnerAudioRef.current.src = data.musicUrl;
          learnerAudioRef.current.loop = true;
          learnerAudioRef.current.volume = data.volume || 0.5; // Use trainer's volume
          learnerAudioRef.current.play().catch(err => { /* console.log('Audio play error:', err); */ });
        }
      } else {
        // Stop playing music
        setBackgroundMusicPlaying(false);
        if (learnerAudioRef.current) {
          learnerAudioRef.current.pause();
        }
      }
    };

    // Set up callback for background music volume changes
    whiteboardService.onBackgroundMusicVolume = (data) => {
      // console.log('[LearnerSession] Background music volume changed:', data.volume);
      if (learnerAudioRef.current) {
        learnerAudioRef.current.volume = data.volume;
      }
    };

    // Set up callback for exercise updates from trainer
    whiteboardService.onExerciseUpdate = (data) => {
      // console.log('[LearnerSession] 📋 Exercise update received from trainer:', data);

      // Handle both new qaItems format and old question format for backward compatibility
      if (data.qaItems && Array.isArray(data.qaItems)) {
        // console.log('[LearnerSession] Setting exerciseData with qaItems:', data.qaItems);
        setExerciseData({
          qaItems: data.qaItems
        });
      } else if (data.question) {
        // console.log('[LearnerSession] Setting exerciseData with question:', data.question);
        setExerciseData({
          question: data.question
        });
      }
    };

    // Set up callback for real-time answer updates from trainer's display
    whiteboardService.onExerciseAnswerUpdate = (data) => {
      // console.log('[LearnerSession] Exercise answer update received:', data);
      if (data.qaItems) {
        setExerciseData(prev => ({
          ...prev,
          qaItems: data.qaItems
        }));
      } else {
        setExerciseData(prev => ({
          ...prev,
          question: data.question,
          learnerAnswer: data.learnerAnswer
        }));
      }
    };

    // Set up callback for exercise closed from trainer
    whiteboardService.onExerciseClosed = (data) => {
      // console.log('[LearnerSession] Exercise closed by trainer:', data);
      setExerciseData({
        qaItems: [],
        question: ''
      });
    };

    return () => {
      // Cleanup callbacks
      if (whiteboardService) {
        whiteboardService.onToolAccess = null;
        whiteboardService.onPromptUpdate = null;
        whiteboardService.onItemUpdate = null;
        whiteboardService.onItemRemove = null;
        whiteboardService.onErasePen = null;
        whiteboardService.onClearCanvas = null;
        whiteboardService.onBucketAdded = null;
        whiteboardService.onBucketUpdate = null;
        whiteboardService.onYoutubePopupCreated = null;
        whiteboardService.onYoutubePopupClosed = null;
        whiteboardService.onBackgroundMusic = null;
        whiteboardService.onBackgroundMusicVolume = null;
        whiteboardService.onExerciseUpdate = null;
        whiteboardService.onExerciseAnswerUpdate = null;
        whiteboardService.onExerciseClosed = null;
      }
    };
  }, [whiteboardService, sessionInfo, floatingAnimations, canvasItems, buckets]);

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
        setTimeExpired(true);
        toast.info('Session time has ended.');
        cleanup(); // Auto-end session
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
  }, [sessionInfo]);

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
          padding: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
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
            // min-height: 100dvh !important;
            // min-height: 100vh !important;
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
      {/* Hidden audio element for background music */}
      <audio
        ref={learnerAudioRef}
        crossOrigin="anonymous"
      />

      {/* Navigation / Header - Auto-hide on mobile */}
      {/* <div className={`session-header ${navbarClassName}`}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">HurshBin Learner</div>
            <div className="session-header-subtitle">
              {sessionInfo?.title ?? 'Training Session'} — Trainer : {sessionInfo?.trainer_name ?? 'Trainer'}
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
      </div> */}

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

        {/* Header with Metrics - Full width */}
        <div className="learner-metrics-header" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 8px',
          backgroundColor: 'white',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          flexWrap: 'wrap',
          margin: '0',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Divider */}
          <div style={{ width: '1px', height: '24px', backgroundColor: '#d1d5db' }}></div>

          {/* Prompt Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#d97706' }}>P:</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#d97706' }}>{promptMeter ?? 0}</span>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '24px', backgroundColor: '#d1d5db' }}></div>

          {/* Reinforcement Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#16a34a' }}>R:</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#16a34a' }}>{reinforcementMeter ?? 0}</span>
          </div>
          {/* Divider */}
          <div style={{ width: '1px', height: '24px', backgroundColor: '#d1d5db' }}></div>

          {/* Prompt Line with Bulb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              onClick={() => setIsPromptLineOpen(!isPromptLineOpen)}
              style={{
                fontSize: '24px',
                cursor: 'pointer',
                filter: promptLineAnimating ? 'drop-shadow(0 0 12px #fbbf24) drop-shadow(0 0 20px rgba(251, 191, 36, 0.6))' : promptText !== '[Prompts from trainer will appear here]' ? 'drop-shadow(0 0 8px #fbbf24)' : 'none',
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
                borderRadius: '6px',
                padding: '8px 12px',
                border: promptText !== '[Prompts from trainer will appear here]' ? '2px solid #fbbf24' : '1px solid #e5e7eb',
                maxWidth: '300px',
                transition: 'border 0.3s ease'
              }}>
                <p style={{ fontSize: '12px', color: '#374151', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {promptText !== '[Prompts from trainer will appear here]' ? promptText : 'Waiting for prompt...'}
                </p>
              </div>
            )}
          </div>


        </div>

        {/* Whiteboard - Fills remaining space */}
        <div className="learner-whiteboard-wrapper">
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="session-whiteboard-container">
              {/* Fixed Video Feed Overlay - Trainer's Video (Top Right Corner) */}
              {remoteStream && (
                <div style={{
                  position: 'fixed',
                  top: '55px',
                  right: '2px',
                  width: 'clamp(200px, 20vw, 350px)',
                  height: 'clamp(150px, 15vw, 260px)',
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
                </div>
              )}

              {/* Whiteboard component - keep logic intact */}
              <div className="w-full h-full">
                <Whiteboard
                  canvasRefForParent={whiteboardCanvasRef}
                  whiteboardService={whiteboardService}
                  isTrainer={false}
                  canvasItems={canvasItems}
                  setCanvasItems={setCanvasItems}
                  isFrozen={false}
                  isPaused={false}
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
                  stopwatchFormattedTime={syncedElapsedTime > 0 ? stopwatch.formatTime(syncedElapsedTime) : null}
                  stopwatchIsRunning={syncedIsRunning}
                />
              </div>
            </div>
          </div>
        </div>

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

        {/* Exercise Tool */}
        {(exerciseData.question || (exerciseData.qaItems && exerciseData.qaItems.length > 0)) && (
          <div className="exercise-tool-container">
            <Exercise
              isTrainer={false}
              onExerciseSubmit={handleExerciseSubmit}
              onAnswerChange={handleExerciseAnswerChange}
              whiteboardService={whiteboardService}
              initialExercise={exerciseData}
            />
          </div>
        )}

        {/* Comments Panel */}
        <AttendeeCommentsPanel
          isOpen={isCommentsOpen && !exerciseData.question && !exerciseData.qaItems?.length}
          setIsOpen={setIsCommentsOpen}
          trainerComments={trainerComments}
          commentInput={commentInput}
          setCommentInput={setCommentInput}
          onSendComment={debouncedSendComment}
          onFlushComment={flushSendComment}
          sessionType="learner"
        />

        {/* Waiting for Trainer Modal */}
        {showWaitingModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '480px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              textAlign: 'center',
              animation: 'slideUp 0.3s ease-out',
            }}>
              <style>{`
              @keyframes slideUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
              }
            `}</style>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '24px',
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                  <Clock size={48} color="#f59e0b" style={{ animation: 'spin 2s linear infinite' }} />
                </div>
              </div>

              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 12px 0',
              }}>
                Waiting for Trainer
              </h2>

              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0 0 24px 0',
                lineHeight: '1.6',
              }}>
                The trainer is starting the session. You'll be automatically added once they begin! ✨
              </p>

              <div style={{
                backgroundColor: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                fontSize: '13px',
                color: '#1e40af',
              }}>
                🔄 Auto-joining in progress... or click "Retry Now" to join immediately
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}>
                <button
                  onClick={handleRetryJoin}
                  disabled={retrying}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    backgroundColor: retrying ? '#d1d5db' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: retrying ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!retrying) e.target.style.backgroundColor = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    if (!retrying) e.target.style.backgroundColor = '#10b981';
                  }}
                >
                  {retrying ? 'Checking...' : '🔄 Retry Now'}
                </button>

                <button
                  onClick={() => {
                    setShowWaitingModal(false);
                    navigate('/learner/dashboard');
                  }}
                  disabled={retrying}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    backgroundColor: retrying ? '#d1d5db' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: retrying ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!retrying) e.target.style.backgroundColor = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    if (!retrying) e.target.style.backgroundColor = '#3b82f6';
                  }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearnerSession;
