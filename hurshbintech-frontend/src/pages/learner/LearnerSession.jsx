

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaBars, FaTimes } from 'react-icons/fa';
import sessionService from '../../api/services/sessionService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import Whiteboard from '../../components/common/Whiteboard';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import Emoji from '../../components/common/Emoji';
import LearnerVideoConference from '../../components/videoConference/LearnerVideoConference';
import MoveableVideoFeed from '../../components/videoConference/MoveableVideoFeed';
import useMessages from '../../hooks/useMessages';
import useStopwatch from '../../hooks/useStopwatch';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { playTickSound, playCelebrationSound } from '../../utils/stopwatchSounds';
import { markSessionActive, clearSessionActivity, updateSessionActivity } from '../../utils/sessionActivityTracker';
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

  // Video position and size for moveable video feed
  const [videoPosition, setVideoPosition] = useState({ x: 20, y: 20 });
  const [videoSize, setVideoSize] = useState({ width: 320, height: 240 });

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
  const [textMessages, setTextMessages] = useState([]); // For keyboard text messages displayed on whiteboard
  const [feedbackMessage, setFeedbackMessage] = useState(''); // For feedback messages displayed on whiteboard
  const [waitingMessage, setWaitingMessage] = useState(''); // For waiting message displayed on whiteboard
  const [floatingAnimations, setFloatingAnimations] = useState([]); // For floating bubbles, smileys, balloons, stars

  // Hamburger menu state for responsive sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Use messages hook
  const { messages, currentMessage, setCurrentMessage, sendMessage, handleKeyPress, addReceivedMessage } = useMessages(webRTC, 'learner');

  // Listen for feedback message state changes to debug
  useEffect(() => {
    if (!feedbackMessage) return;
    console.log('[LearnerSession] feedbackMessage state changed to:', feedbackMessage);
  }, [feedbackMessage]);

  // Set up WebRTC message callback
  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        console.log('[LearnerSession] Message received:', message);
        addReceivedMessage(message);
      };

      // Set up prompt text handler
      webRTC.onPromptText = (data) => {
        console.log('[LearnerSession] Prompt text received from trainer:', data);
        setPromptText(data.text);
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
    drag: false,
    keyboard: false
  });
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [_selectedItemId] = useState(null); // Track learner's own selection
  const [isShiftActive, setIsShiftActive] = useState(false); // For shift/caps lock
  const [isCapsLock, setIsCapsLock] = useState(false); // For persistent caps lock

  // Canvas clear triggers (for syncing with trainer)
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [erasePenTrigger, setErasePenTrigger] = useState(0);
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

  // Buckets and whiteboard settings from trainer
  const [buckets, setBuckets] = useState([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [_isPaused] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [keyboardMode] = useState(false); // Keep this defined for Whiteboard prop
  const [trainerJoined, setTrainerJoined] = useState(false); // Track if trainer has joined
  const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]); // Track remote user's selections

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
      console.log('[LearnerSession] Could not play pop sound:', error);
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

    setFloatingAnimations(prev =>
      prev.map(a => a.id === animationId ? { ...a, popped: true, poppedLeft, poppedTop } : a)
    );

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
      console.log('🎉 Learner: Countdown finished! Playing celebration...', {
        prevTime, syncedElapsedTime, wasRunning, syncedIsRunning
      });
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
      console.log('[LearnerSession] Tool access update:', data);
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

      // Show keyboard when keyboard permission is granted
      if (data.toolName === 'keyboard' && data.enabled) {
        setShowKeyboard(true);
        setKeyboardText(''); // Reset text when keyboard opens
        // toast.info('Virtual keyboard activated');
      } else if (data.toolName === 'keyboard' && !data.enabled) {
        setShowKeyboard(false);
      }
    };

    // Set up callback for keyboard trigger — show keyboard until trainer revokes
    whiteboardService.onTriggerKeyboard = () => {
      console.log('[LearnerSession] Keyboard triggered by trainer');
      setShowKeyboard(true);
      // Do not auto-hide — the keyboard will remain visible until trainer revokes 'keyboard' access
    };

    // NOTE: Auto-send prompt via whiteboardService disabled - only manual send via webRTC.sendPrompt is used

    // Set up callback for feedback messages from trainer
    whiteboardService.onFeedbackMessage = (data) => {
      console.log('[LearnerSession] Feedback message received from trainer:', data);
      setFeedbackMessage(data.message);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setFeedbackMessage('');
      }, 3000);
    };

    // Set up callback for waiting messages from trainer
    whiteboardService.onWaitingMessage = (data) => {
      console.log('[LearnerSession] Waiting message received from trainer:', data);
      setWaitingMessage(data.message);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setWaitingMessage('');
      }, 3000);
    };

    // Set up callback for floating animations from trainer
    whiteboardService.onFloatingAnimations = (data) => {
      console.log('[LearnerSession] Floating animations received from trainer:', data);
      setFloatingAnimations(prev => [...prev, ...data.animations]);

      // Auto-remove after 13 seconds (same as trainer)
      setTimeout(() => {
        setFloatingAnimations(prev =>
          prev.filter(a => !data.animations.find(na => na.id === a.id))
        );
      }, 13000);
    };

    // Set up callback for animation pop events from other learners
    whiteboardService.onAnimationPopped = (data) => {
      console.log('[LearnerSession] Animation popped by another user:', data);
      handleAnimationPop(data.animationId, data.poppedLeft, data.poppedTop);
    };

    // Debug - log feedbackMessage state changes
    // (we'll watch this console in the learner's browser to confirm receipt)
    // useEffect can't be declared in this block; we add a top-level effect below

    // Set up callback for item removal from trainer
    whiteboardService.onItemRemove = (data) => {
      console.log('[LearnerSession] Item remove received:', data);
      if (data?.id) {
        setCanvasItems(prev => prev.filter(item => item.id !== data.id));
      }
    };

    // Set up callback for item updates from trainer (including new exercises)
    whiteboardService.onItemUpdate = (data) => {
      console.log('[LearnerSession] Item update received:', data);
      if (data?.id && data?.type) {
        // If the item has a `targetLearnerId`, only show it to that learner
        if (data.targetLearnerId) {
          // Convert both IDs to strings for comparison to handle string/number mismatches
          const targetId = String(data.targetLearnerId);
          const myId = String(sessionInfo?.learner_id || '');

          console.log('[LearnerSession] Targeted item check:', {
            itemId: data.id,
            targetLearnerId: targetId,
            myLearnerId: myId,
            sessionInfoLoaded: !!sessionInfo,
            match: targetId === myId
          });

          if (myId && targetId !== myId) {
            console.log('[LearnerSession] Item not for this learner, ignoring');
            return; // Don't add this item
          }

          console.log('[LearnerSession] Item is for this learner, adding to canvas');
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

    // Set up callback for erase pen event from trainer
    whiteboardService.onErasePen = () => {
      console.log('[LearnerSession] Received erase pen event from trainer');
      setErasePenTrigger(prev => prev + 1);
      setRedrawCanvasTrigger(prev => prev + 1);
    };

    // Set up callback for clear canvas event (also clears video, items, and buckets)
    whiteboardService.onClearCanvas = () => {
      console.log('[LearnerSession] Received clear canvas event from trainer');
      setClearCanvasTrigger(prev => prev + 1);
      // Also clear all canvas items and buckets
      setCanvasItems([]);
      setBuckets([]);
      setFloatingAnimations([]); // Clear all floating animations (bubbles, balloons, smileys, stars)
    };

    // Set up callback for bucket added/updated
    whiteboardService.onBucketAdded = (data) => {
      console.log('[LearnerSession] Bucket added:', data);
      setBuckets(prev => {
        const exists = prev.find(bucket => bucket.id === data.id);
        if (!exists) {
          return [...prev, data];
        }
        return prev;
      });
    };

    whiteboardService.onBucketUpdate = (data) => {
      console.log('[LearnerSession] Bucket updated:', data);
      if (data.removed) {
        setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
      } else {
        setBuckets(prev => prev.map(bucket =>
          bucket.id === data.id ? { ...bucket, ...data } : bucket
        ));
      }
    };

    return () => {
      // Cleanup callbacks
      if (whiteboardService) {
        whiteboardService.onToolAccess = null;
        whiteboardService.onTriggerKeyboard = null;
        whiteboardService.onPromptUpdate = null;
        whiteboardService.onItemUpdate = null;
        whiteboardService.onItemRemove = null;
        whiteboardService.onErasePen = null;
        whiteboardService.onClearCanvas = null;
        whiteboardService.onBucketAdded = null;
        whiteboardService.onBucketUpdate = null;
      }
    };
  }, [whiteboardService, sessionInfo]);

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
        console.log('[LearnerSession] Remote user selected items:', data);
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
      console.log('[LearnerSession] Initializing Video Conference service');

      // Set callback for local stream (learner's camera/mic)
      videoService.onLocalStream = (stream) => {
        console.log('[LearnerSession] Local stream received');
        // Learner doesn't display their own video to minimize distraction
      };

      // Set callback for remote stream (trainer's video)
      videoService.onRemoteStream = (stream) => {
        console.log('[LearnerSession] Remote stream received from trainer');
        setRemoteStream(stream);
        setTrainerJoined(true); // Trainer has joined
      };

      // Set callback for connection state changes
      videoService.onConnectionStateChange = (state) => {
        console.log('[LearnerSession] Connection state:', state);
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
        console.log('[LearnerSession] Prompt meter update received:', value);
        setPromptMeter(value);
      };

      // Set callback for reinforcement meter updates from trainer
      videoService.onReinforcementMeterUpdate = (value) => {
        console.log('[LearnerSession] Reinforcement meter update received:', value);
        setReinforcementMeter(value);
      };

      // Set callback for freeze signal from trainer
      videoService.onFreeze = async (message) => {
        console.log('[LearnerSession] Freeze signal received:', message);
        setIsFrozen(message.frozen);
        if (message.frozen) {
          // Show prompt for user to click - fullscreen MUST be triggered by user gesture
          setShowFullscreenPrompt(true);
          console.log('[LearnerSession] Waiting for user interaction to trigger fullscreen');

          // Listen for first user interaction to trigger fullscreen
          const triggerFullscreenOnInteraction = async (event) => {
            console.log('[LearnerSession] User interaction detected, triggering fullscreen...');
            try {
              await enterKioskMode();
              console.log('[LearnerSession] Successfully entered fullscreen mode');
            } catch (err) {
              console.log('[LearnerSession] Fullscreen entry failed, will retry on next interaction');
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

      console.log('[LearnerSession] Video Conference service initialized');
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
      console.log('[LearnerSession] Entering kiosk mode');

      // Request fullscreen AGGRESSIVELY - must be triggered by user gesture
      const elem = document.documentElement;
      let fullscreenSuccess = false;

      console.log('[LearnerSession] Requesting fullscreen...');
      console.log('[LearnerSession] Current fullscreen element:', document.fullscreenElement);

      try {
        if (elem.requestFullscreen) {
          console.log('[LearnerSession] Using requestFullscreen');
          await elem.requestFullscreen({ navigationUI: 'hide' });
          fullscreenSuccess = true;
        } else if (elem.webkitRequestFullscreen) {
          console.log('[LearnerSession] Using webkitRequestFullscreen');
          await elem.webkitRequestFullscreen();
          fullscreenSuccess = true;
        } else if (elem.msRequestFullscreen) {
          console.log('[LearnerSession] Using msRequestFullscreen');
          await elem.msRequestFullscreen();
          fullscreenSuccess = true;
        } else if (elem.mozRequestFullScreen) {
          console.log('[LearnerSession] Using mozRequestFullScreen');
          await elem.mozRequestFullScreen();
          fullscreenSuccess = true;
        } else {
          console.warn('[LearnerSession] No fullscreen API available');
          // Silently fail - user will see the prompt to retry
          throw new Error('Fullscreen API not available');
        }

        if (fullscreenSuccess) {
          console.log('[LearnerSession] Fullscreen activated successfully');
          setShowFullscreenPrompt(false);
        }
      } catch (err) {
        console.warn('[LearnerSession] Fullscreen request failed (this is normal on first try):', err.message);
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
          console.log('[LearnerSession] Could not lock orientation:', err);
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
          console.log('[LearnerSession] Fullscreen exited, re-entering...');
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

      console.log('[LearnerSession] Kiosk mode activated');
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
      console.log('[LearnerSession] Exiting kiosk mode');

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
          console.log('[LearnerSession] Could not unlock orientation:', err);
        }
      }

      console.log('[LearnerSession] Kiosk mode deactivated');
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
          console.log(`[LearnerSession] Stopped ${track.kind} track`);
        });
      }
      webRTC?.close();
      console.log('[LearnerSession] WebRTC closed and media access revoked');
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
  const handleKeyboardKeyPress = (key) => {
    if (key === 'SPACE') {
      setKeyboardText(prev => prev + ' ');
      setIsShiftActive(false);
    } else if (key === 'BACKSPACE') {
      setKeyboardText(prev => prev.slice(0, -1));
      setIsShiftActive(false);
    } else if (key === 'SHIFT') {
      setIsShiftActive(!isShiftActive);
    } else if (key === 'CAPS') {
      setIsCapsLock(!isCapsLock);
      setIsShiftActive(false);
    } else if (key === 'ENTER') {
      setKeyboardText(prev => prev + '\n');
      setIsShiftActive(false);
    } else if (key === 'TAB') {
      setKeyboardText(prev => prev + '\t');
      setIsShiftActive(false);
    } else {
      // Apply shift/caps logic for letters
      let finalKey = key;
      if (typeof key === 'string' && key.length === 1) {
        const isLetter = /[a-z]/i.test(key);
        if (isLetter) {
          if (isShiftActive || isCapsLock) {
            finalKey = key.toUpperCase();
          } else {
            finalKey = key.toLowerCase();
          }
          // Auto-deactivate shift after typing a letter
          if (isShiftActive) {
            setIsShiftActive(false);
          }
        } else {
          // For non-letters, apply shift mapping for special characters
          const shiftMap = {
            '1': '!', '2': '@', '3': '#', '4': '$', '5': '%',
            '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
            '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|',
            ';': ':', '\'': '"', ',': '<', '.': '>', '/': '?', '`': '~'
          };
          if (isShiftActive && shiftMap[key]) {
            finalKey = shiftMap[key];
            setIsShiftActive(false);
          }
        }
      }
      setKeyboardText(prev => prev + finalKey);
    }
  };

  const handleSendText = () => {
    if (keyboardText.trim() === '') {
      toast.warning('Please type something first');
      return;
    }

    // Send text to whiteboard via WebSocket
    if (whiteboardService) {
      const userData = JSON.parse(localStorage.getItem('user_data'));
      const learnerName = userData?.full_name || 'Learner';

      whiteboardService.send('text_added', {
        text: keyboardText,
        sender: learnerName,
        id: Date.now()
      });
      console.log('[LearnerSession] Sent text to whiteboard:', keyboardText);
      // toast.success('Text sent to whiteboard');
      setKeyboardText(''); // Clear after sending
    }
  };

  // Keyboard drag handlers - simplified since keyboard is now in document flow
  const handleKeyboardMouseDown = (e) => {
    if (e.target.closest('button, input')) return; // Don't drag if clicking buttons
    // The keyboard is no longer fixed, so dragging is not needed
    e.preventDefault();
  };

  useEffect(() => {
    // Drag functionality removed since keyboard is positioned below whiteboard
    // Keeping an effect in place for future keyboard drag re-introduction
    // but should not depend on undefined values.
  }, []);

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
        {/* Navigation / Header - Auto-hide on mobile after 5 seconds */}
        <div className={`session-header ${navbarClassName}`}>
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
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Connecting...</span>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
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
      {/* Navigation / Header - Auto-hide on mobile after 5 seconds */}
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
        <div className={`w-full bg-white border-r border-gray-200 p-2 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar transition-transform duration-300 learner-responsive-sidebar-left md:relative ${isSidebarOpen ? 'fixed top-20 left-0 bottom-0 w-[85%] max-w-[450px] z-[999] transform translate-x-0 order-1' : 'max-md:fixed max-md:-translate-x-full max-md:order-1 md:order-1'}`}>
          {/* Trainer Video Feed - Above Prompt Line */}
          {remoteStream && (
            <div className="mb-4 md:mb-5">
              <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg">
                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="absolute top-0 left-0 w-full h-full object-cover"
                  />
                  <div className={`absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold transition-opacity duration-300 ${navbarClassName}`}>
                    Trainer
                  </div>
                  <div className={`absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs transition-opacity duration-300 ${navbarClassName}`}>
                    {connectionStatus}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Video Conferencing - Now on whiteboard */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-1 sm:p-4 md:p-5 mb-4 md:mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPromptVisible(!promptVisible);
                    if (isEyeBlinking) setIsEyeBlinking(false);
                  }}
                  className={`text-yellow-600 hover:text-yellow-800 transition-colors text-lg md:text-xl cursor-pointer hover:bg-yellow-200 rounded p-1 ${isEyeBlinking ? 'animate-eye-blink' : ''}`}
                  title={promptVisible ? 'Hide prompts' : 'Show prompts'}
                >
                  <Emoji emoji="👁" size="lg" />
                </button>
                <h3 className="font-semibold text-sm md:text-base text-gray-700">Prompt Line (For Prompter)</h3>
              </div>
            </div>
            {promptVisible && (
              <div className="bg-white border border-yellow-300 rounded p-2 sm:p-3 md:p-4 min-h-[60px] mb-2">
                <p className="text-gray-700 text-xs sm:text-sm md:text-base">{promptText}</p>
              </div>
            )}
          </div>
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3 sm:p-1 md:p-5 mb-1 md:mb-1">
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-5">
              <div className="bg-white border border-blue-300 rounded p-2 sm:p-3 md:p-1">
                <div className="text-xs sm:text-xs md:text-sm text-gray-600 mb-1">Prompt <br /> Level</div>
                <div className="text-base sm:text-lg md:text-2xl font-bold text-blue-600">
                  {promptMeter ?? 0}
                </div>
              </div>
              <div className="bg-white border border-green-300 rounded p-2 sm:p-3 md:p-1">
                <div className="text-xs sm:text-xs md:text-sm text-gray-600 mb-1">Reinforcement Level</div>
                <div className="text-base sm:text-lg md:text-2xl font-bold text-green-600">
                  {reinforcementMeter ?? 0}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 sm:p-4 md:p-5">
            <h3 className="font-semibold text-xs sm:text-sm md:text-base text-gray-700 mb-2">Messages</h3>
            <div className="bg-white border border-gray-300 rounded p-2 max-h-[120px] sm:max-h-[150px] md:max-h-[200px] overflow-y-auto mb-2">
              {messages.length > 0 ? (
                messages.map((msg, idx) => (
                  <div key={idx} className="mb-2 p-2 bg-gray-50 rounded text-xs md:text-sm">
                    <strong className="text-gray-800">{msg.sender === 'You' ? 'Trainer' : msg.sender}:</strong>
                    <span className="text-gray-700"> {msg.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs sm:text-sm md:text-base font-semibold text-gray-600">{sessionInfo?.trainer_name ?? 'Trainer'}:</p>
                  <p className="text-xs sm:text-xs md:text-sm text-gray-500">Great job on the last activity!</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="[Type message...]"
                className="flex-1 px-3 py-2 text-xs md:text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 md:px-5 md:py-3 bg-blue-500 text-white text-xs md:text-sm rounded hover:bg-blue-600 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
        {/* Whiteboard Area - Scrollable Container */}
        <div className="w-full learner-responsive-main-area learner-responsive-whiteboard-section mx-auto overflow-y-auto">
          <div className="session-whiteboard-container">
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
                stopwatchFormattedTime={syncedElapsedTime > 0 ? stopwatch.formatTime(syncedElapsedTime) : null}
                stopwatchIsRunning={syncedIsRunning}
              />
            </div>
          </div>
          {showKeyboard && (
            <div
              className="rounded-3xl p-6 sm:p-8 shadow-2xl mx-auto w-full max-w-[1086px] mt-4 mb-4 cursor-default touch-none md:p-6"
              style={{
                touchAction: 'none',
                background: 'linear-gradient(135deg, #3d3531 0%, #4a4238 100%)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}
              onMouseDown={handleKeyboardMouseDown}
              onTouchStart={handleKeyboardMouseDown}
            >
              <div className="flex justify-between items-center mb-6 sm:mb-7">
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="text-4xl sm:text-5xl drop-shadow-lg">⌨️</span>
                  <h4 className="m-0 text-amber-100 text-xl sm:text-2xl font-bold tracking-wider cursor-move" style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>
                    Magic Keyboard
                  </h4>
                </div>
              </div>
              <div className="mb-6 sm:mb-7 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch">
                <div
                  className="flex-1 rounded-2xl px-5 sm:px-6 py-3 sm:py-4"
                  style={{
                    background: 'linear-gradient(135deg, #5a4f48 0%, #4d4541 100%)',
                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <p className="text-sm sm:text-base text-amber-50 font-medium whitespace-pre-wrap break-words min-h-[48px] flex items-center">
                    {keyboardText || <span className="text-amber-200 italic opacity-60">✨ Start typing...</span>}
                  </p>
                </div>
                <button
                  onClick={handleSendText}
                  className="text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 shadow-lg hover:shadow-2xl active:scale-95 whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(135deg, #A8A8D8 0%, #9090C8 100%)',
                    boxShadow: '0 8px 25px rgba(168, 168, 216, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                  }}
                >
                  ✨ Send
                </button>
              </div>
              <div
                className="rounded-2xl p-5 sm:p-7 shadow-xl overflow-x-auto"
                style={{
                  background: 'linear-gradient(135deg, #4a4238 0%, #3d3531 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                }}
              >
                <div className="grid gap-3 sm:gap-3">
                  {/* Number Row */}
                  <div className="grid grid-cols-12 gap-2.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='].map(char => {
                      const shiftMap = { '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+' };
                      const displayChar = isShiftActive && shiftMap[char] ? shiftMap[char] : char;
                      return (
                        <button
                          key={char}
                          className="keyboard-key text-gray-800 font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                          style={{
                            background: 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(0, 0, 0, 0.15)'
                          }}
                          onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                          onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                          onClick={() => handleKeyboardKeyPress(char)}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            handleKeyboardKeyPress(char);
                          }}
                        >
                          {displayChar}
                        </button>
                      );
                    })}
                  </div>

                  {/* Q Row */}
                  <div className="grid grid-cols-10 md:grid-cols-10 gap-2.5">
                    {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key text-gray-800 font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                        onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                        onClick={() => handleKeyboardKeyPress(letter)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleKeyboardKeyPress(letter);
                        }}
                      >
                        {isCapsLock || isShiftActive ? letter.toUpperCase() : letter}
                      </button>
                    ))}
                  </div>

                  {/* A Row */}
                  <div className="grid grid-cols-9 md:grid-cols-9 gap-2.5 md:ml-6">
                    {['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key text-gray-800 font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                        onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                        onClick={() => handleKeyboardKeyPress(letter)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleKeyboardKeyPress(letter);
                        }}
                      >
                        {isCapsLock || isShiftActive ? letter.toUpperCase() : letter}
                      </button>
                    ))}
                  </div>

                  {/* Z Row and Special Chars */}
                  <div className="flex gap-2.5">
                    <button
                      className="flex-1 keyboard-key text-white font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                      style={{
                        background: isShiftActive ? 'linear-gradient(135deg, #B89FB8 0%, #A88FA8 100%)' : 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                        boxShadow: isShiftActive ? '0 4px 12px rgba(184, 159, 184, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                        border: isShiftActive ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.15)',
                        color: isShiftActive ? 'white' : '#3a3a3a'
                      }}
                      onClick={() => handleKeyboardKeyPress('SHIFT')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('SHIFT');
                      }}
                    >
                      ⇧ SHIFT
                    </button>
                    {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(letter => (
                      <button
                        key={letter}
                        className="flex-1 keyboard-key text-gray-800 font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                        onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                        onClick={() => handleKeyboardKeyPress(letter)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleKeyboardKeyPress(letter);
                        }}
                      >
                        {isCapsLock || isShiftActive ? letter.toUpperCase() : letter}
                      </button>
                    ))}
                    <button
                      className="flex-1 keyboard-key text-white font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, #D8A0A0 0%, #C88080 100%)',
                        boxShadow: '0 4px 12px rgba(216, 160, 160, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }}
                      onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(216, 160, 160, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                      onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(216, 160, 160, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                      onClick={() => handleKeyboardKeyPress('BACKSPACE')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('BACKSPACE');
                      }}
                    >
                      ⌫ DEL
                    </button>
                  </div>

                  {/* Symbol and Control Row */}
                  <div className="grid grid-cols-12 gap-2.5">
                    <button
                      className="col-span-2 keyboard-key text-white font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                      style={{
                        background: isCapsLock ? 'linear-gradient(135deg, #B89FB8 0%, #A88FA8 100%)' : 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                        boxShadow: isCapsLock ? '0 4px 12px rgba(184, 159, 184, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                        border: isCapsLock ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.15)',
                        color: isCapsLock ? 'white' : '#3a3a3a'
                      }}
                      onClick={() => handleKeyboardKeyPress('CAPS')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('CAPS');
                      }}
                    >
                      {isCapsLock ? '🔒 CAPS' : '🔓 CAPS'}
                    </button>
                    {['[', ']', ';', '\'', ',', '.', '/', '\\', '`'].map(char => {
                      const shiftMap = { '[': '{', ']': '}', ';': ':', '\'': '"', ',': '<', '.': '>', '/': '?', '\\': '|', '`': '~' };
                      const displayChar = isShiftActive && shiftMap[char] ? shiftMap[char] : char;
                      return (
                        <button
                          key={char}
                          className="keyboard-key text-gray-800 font-semibold rounded-lg py-3 sm:py-4 transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                          style={{
                            background: 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(0, 0, 0, 0.15)'
                          }}
                          onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                          onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                          onClick={() => handleKeyboardKeyPress(char)}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            handleKeyboardKeyPress(char);
                          }}
                        >
                          {displayChar}
                        </button>
                      );
                    })}
                  </div>

                  {/* Space and Control Row */}
                  <div className="grid grid-cols-12 gap-2.5">
                    <button
                      className="col-span-9 keyboard-key text-white font-semibold py-3 sm:py-4 rounded-lg transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, #A8C8E8 0%, #98B8D8 100%)',
                        boxShadow: '0 4px 12px rgba(168, 200, 232, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }}
                      onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(168, 200, 232, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                      onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(168, 200, 232, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                      onClick={() => handleKeyboardKeyPress('SPACE')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('SPACE');
                      }}
                    >
                      🌟 SPACE 🌟
                    </button>
                    <button
                      className="col-span-3 keyboard-key text-white font-semibold py-3 sm:py-4 rounded-lg transition-all duration-150 text-xs sm:text-sm flex items-center justify-center active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, #B0D8A8 0%, #A0C898 100%)',
                        boxShadow: '0 4px 12px rgba(176, 216, 168, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }}
                      onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 16px rgba(176, 216, 168, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                      onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 12px rgba(176, 216, 168, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)'}
                      onClick={() => handleKeyboardKeyPress('ENTER')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('ENTER');
                      }}
                    >
                      ↵ ENTER
                    </button>
                  </div>

                  {/* Emoji Row */}
                  <div
                    className="grid grid-cols-12 gap-2.5 rounded-2xl p-4 sm:p-5"
                    style={{
                      background: 'linear-gradient(135deg, #5a4f48 0%, #4d4541 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    {['😀', '😂', '😍', '😎', '👍', '❤️', '🎉', '🌟', '✨', '💯', '🔥', '⭐'].map(emoji => (
                      <button
                        key={emoji}
                        className="keyboard-key rounded-lg py-3 sm:py-4 transition-all duration-150 text-lg sm:text-2xl flex items-center justify-center active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'linear-gradient(135deg, #E8A89A 0%, #D89080 100%)';
                          e.target.style.boxShadow = '0 6px 16px rgba(232, 168, 154, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'linear-gradient(135deg, #D8C8B8 0%, #C8B8A8 100%)';
                          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)';
                        }}
                        onClick={() => handleKeyboardKeyPress(emoji)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleKeyboardKeyPress(emoji);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LearnerSession;
