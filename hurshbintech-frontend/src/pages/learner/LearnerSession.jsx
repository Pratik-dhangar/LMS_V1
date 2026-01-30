

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
import useMessages from '../../hooks/useMessages';
import useComments from '../../hooks/useComments';
import useStopwatch from '../../hooks/useStopwatch';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { playTickSound, playCelebrationSound } from '../../utils/stopwatchSounds';
import { markSessionActive, clearSessionActivity, updateSessionActivity } from '../../utils/sessionActivityTracker';
import { denormalizeItem } from '../../utils/drawingSync';
import '../../styles/components/common/sessionHeader.css';


const LearnerSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // Auto-hide navbar hook
  const { navbarClassName, pageClassName } = useAutoHideNavbar();

  // WebRTC and Whiteboard
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);

  // Stream state (only remote - trainer's video)
  const [remoteStream, setRemoteStream] = useState(null);
  const remoteVideoRef = useRef(null);

  // Video position and size for moveable video feed (trainer's video overlay on whiteboard)
  const [videoPosition, setVideoPosition] = useState({ x: 20, y: 20 });
  const [videoSize, setVideoSize] = useState({ width: 320, height: 240 });

  // Canvas ref for denormalization
  const whiteboardCanvasRef = useRef(null);

  // UI and session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [timeLeft, setTimeLeft] = useState(null);
  const [canvasItems, setCanvasItems] = useState([]);
  const [_timeExpired, setTimeExpired] = useState(false);

  // Prompt and message placeholders
  const [promptText, setPromptText] = useState('[Prompts from trainer will appear here]');
  const [promptVisible, setPromptVisible] = useState(false); // Toggle prompt line visibility (collapsed by default)
  const [isEyeBlinking, setIsEyeBlinking] = useState(false); // Eye blinking animation when new prompt received
  const [textMessages, setTextMessages] = useState([]); // For text messages displayed on whiteboard
  const [feedbackMessage, setFeedbackMessage] = useState(''); // For feedback messages displayed on whiteboard
  const [waitingMessage, setWaitingMessage] = useState(''); // For waiting message displayed on whiteboard
  const [floatingAnimations, setFloatingAnimations] = useState([]); // For floating bubbles, smileys, balloons, stars

  // YouTube popups synced from trainer
  const [youtubePopups, setYoutubePopups] = useState([]); // Array of { id, videoId, title, position }

  // Hamburger menu state for responsive sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Collapsible section states
  const [isPromptLineOpen, setIsPromptLineOpen] = useState(false);
  const [isPrompterMeterOpen, setIsPrompterMeterOpen] = useState(false);
  const [isReinforcementMeterOpen, setIsReinforcementMeterOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [promptLineAnimating, setPromptLineAnimating] = useState(false);

  // Use messages hook
  const { messages, currentMessage, setCurrentMessage, sendMessage, handleKeyPress, addReceivedMessage } = useMessages(webRTC, 'learner');

  // -----------------------------------------------------------  
  // 🔹 Purpose: Comments using custom hook (learner can send, but panel only shows when trainer opens)
  // 🔸 How it works: useComments hook receives comments from trainer, learner can also send
  // -----------------------------------------------------------  
  const {
    trainerComments,
    commentInput,
    setCommentInput,
    sendComment,
    addReceivedComment
  } = useComments(whiteboardService, 'learner');

  // -----------------------------------------------------------  
  // 🔹 Purpose: Set up Whiteboard comment callback
  // 🔸 How it works: When a comment is received via Whiteboard, add it to comments
  // -----------------------------------------------------------  
  useEffect(() => {
    if (whiteboardService) {
      whiteboardService.onCommentUpdate = (data) => {
        // Normalize incoming comment data
        const normalized = {
          text: data.text || data.message || '',
          type: data.type || 'trainer',
          timestamp: data.timestamp || new Date().toISOString()
        };
        addReceivedComment(normalized);
      };

      // Handle comments tool toggle from trainer
      whiteboardService.onCommentsToggle = (data) => {
        console.log('[LearnerSession] Comments toggle received:', data);
        setIsCommentsOpen(data.visible);
      };
    }
    return () => {
      if (whiteboardService) {
        whiteboardService.onCommentUpdate = null;
        whiteboardService.onCommentsToggle = null;
      }
    };
  }, [whiteboardService, addReceivedComment, setIsCommentsOpen]);

  // Debounced comment sender to avoid sending on every keystroke.
  const commentDebounceTimer = useRef(null);

  const debouncedSendComment = useCallback((message) => {
    const DELAY = 300; // ms
    if (commentDebounceTimer.current) {
      clearTimeout(commentDebounceTimer.current);
    }
    commentDebounceTimer.current = setTimeout(() => {
      if (whiteboardService) {
        whiteboardService.send('comment_update', {
          text: message,
          type: 'learner',
          timestamp: new Date().toISOString()
        });
      }
      commentDebounceTimer.current = null;
    }, DELAY);
  }, [whiteboardService]);

  const flushSendComment = useCallback((message) => {
    if (commentDebounceTimer.current) {
      clearTimeout(commentDebounceTimer.current);
      commentDebounceTimer.current = null;
    }
    if (whiteboardService) {
      whiteboardService.send('comment_update', {
        text: message,
        type: 'learner',
        timestamp: new Date().toISOString()
      });
    }
  }, [whiteboardService]);

  useEffect(() => {
    return () => {
      if (commentDebounceTimer.current) {
        clearTimeout(commentDebounceTimer.current);
        commentDebounceTimer.current = null;
      }
    };
  }, []);

  // Listen for feedback message state changes to debug
  useEffect(() => {
    if (!feedbackMessage) return;
    // console.log('[LearnerSession] feedbackMessage state changed to:', feedbackMessage);
  }, [feedbackMessage]);

  // Set up WebRTC message callback
  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        // console.log('[LearnerSession] Message received:', message);
        addReceivedMessage(message);
      };

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
        webRTC.onMessage = null;
        webRTC.onPromptText = null;
      }
    };
  }, [webRTC, addReceivedMessage]);

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

  // Meter states
  const [promptMeter, setPromptMeter] = useState(null);
  const [reinforcementMeter, setReinforcementMeter] = useState(null);

  // Callbacks for meter updates
  const [_onPromptMeterUpdate] = useState(null);
  const [_onReinforcementMeterUpdate] = useState(null);

  // Media controls state
  const [_micEnabled] = useState(true);
  const [_cameraEnabled] = useState(true);
  const [_hasLocalAudio] = useState(false);
  const [_hasLocalVideo] = useState(false);

  // Tool access permissions from trainer
  const [toolAccess, setToolAccess] = useState({
    select: false,
    drag: false
  });
  const [_selectedItemId] = useState(null); // Track learner's own selection

  // -----------------------------------------------------------
  // 🔹 Purpose: Background music player state
  // 🔸 How it works: learner receives music commands from trainer
  // -----------------------------------------------------------
  const [backgroundMusicPlaying, setBackgroundMusicPlaying] = useState(false);
  const learnerAudioRef = useRef(null); // Reference to audio element

  // Canvas clear triggers (for syncing with trainer)
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [erasePenTrigger, setErasePenTrigger] = useState(0);
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

  // Buckets and whiteboard settings from trainer
  const [buckets, setBuckets] = useState([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [bucketColor, setBucketColor] = useState('#8B6F47'); // Default bucket color (Brown - synced from trainer)
  const [_isPaused] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
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
    toast.success('Keyword found! ✓');
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
      setFeedbackMessage(data.message);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setFeedbackMessage('');
      }, 3000);
    };

    // Set up callback for waiting messages from trainer
    whiteboardService.onWaitingMessage = (data) => {
      // console.log('[LearnerSession] Waiting message received from trainer:', data);
      setWaitingMessage(data.message);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setWaitingMessage('');
      }, 3000);
    };

    // Set up callback for floating animations from trainer
    whiteboardService.onFloatingAnimations = (data) => {
      // console.log('[LearnerSession] Floating animations received from trainer:', data);
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
          if (existingIndex >= 0) {
            // Update existing item
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...data };
            return updated;
          } else {
            // Add new item
            return [...prev, data];
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
          return [...prev, data];
        }
        return prev;
      });
    };

    whiteboardService.onBucketUpdate = (data) => {
      // console.log('[LearnerSession] Bucket updated:', data);
      if (data.removed) {
        setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
      } else {
        // Update bucket directly - no normalization/denormalization needed
        // Buckets use absolute pixel positioning as overlay elements
        setBuckets(prev => prev.map(bucket =>
          bucket.id === data.id ? { ...bucket, ...data } : bucket
        ));
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
          console.warn('[LearnerSession] Session already active:', sessionCheck.message);
          toast.error(sessionCheck.message);
          navigate('/learner/dashboard');
        }
        return;
      }

      await sessionService.joinSession(sessionId);
      // toast.success('Joined session successfully');

      await initializeWebRTC();
      setLoading(false);
    } catch (error) {
      console.error('Error initializing session:', error);
      toast.error('Failed to join session');
      navigate('/learner/dashboard');
    }
  };

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
      toast.warning('This action is blocked while window is frozen', { autoClose: 1000 });
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
      toast.error('You cannot switch windows while frozen!', { autoClose: 2000 });
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
    <div className={`learner-session-page ${pageClassName}`}>
      {/* Hidden audio element for background music */}
      <audio
        ref={learnerAudioRef}
        crossOrigin="anonymous"
      />

      {/* Navigation / Header - Auto-hide on mobile */}
      <div className={`session-header ${navbarClassName}`}>
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
      </div>

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

      {/* Frozen Mode Indicator
      {isFrozen && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white py-3 px-4 text-center font-bold z-[9999] shadow-lg animate-pulse">
          🔒 WINDOW FROZEN BY TRAINER - You cannot switch, minimize, or close this window
        </div>
      )} */}

      {/* Main Container - Responsive 3-column layout */}
      <div className="flex flex-col gap-3 sm:gap-5 md:gap-6 my-3 sm:my-5 md:my-6 mx-2 sm:mx-4 md:mx-6 items-start learner-responsive-layout" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <div className={`w-full bg-white p-2 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar transition-transform duration-300 learner-responsive-sidebar-left md:relative ${isSidebarOpen ? 'fixed top-20 left-0 bottom-0 w-[85%] max-w-[450px] z-[999] transform translate-x-0 order-1' : 'max-md:fixed max-md:-translate-x-full max-md:order-1 md:order-1'}`}>
          {/* Prompt Line Section */}
          <div className="rounded-2xl mb-3 overflow-hidden shadow-md hover:shadow-lg transition-all duration-500"
            style={{
              background: 'linear-gradient(135deg, #fffbf7 0%, #fffef9 100%)',
              border: '1px solid rgba(217, 119, 6, 0.2)',
              ...(promptLineAnimating ? {
                boxShadow: '0 0 20px rgba(218, 165, 32, 0.3), 0 2px 12px rgba(217, 119, 6, 0.15)'
              } : {})
            }}>
            <div
              onClick={() => setIsPromptLineOpen(!isPromptLineOpen)}
              className="flex items-center justify-between cursor-pointer p-4 sm:p-5 transition-all duration-300 hover:bg-amber-50/50"
            >
              <h3 className="font-bold text-sm md:text-base text-gray-800">Prompt Line (For Prompter)</h3>
              <span className="text-amber-600 text-lg transition-transform duration-300" style={{
                transform: isPromptLineOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>{isPromptLineOpen ? '▼' : '▶'}</span>
            </div>
            {isPromptLineOpen && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <div className="bg-white rounded-xl overflow-hidden" style={{
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(217, 119, 6, 0.15)'
                }}>
                  <textarea
                    value={promptText}
                    readOnly
                    className="w-full h-24 p-4 sm:p-5 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 text-xs sm:text-sm md:text-base resize-none focus:outline-none border-0"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="rounded-2xl mb-3 overflow-hidden shadow-md hover:shadow-lg transition-shadow" style={{
            background: 'linear-gradient(135deg, #fef9f3 0%, #fffbf7 100%)',
            border: '1px solid rgba(219, 157, 50, 0.2)'
          }}>
            <div
              onClick={() => setIsPrompterMeterOpen(!isPrompterMeterOpen)}
              className="flex items-center justify-between cursor-pointer p-4 sm:p-5 transition-all duration-300 hover:bg-yellow-50/50"
            >
              <h3 className="font-bold text-sm md:text-base text-gray-800">Prompt Level</h3>
              <span className="text-amber-600 text-lg transition-transform duration-300" style={{
                transform: isPrompterMeterOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>{isPrompterMeterOpen ? '▼' : '▶'}</span>
            </div>
            {isPrompterMeterOpen && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <div className="bg-white rounded-xl p-4 sm:p-5" style={{
                  boxShadow: '0 2px 8px rgba(219, 157, 50, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(219, 157, 50, 0.15)'
                }}>
                  <div className="text-xs sm:text-sm text-gray-500 font-medium mb-2 tracking-wide">PROMPT LEVEL</div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-600">
                    {promptMeter ?? 0}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl mb-3 overflow-hidden shadow-md hover:shadow-lg transition-shadow" style={{
            background: 'linear-gradient(135deg, #fef9f3 0%, #fffbf7 100%)',
            border: '1px solid rgba(34, 197, 94, 0.2)'
          }}>
            <div
              onClick={() => setIsReinforcementMeterOpen(!isReinforcementMeterOpen)}
              className="flex items-center justify-between cursor-pointer p-4 sm:p-5 transition-all duration-300 hover:bg-yellow-50/50"
            >
              <h3 className="font-bold text-sm md:text-base text-gray-800">Reinforcement Level</h3>
              <span className="text-amber-600 text-lg transition-transform duration-300" style={{
                transform: isReinforcementMeterOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>{isReinforcementMeterOpen ? '▼' : '▶'}</span>
            </div>
            {isReinforcementMeterOpen && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <div className="bg-white rounded-xl p-4 sm:p-5" style={{
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(34, 197, 94, 0.15)'
                }}>
                  <div className="text-xs sm:text-sm text-gray-500 font-medium mb-2 tracking-wide">REINFORCEMENT LEVEL</div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-600">
                    {reinforcementMeter ?? 0}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-2xl mb-3 overflow-hidden shadow-md hover:shadow-lg transition-shadow" style={{
            background: 'linear-gradient(135deg, #f8f9fa 0%, #f5f6f7 100%)',
            border: '1px solid rgba(107, 114, 128, 0.15)'
          }}>
            <div
              onClick={() => setIsMessagesOpen(!isMessagesOpen)}
              className="flex items-center justify-between cursor-pointer p-4 sm:p-5 transition-all duration-300 hover:bg-gray-100/30"
            >
              <h3 className="font-bold text-xs sm:text-sm md:text-base text-gray-800">Messages</h3>
              <span className="text-gray-600 text-lg transition-transform duration-300" style={{
                transform: isMessagesOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>{isMessagesOpen ? '▼' : '▶'}</span>
            </div>
            {isMessagesOpen && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <div className="bg-white rounded-xl overflow-hidden" style={{
                  boxShadow: '0 2px 8px rgba(107, 114, 128, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(107, 114, 128, 0.12)'
                }}>
                  <div className="max-h-[120px] sm:max-h-[150px] md:max-h-[200px] overflow-y-auto p-4 sm:p-5">
                    {messages.length > 0 ? (
                      messages.map((msg, idx) => (
                        <div key={idx} className="mb-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg text-xs md:text-sm border border-gray-200/50">
                          <strong className="text-gray-800 font-semibold">{msg.sender === 'You' ? 'Trainer' : msg.sender}:</strong>
                          <span className="text-gray-700 ml-2">{msg.text}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs sm:text-sm md:text-base font-semibold text-gray-600">{sessionInfo?.trainer_name ?? 'Trainer'}:</p>
                        <p className="text-xs sm:text-xs md:text-sm text-gray-500">Great job on the last activity!</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 w-full min-w-0 mt-4 pt-4 border-t border-gray-200/50">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="[Type message...]"
                      className="flex-1 min-w-0 ml-1 mb-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                    />
                    <button
                      onClick={sendMessage}
                      className="flex-shrink-0 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comments Section - Appears when trainer opens it */}
          <div className="rounded-2xl mb-3 overflow-hidden shadow-md hover:shadow-lg transition-shadow" style={{
            background: 'linear-gradient(135deg, #f3f4f6 0%, #f5f6f8 100%)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            display: isCommentsOpen ? 'block' : 'none'
          }}>
            <div
              className="flex items-center justify-between cursor-pointer p-4 sm:p-5 transition-all duration-300 hover:bg-blue-50/30"
            >
              <h3 className="font-bold text-xs sm:text-sm md:text-base text-gray-800">💬 Comments</h3>
            </div>
            {isCommentsOpen && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <div className="bg-white rounded-xl overflow-hidden" style={{
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(59, 130, 246, 0.12)'
                }}>
                  {/* Learner Comments Input Section - Real-time Sync */}
                  <div className="p-4 sm:p-5">
                    <div className="font-semibold text-gray-700 text-xs sm:text-sm mb-2">👨‍🎓 Your Comments</div>
                    <textarea
                      value={commentInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCommentInput(val);
                        debouncedSendComment(val);
                      }}
                      onBlur={() => flushSendComment(commentInput)}
                      placeholder="Type your comment"
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-all resize-none"
                      style={{ minHeight: '80px' }}
                    />

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Whiteboard Area - Scrollable Container */}
        <div className="w-full learner-responsive-main-area learner-responsive-whiteboard-section mx-auto overflow-y-auto">
          <div className="session-whiteboard-container">
            {/* Moveable Video Feed Overlay - Trainer's Video */}
            {remoteStream && (
              <MoveableVideoFeed
                videoStream={remoteStream}
                label="Trainer"
                position={videoPosition}
                size={videoSize}
                onPositionChange={setVideoPosition}
                onSizeChange={setVideoSize}
                isDraggable={true}
                isResizable={true}
                connectionStatus={connectionStatus}
                zIndex={100}
              />
            )}

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

        </div>
      </div>
    </div>
  );
};

export default LearnerSession;
