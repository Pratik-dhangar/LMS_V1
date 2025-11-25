

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionService from '../../api/services/sessionService';
import SimpleWebRTC from '../../api/services/simpleWebRTC';
import WhiteboardService from '../../api/services/whiteboardService';
import Whiteboard from '../../components/common/Whiteboard';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import useMessages from '../../hooks/useMessages';
import useStopwatch from '../../hooks/useStopwatch';

const LearnerSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // WebRTC and Whiteboard
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);

  // Stream state (only remote - trainer's video)
  const [remoteStream, setRemoteStream] = useState(null);

  // Video ref (only remote - trainer's video)
  const remoteVideoRef = useRef(null);

  // UI and session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [timeLeft, setTimeLeft] = useState(null);
  const [canvasItems, setCanvasItems] = useState([]);
  const [timeExpired, setTimeExpired] = useState(false);

  // Prompt and message placeholders
  const [promptText, setPromptText] = useState('[Prompts from trainer will appear here]');
  const [promptVisible, setPromptVisible] = useState(true); // Toggle prompt line visibility
  const [textMessages, setTextMessages] = useState([]); // For keyboard text messages displayed on whiteboard
  const [sessionNotes, setSessionNotes] = useState(''); // Session notes from trainer
  const [feedbackMessage, setFeedbackMessage] = useState(''); // For feedback messages displayed on whiteboard
  const [floatingAnimations, setFloatingAnimations] = useState([]); // For floating bubbles, smileys, balloons, stars

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
    }
    return () => {
      if (webRTC) {
        webRTC.onMessage = null;
      }
    };
  }, [webRTC, addReceivedMessage]);

  // Meter states
  const [promptMeter, setPromptMeter] = useState(null);
  const [reinforcementMeter, setReinforcementMeter] = useState(null);

  // Callbacks for meter updates
  const [onPromptMeterUpdate, setOnPromptMeterUpdate] = useState(null);
  const [onReinforcementMeterUpdate, setOnReinforcementMeterUpdate] = useState(null);

  // Media controls state
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [hasLocalAudio, setHasLocalAudio] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);

  // Tool access permissions from trainer
  const [toolAccess, setToolAccess] = useState({
    select: false,
    drag: false,
    keyboard: false
  });
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(null); // Track learner's own selection

  // Canvas clear triggers (for syncing with trainer)
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [erasePenTrigger, setErasePenTrigger] = useState(0);
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

  // Buckets and whiteboard settings from trainer
  const [buckets, setBuckets] = useState([]);
  const [bucketColor, setBucketColor] = useState('#9333ea');
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);

  // -----------------------------------------------------------
  // 🔹 Purpose: Stopwatch hook for session timing
  // 🔸 How it works: learner has its own stopwatch display (read-only)
  // -----------------------------------------------------------
  const stopwatch = useStopwatch();
  const [syncedElapsedTime, setSyncedElapsedTime] = useState(0);
  const [syncedIsRunning, setSyncedIsRunning] = useState(false);

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle animation pop by learner
  // 🔸 How it works: marks animation as popped and broadcasts to trainer/other learners
  // -----------------------------------------------------------
  const handleAnimationPop = (animationId) => {
    setFloatingAnimations(prev =>
      prev.map(a => a.id === animationId ? { ...a, popped: true } : a)
    );

    // Broadcast pop event to all participants
    if (whiteboardService) {
      whiteboardService.send('animation_popped', {
        animationId: animationId,
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
    whiteboardService.onTriggerKeyboard = (data) => {
      console.log('[LearnerSession] Keyboard triggered by trainer');
      setShowKeyboard(true);
      // Do not auto-hide — the keyboard will remain visible until trainer revokes 'keyboard' access
    };

    // Set up callback for prompt updates from trainer voice input
    whiteboardService.onPromptUpdate = (data) => {
      console.log('[LearnerSession] Prompt update received from trainer:', data);
      console.log('[LearnerSession] Setting promptText to:', data.text);
      setPromptText(data.text);
      // toast.success('📝 New prompt from trainer!');
    };

    // Set up callback for session notes from trainer
    whiteboardService.onSessionNotes = (data) => {
      console.log('[LearnerSession] Session notes received from trainer:', data);
      setSessionNotes(typeof data === 'string' ? data : (data?.text || ''));
      // toast.info('📝 Session notes updated!');
    };

    // Set up callback for feedback messages from trainer
    whiteboardService.onFeedbackMessage = (data) => {
      console.log('[LearnerSession] Feedback message received from trainer:', data);
      setFeedbackMessage(data.message);

      // Auto-hide feedback message after 3 seconds
      setTimeout(() => {
        setFeedbackMessage('');
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
      handleAnimationPop(data.animationId);
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

    // Set up callback for erase pen event from trainer
    whiteboardService.onErasePen = (data) => {
      console.log('[LearnerSession] Received erase pen event from trainer');
      setErasePenTrigger(prev => prev + 1);
      setRedrawCanvasTrigger(prev => prev + 1);
    };

    // Set up callback for clear canvas event (also clears video, items, and buckets)
    whiteboardService.onClearCanvas = (data) => {
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
        whiteboardService.onSessionNotes = null;
        whiteboardService.onItemRemove = null;
        whiteboardService.onErasePen = null;
        whiteboardService.onClearCanvas = null;
        whiteboardService.onBucketAdded = null;
        whiteboardService.onBucketUpdate = null;
      }
    };
  }, [whiteboardService]);

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
  }, [sessionInfo, sessionId]);

  // --------------------------
  // Session initialization
  // --------------------------
  const initializeSession = async (userId) => {
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
    } catch (error) {
      // toast.error('Failed to initialize whiteboard');
    }

    // Initialize WebRTC
    const rtcService = new SimpleWebRTC(WS_BASE_URL, sessionId, 'learner');

    try {
      console.log('[LearnerSession] Initializing WebRTC service');

      // Set callback for remote stream (trainer's video)
      rtcService.onRemoteStream = (stream) => {
        console.log('[LearnerSession] Received remote stream from trainer');
        console.log('[LearnerSession] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

        // Add event listeners for track changes
        stream.getTracks().forEach(track => {
          console.log(`[LearnerSession] Adding listeners to ${track.kind} track`);
          track.addEventListener('ended', () => {
            console.log(`[LearnerSession] Remote ${track.kind} track ended`);
          });
          track.addEventListener('mute', () => {
            console.log(`[LearnerSession] Remote ${track.kind} track muted`);
          });
          track.addEventListener('unmute', () => {
            console.log(`[LearnerSession] Remote ${track.kind} track unmuted`);
          });
        });

        setRemoteStream(stream);
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
          const videoElement = remoteVideoRef.current;
          videoElement.srcObject = stream;

          // Wait for loadedmetadata before playing
          const playVideo = () => {
            videoElement.play().catch((error) => {
              console.error('[LearnerSession] Error playing remote video:', error);
              if (error.name === 'NotAllowedError') {
                // toast.warn('Autoplay blocked. Click video to enable.');
              } else if (error.name !== 'AbortError') {
                console.warn('Video play error:', error.name);
              }
            });
          };

          if (videoElement.readyState >= 2) {
            // Video is already loaded
            playVideo();
          } else {
            // Wait for metadata to load
            videoElement.addEventListener('loadedmetadata', playVideo, { once: true });
          }
        }
      };

      // Set callback for connection state changes
      rtcService.onConnectionChange = (state) => {
        console.log('[LearnerSession] Connection state:', state);
        setConnectionStatus(state);
        if (state === 'failed') {
          toast.error('Connection failed. Please refresh and try again.');
        } else if (state === 'connected') {
          // toast.success('Connected to trainer!');
        }
      };

      // Set callback for prompt meter updates
      rtcService.onPromptMeterUpdate = (value) => {
        console.log('[LearnerSession] Prompt meter update:', value);
        setPromptMeter(value);
        // toast.info(`Prompt Level: ${value}`);
      };

      // Set callback for reinforcement meter updates
      rtcService.onReinforcementMeterUpdate = (value) => {
        console.log('[LearnerSession] Reinforcement meter update:', value);
        setReinforcementMeter(value);
        // toast.info(`Reinforcement Level: ${value}`);
      };

      // Initialize WebRTC (gets local media)
      await rtcService.initialize();
      setWebRTC(rtcService);

      // Update media control states and availability
      const hasAudio = rtcService.localStream && rtcService.localStream.getAudioTracks().length > 0;
      const hasVideo = rtcService.localStream && rtcService.localStream.getVideoTracks().length > 0;

      setHasLocalAudio(hasAudio);
      setHasLocalVideo(hasVideo);
      setMicEnabled(hasAudio ? rtcService.isMicEnabled() : false);
      setCameraEnabled(hasVideo ? rtcService.isCameraEnabled() : false);

      console.log('[LearnerSession] WebRTC service initialized', {
        hasAudio,
        hasVideo,
        micEnabled: hasAudio ? rtcService.isMicEnabled() : 'N/A',
        cameraEnabled: hasVideo ? rtcService.isCameraEnabled() : 'N/A'
      });
    } catch (error) {
      console.error('[LearnerSession] WebRTC init error:', error);
      toast.error('Failed to initialize video connection: ' + error.message);
    }
  };

  const handleSessionEnded = (payload) => {
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
      } catch (error) {
        cleanup();
        navigate('/learner/dashboard');
      }
    }
  };

  const cleanup = () => {
    try {
      webRTC?.close();
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
      <div className="flex justify-center items-center min-h-screen">
        <div className="session-loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navigation / Header - Similar to Trainer */}
      <div className="bg-slate-800 px-5 py-4 sticky top-0 z-[1000] shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-white text-lg font-bold mb-2">HurshBin Learner</div>
            <div className="text-sm text-gray-400">
              {sessionInfo?.title ?? 'Training Session'} — Trainer : {sessionInfo?.trainer_name ?? 'Trainer'}
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <div className="text-white text-sm">
              Status: <strong>{connectionStatus}</strong>
            </div>
            <div className="text-white text-sm">
              Time Left: <strong>{timeLeft ?? '--:--'}</strong>
            </div>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded cursor-pointer text-sm hover:bg-green-700 transition-colors"
              onClick={() => navigate('/learner/dashboard')}
            >
              🏠 Dashboard
            </button>
            <button className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer text-sm hover:bg-blue-600 transition-colors" onClick={() => console.log('[LearnerSession] Active')}>
              Live
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-1" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          {/* Video Conferencing */}
          <div className="bg-slate-800 p-4 rounded mb-4 text-white">
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold">📹 Video Conferencing</div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Connected with: {sessionInfo?.trainer_name ?? '—'} | Session Time: {sessionInfo?.started_at ? new Date(sessionInfo.started_at).toLocaleTimeString() : '--:--'}
            </div>
            <div className="flex justify-center items-start gap-5 w-full p-3">
              {/* Trainer video - remote */}
              <div className="flex-1 max-w-full flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-700 font-medium">Trainer's Video</span>
                  <span className={`text-xs ${remoteStream ? 'text-green-500' : 'text-red-500'}`}>
                    {remoteStream ? '● Connected' : '○ Waiting...'}
                  </span>
                </div>
                <div className="relative h-[200px] overflow-hidden rounded-lg bg-black">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    className="session-video"
                    style={{ display: remoteStream ? 'block' : 'none', width: '100%', height: '100%' }}
                  />
                  {!remoteStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-white text-base font-medium rounded-lg">
                      Waiting for trainer to join...
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
          {/* Prompt Line Box */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPromptVisible(!promptVisible)}
                  className="text-yellow-600 hover:text-yellow-800 transition-colors text-lg cursor-pointer hover:bg-yellow-200 rounded p-1"
                  title={promptVisible ? 'Hide prompts' : 'Show prompts'}
                >
                  👁
                </button>
                <h3 className="font-semibold text-gray-700">Prompt Line (For Prompter)</h3>
              </div>
            </div>
            {promptVisible && (
              <div className="bg-white border border-yellow-300 rounded p-3 min-h-[60px] mb-2">
                <p className="text-gray-700 text-sm">{promptText}</p>
              </div>
            )}
            <p className="text-xs text-gray-500 italic">Click eye icon to show/hide prompts</p>
          </div>

          {/* Meter Values Display */}
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600">📊</span>
              <h3 className="font-semibold text-gray-700">Current Session Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-blue-300 rounded p-3">
                <div className="text-xs text-gray-600 mb-1">Prompt Level</div>
                <div className="text-lg font-bold text-blue-600">
                  {promptMeter ?? 0}
                </div>
              </div>
              <div className="bg-white border border-green-300 rounded p-3">
                <div className="text-xs text-gray-600 mb-1">Reinforcement Level</div>
                <div className="text-lg font-bold text-green-600">
                  {reinforcementMeter ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* In-Session Notes */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-700 mb-2">📋 Session Notes</h3>
            <div className="bg-white border border-gray-300 rounded p-3 min-h-[80px] max-h-[150px] overflow-y-auto">
              {sessionNotes ? (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{sessionNotes}</p>
              ) : (
                <p className="text-xs text-gray-500 italic">[Trainer notes will appear here...]</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-2">Messages</h3>
            <div className="bg-white border border-gray-300 rounded p-2 max-h-[150px] overflow-y-auto mb-2">
              {messages.length > 0 ? (
                messages.map((msg, idx) => (
                  <div key={idx} className="mb-2 p-2 bg-gray-50 rounded text-xs">
                    <strong className="text-gray-800">{msg.sender === 'You' ? 'Trainer' : msg.sender}:</strong>
                    <span className="text-gray-700"> {msg.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm font-semibold text-gray-600">Trainer:</p>
                  <p className="text-xs text-gray-500">Great job on the last activity!</p>
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
                className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative">

          {/* Interactive Learning Area - Whiteboard (Constrained for Learner) */}
          <div className="bg-gray-50 border-4 border-gray-300 rounded-lg m-4 relative mx-auto w-full max-w-[1086px] h-[340px] sm:h-[420px] md:h-[480px] lg:h-[501px]">
            <div className="w-full h-full">
              <Whiteboard
                whiteboardService={whiteboardService}
                isTrainer={false}
                canvasItems={canvasItems}
                setCanvasItems={setCanvasItems}
                // Learner side should not force freeze — trainer controls freeze via tools
                isFrozen={false}
                isPaused={false}
                toolAccess={toolAccess}
                textMessages={textMessages}
                setTextMessages={setTextMessages}
                feedbackMessage={feedbackMessage}
                floatingAnimations={floatingAnimations}
                onAnimationPop={handleAnimationPop}
                // Canvas clear triggers
                clearCanvasTrigger={clearCanvasTrigger}
                erasePenTrigger={erasePenTrigger}
                redrawCanvasTrigger={redrawCanvasTrigger}
                // Buckets and whiteboard settings
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

          {/* Virtual Keyboard - Positioned below whiteboard */}
          {showKeyboard && (
            <div
              className="bg-gradient-to-b from-sky-100 via-blue-100 to-cyan-100 border-4 border-sky-300 rounded-3xl p-6 shadow-xl mx-auto w-full max-w-[1086px] mt-4 mb-4 cursor-default touch-none"
              style={{
                touchAction: 'none',
                boxShadow: '0 10px 30px rgba(14, 165, 233, 0.15)'
              }}
              onMouseDown={handleKeyboardMouseDown}
              onTouchStart={handleKeyboardMouseDown}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🎹</span>
                  <h4 className="m-0 text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 text-xl font-bold cursor-move">
                    Magic Keyboard
                  </h4>
                </div>
              </div>

              {/* Text Display and Send Button */}
              <div className="mb-5 flex gap-3 items-stretch">
                <div className="flex-1 bg-white border-3 border-sky-200 rounded-2xl px-4 py-3 shadow-sm">
                  <p className="text-base text-gray-700 font-medium whitespace-pre-wrap break-words min-h-[44px] flex items-center">
                    {keyboardText || <span className="text-gray-400 italic">✨ Start typing...</span>}
                  </p>
                </div>
                <button
                  onClick={handleSendText}
                  className="bg-gradient-to-br from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 text-white px-6 py-3 rounded-2xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
                >
                  ✨ Send
                </button>
              </div>

              {/* Keyboard Keys Grid */}
              <div className="bg-white bg-opacity-80 rounded-2xl p-5 shadow-md">
                <div className="grid gap-3">
                  {/* Row 1 */}
                  <div className="grid grid-cols-10 gap-2">
                    {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold rounded-full py-4 transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-base flex items-center justify-center"
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

                  {/* Row 2 */}
                  <div className="grid grid-cols-10 gap-2 ml-3">
                    {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold rounded-full py-4 transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-base flex items-center justify-center"
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

                  {/* Row 3 */}
                  <div className="grid grid-cols-10 gap-2 ml-6">
                    {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(letter => (
                      <button
                        key={letter}
                        className="keyboard-key bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold rounded-full py-4 transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-base flex items-center justify-center"
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

                  {/* Bottom Row - Space and Backspace */}
                  <div className="grid grid-cols-12 gap-2 mt-2">
                    <button
                      className="col-span-8 bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold py-4 rounded-full transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-base flex items-center justify-center"
                      onClick={() => handleKeyboardKeyPress('SPACE')}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        handleKeyboardKeyPress('SPACE');
                      }}
                    >
                      🌟 SPACE 🌟
                    </button>
                    <button
                      className="col-span-4 bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-gray-600 font-bold py-4 rounded-full transition-all duration-150 shadow-md hover:shadow-lg active:scale-90 text-base flex items-center justify-center"
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

          {/* Leave Session Button - Small at Bottom */}
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
