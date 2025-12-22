

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
import { playTickSound, playCelebrationSound } from '../../utils/stopwatchSounds';
import '../../styles/Pages.css';

const LearnerSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // WebRTC and Whiteboard
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);

  // Stream state (only remote - trainer's video)
  const [remoteStream, setRemoteStream] = useState(null);

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
  const [_isFrozen] = useState(false);
  const [keyboardMode] = useState(false); // Keep this defined for Whiteboard prop
  const [trainerJoined, setTrainerJoined] = useState(false); // Track if trainer has joined

  // -----------------------------------------------------------
  // 🔹 Purpose: Stopwatch hook for session timing
  // 🔸 How it works: learner has its own stopwatch display (read-only)
  // -----------------------------------------------------------
  const stopwatch = useStopwatch();
  const [syncedElapsedTime, setSyncedElapsedTime] = useState(0);
  const [syncedIsRunning, setSyncedIsRunning] = useState(false);
  const lastTickSecondRef = useRef(null);
  const hasPlayedCelebrationRef = useRef(false);

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
        handleLeaveSession(); // Auto-end session
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

  const handleLeaveSession = async () => {
    if (window.confirm('Are you sure you want to leave this session?')) {
      try {
        await sessionService.leaveSession(sessionId);
        cleanup();
        toast.info('Left session');
        navigate('/learner/dashboard');
      } catch {
        cleanup();
        navigate('/learner/dashboard');
      }
    }
  };

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
  };

  // --------------------------
  // Keyboard controls
  // --------------------------
  const handleKeyboardKeyPress = (key) => {
    if (key === 'SPACE') {
      setKeyboardText(prev => prev + ' ');
    } else if (key === 'BACKSPACE') {
      setKeyboardText(prev => prev.slice(0, -1));
    } else {
      setKeyboardText(prev => prev + key);
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
      <div className="session-page">
        {/* Navigation / Header */}
        <div className="session-header">
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
    <div className="session-page">
      {/* Navigation / Header - Similar to Trainer */}
      <div className="session-header">
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
            <button
              className="btn-session btn-session-end"
              onClick={() => navigate('/learner/dashboard')}
            >
              🏠 Dashboard
            </button>
            <button className="btn-session btn-session-active" onClick={() => console.log('[LearnerSession] Active')}>
              Live
            </button>
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

      {/* Main Container - Responsive 3-column layout */}
      <div className="flex flex-col gap-3 sm:gap-5 md:gap-6 my-3 sm:my-5 md:my-6 mx-2 sm:mx-4 md:mx-6 items-start responsive-layout" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <div className={`w-full md:w-[380px] lg:w-auto bg-white border-r border-gray-200 p-2 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar transition-transform duration-300 responsive-sidebar-left md:relative ${isSidebarOpen ? 'fixed top-20 left-0 bottom-0 w-[85%] max-w-[450px] z-[999] transform translate-x-0 order-1' : 'max-md:fixed max-md:-translate-x-full max-md:order-1 md:order-1'}`}>
          {/* Video Conferencing - Now on whiteboard */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3 sm:p-4 md:p-5 mb-4 md:mb-5">
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
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3 sm:p-4 md:p-5 mb-4 md:mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Emoji emoji="📊" size="lg" />
              <h3 className="font-semibold text-xs sm:text-sm md:text-base text-gray-700">Current Session Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-5">
              <div className="bg-white border border-blue-300 rounded p-2 sm:p-3 md:p-4">
                <div className="text-xs sm:text-xs md:text-sm text-gray-600 mb-1">Prompt <br /> Level</div>
                <div className="text-base sm:text-lg md:text-2xl font-bold text-blue-600">
                  {promptMeter ?? 0}
                </div>
              </div>
              <div className="bg-white border border-green-300 rounded p-2 sm:p-3 md:p-4">
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
        {/* Whiteboard Area */}
        <div className="w-full responsive-whiteboard-section mx-auto">
          <div className="session-whiteboard-container">
            {/* Moveable Video Feed Overlay */}
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
              className="bg-gradient-to-b from-sky-100 via-blue-100 to-cyan-100 border-4 border-sky-300 rounded-3xl p-4 sm:p-6 shadow-xl mx-auto w-full max-w-[1086px] mt-4 mb-4 cursor-default touch-none md:p-5"
              style={{
                touchAction: 'none',
                boxShadow: '0 10px 30px rgba(14, 165, 233, 0.15)'
              }}
              onMouseDown={handleKeyboardMouseDown}
              onTouchStart={handleKeyboardMouseDown}
            >
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-3xl sm:text-4xl">🎹</span>
                  <h4 className="m-0 text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 text-lg sm:text-xl font-bold cursor-move">
                    Magic Keyboard
                  </h4>
                </div>
              </div>
              <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch">
                <div className="flex-1 bg-white border-3 border-sky-200 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                  <p className="text-sm sm:text-base text-gray-700 font-medium whitespace-pre-wrap break-words min-h-[44px] flex items-center">
                    {keyboardText || <span className="text-gray-400 italic">✨ Start typing...</span>}
                  </p>
                </div>
                <button
                  onClick={handleSendText}
                  className="bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl font-bold text-sm sm:text-base transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
                >
                  ✨ Send
                </button>
              </div>
              <div className="bg-white bg-opacity-80 rounded-2xl p-3 sm:p-5 shadow-md">
                <div className="grid gap-2 sm:gap-3">
                  <div className="grid grid-cols-10 md:grid-cols-10 gap-1 sm:gap-2">
                    {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold rounded-full py-2 sm:py-4 transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-xs sm:text-base flex items-center justify-center"
                        onClick={() => handleKeyboardKeyPress(letter)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleKeyboardKeyPress(letter);
                        }}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-9 md:grid-cols-9 gap-1 sm:gap-2 md:ml-3">
                    {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold rounded-full py-2 sm:py-4 transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-xs sm:text-base flex items-center justify-center"
                        onClick={() => handleKeyboardKeyPress(letter)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleKeyboardKeyPress(letter);
                        }}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 md:grid-cols-7 gap-1 sm:gap-2 md:ml-6">
                    {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold rounded-full py-2 sm:py-4 transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-xs sm:text-base flex items-center justify-center"
                        onClick={() => handleKeyboardKeyPress(letter)}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleKeyboardKeyPress(letter);
                        }}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-12 gap-1 sm:gap-2 mt-2">
                    <button
                      className="col-span-7 sm:col-span-8 bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold py-2 sm:py-4 rounded-full transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-xs sm:text-base flex items-center justify-center"
                      onClick={() => handleKeyboardKeyPress('SPACE')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('SPACE');
                      }}
                    >
                      <Emoji emoji="🌟" size="sm" /> SPACE <Emoji emoji="🌟" size="sm" />
                    </button>
                    <button
                      className="col-span-5 sm:col-span-4 bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold py-2 sm:py-4 rounded-full transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-xs sm:text-base flex items-center justify-center"
                      onClick={() => handleKeyboardKeyPress('BACKSPACE')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('BACKSPACE');
                      }}
                    >
                      ⌫ DEL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="px-4 pb-4 flex justify-center">
            <button
              onClick={handleLeaveSession}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-colors shadow-md"
            >
              Leave Session
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LearnerSession;
