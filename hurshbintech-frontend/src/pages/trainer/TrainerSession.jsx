// TrainerSession.js
// -------------------------------------------------------------
// 🔹 Purpose: Main React component for the Trainer's live session interface.
// 🔸 How it works: Manages session data, initializes WebRTC + Whiteboard services,
// handles messages, speech recognition, timers/stopwatches on the whiteboard,
// and exposes UI controls for trainer actions.
// -------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionService from '../../api/services/sessionService';
import learningContentService from '../../api/services/learningContentService';
import sessionReportService from '../../api/services/sessionReportService';
import SimpleWebRTC from '../../api/services/simpleWebRTC';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Whiteboard from '../../components/common/Whiteboard';
import MessageList from '../../components/common/MessageList';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useMessages from '../../hooks/useMessages';
import useVoiceInput from '../../hooks/useVoiceInput';
import useStopwatch from '../../hooks/useStopwatch';
import { useMediaControl } from '../../context/MediaControlContext';
import VideoSection from './VideoSection';
import WhiteboardSection from './WhiteboardSection';
import LearningProgramSidebar from './LearningProgramSidebar';
import LearningContentSidebar from './LearningContentSidebar';
import { FaMicrophone, FaBars, FaTimes } from 'react-icons/fa';
import { exerciseTemplates } from '../../utils/fillInBlanksTemplates';
import FillBlanksCreator from '../../components/common/FillBlanksCreator';
import '../../styles/Pages.css';


// -------------------------------------------------------------
// 🔹 Purpose: TrainerSession component
// 🔸 How it works: Functional React component using hooks to manage local state,
// effects for lifecycle, refs for DOM/media/service references.
// -------------------------------------------------------------
const TrainerSession = () => {
  // -----------------------------------------------------------
  // 🔹 Purpose: Obtain sessionId from route and navigation helper
  // 🔸 How it works: useParams reads URL param; useNavigate used for redirects.
  // -----------------------------------------------------------
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // -----------------------------------------------------------
  // 🔹 Purpose: Base URL for websocket (fallback to localhost)
  // 🔸 How it works: reads environment var (VITE_WS_URL) or uses default.
  // -----------------------------------------------------------
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // -----------------------------------------------------------
  // 🔹 Purpose: Hold instances of WebRTC and Whiteboard services
  // 🔸 How it works: useState stores service instances for use across component.
  // -----------------------------------------------------------
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);
  const [toolsService, setToolsService] = useState(null);

  // -----------------------------------------------------------
  // 🔹 Purpose: Media streams (only remote learner stream)
  // 🔸 How it works: remoteStream holds peer stream from learner
  // -----------------------------------------------------------
  const [remoteStream, setRemoteStream] = useState(null);

  // -----------------------------------------------------------
  // 🔹 Purpose: Refs to <video> element for remote video
  // 🔸 How it works: useRef stores DOM node to assign srcObject and control playback.
  // -----------------------------------------------------------
  const remoteVideoRef = useRef(null);

  // -----------------------------------------------------------
  // 🔹 Purpose: Mic/video UI toggles and state
  // 🔸 How it works: booleans control UI icons and actual track enabled state.
  // -----------------------------------------------------------
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // -----------------------------------------------------------
  // 🔹 Purpose: UI and session meta states (info, loading, connection)
  // 🔸 How it works: manages sessionInfo fetched from API and UI feedback flags.
  // -----------------------------------------------------------
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [timeLeft, setTimeLeft] = useState(null);
  const [_timeExpired, setTimeExpired] = useState(false);

  // -----------------------------------------------------------  
  // 🔹 Purpose: Messages (chat) using custom hook
  // 🔸 How it works: useMessages hook manages message state and functionality
  // -----------------------------------------------------------  
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress: _handleKeyPress,
    addReceivedMessage
  } = useMessages(webRTC, 'trainer');

  // -----------------------------------------------------------  
  // 🔹 Purpose: Set up WebRTC message callback
  // 🔸 How it works: When a message is received via WebRTC, add it to messages
  // -----------------------------------------------------------  
  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        console.log('[TrainerSession] Message received:', message);
        addReceivedMessage({
          sender: message.sender === 'trainer' ? 'You' : message.sender,
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
  const [textMessages, setTextMessages] = useState([]); // For keyboard text messages displayed on whiteboard
  const [sessionNotes, setSessionNotes] = useState(sessionInfo?.notes || '');
  const [feedbackMessage, setFeedbackMessage] = useState(''); // For feedback messages displayed on whiteboard
  const [waitingMessage, setWaitingMessage] = useState(''); // For waiting message displayed on whiteboard
  const [floatingAnimations, setFloatingAnimations] = useState([]); // For floating bubbles, smileys, balloons, stars

  // Debug: Log when feedbackMessage changes
  useEffect(() => {
    console.log('[TrainerSession] feedbackMessage state changed to:', feedbackMessage);
  }, [feedbackMessage]);

  const [additionalContentSearch, setAdditionalContentSearch] = useState('');
  const [additionalContentResults, setAdditionalContentResults] = useState([]);
  const [learningProgramSearch, setLearningProgramSearch] = useState('');
  const [_learningProgramSearchResults] = useState([]);
  const [learningContentSearch, setLearningContentSearch] = useState(''); // Search for assigned learning content
  const [databaseSearchResults, setDatabaseSearchResults] = useState([]); // Results from database search
  const [isSearching, setIsSearching] = useState(false); // Loading state for search
  const [selectedPromptLevel, setSelectedPromptLevel] = useState(null);
  const [selectedReinforcementLevel, setSelectedReinforcementLevel] = useState(null);
  const [selectedProgramId, setSelectedProgramId] = useState(null); // Track which program is checked

  // -----------------------------------------------------------
  // 🔹 Purpose: Whiteboard state and interactive modes
  // 🔸 How it works: canvasItems holds objects placed on whiteboard; activeTool selects action modes.
  // -----------------------------------------------------------
  const [canvasItems, setCanvasItems] = useState([]);
  const [_activeTool] = useState(null);
  const [keyboardMode] = useState(false); // Keep this defined for Whiteboard prop
  const [keyboardText, setKeyboardText] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });

  // Hamburger menu state for responsive sidebars
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  // Keep simple active toggles for Timers and Emojis.
  // These no longer trigger business logic (timer/stopwatch/emoji overlay/shuffle/clear).
  const [activeIcons, setActiveIcons] = useState({});
  const [showInfoBar, setShowInfoBar] = useState(true);
  const [showHeader, setShowHeader] = useState(true); // Show/hide header on mobile/tablet
  const [drawerOpen, setDrawerOpen] = useState({
    video: true,
    program: false,
    content: false
  }); // Drawer states for mobile/tablet
  const headerTimeoutRef = useRef(null); // Ref to store timeout ID for header auto-hide
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0); // Trigger to clear entire canvas including pen strokes
  const [erasePenTrigger, setErasePenTrigger] = useState(0); // Trigger to clear only pen strokes
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0); // Trigger to force redraw canvas items

  // -----------------------------------------------------------
  // 🔹 Purpose: Whiteboard drawing tool state (pen, eraser, bucket, colors, line width)
  // 🔸 How it works: these state values are passed to Whiteboard component to control drawing
  // -----------------------------------------------------------
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [bucketColor, setBucketColor] = useState('#9333ea');
  const [buckets, setBuckets] = useState([]);
  const [toolActive, setToolActive] = useState(false); // Track if drawing tool is active
  const [eraserActive, setEraserActive] = useState(false); // Track if eraser tool is active
  const [eraseAllActive, setEraseAllActive] = useState(false); // Track if erase all tool is active

  // -----------------------------------------------------------
  // 🔹 Purpose: Tool access control for learner (trainer can grant/revoke permissions)
  // 🔸 How it works: trainer controls which tools learner can use via toggle switches
  // -----------------------------------------------------------
  const [learnerToolAccess, setLearnerToolAccess] = useState({
    select: false,    // Can select items on canvas
    drag: false,      // Can drag items on canvas
    keyboard: false,  // Can use virtual keyboard
    fillBlanks: false // Can interact with fill in the blanks exercises
  });

  // -----------------------------------------------------------
  // 🔹 Purpose: Fill in the Blanks Creator Modal State
  // 🔸 How it works: controls visibility of exercise creation modal
  // -----------------------------------------------------------
  const [showFillBlanksCreator, setShowFillBlanksCreator] = useState(false);

  // -----------------------------------------------------------
  // 🔹 Purpose: Stopwatch hook for session timing
  // 🔸 How it works: manages stopwatch state with start/pause/resume/stop/reset operations
  // -----------------------------------------------------------
  const stopwatch = useStopwatch();
  const lastSyncTimeRef = useRef(0);
  const [showStopwatch, setShowStopwatch] = useState(false);
  const mediaControl = useMediaControl();
  const mediaWasVisibleRef = useRef(false);

  // 🔹 Purpose: Auto-show stopwatch when learning content ends
  // 🔸 How it works: watches mediaControl.currentMedia.isVisible and triggers stopwatch when content closes
  useEffect(() => {
    if (mediaControl.currentMedia.isVisible) {
      mediaWasVisibleRef.current = true;
    } else if (mediaWasVisibleRef.current && !mediaControl.currentMedia.isVisible) {
      // Content just closed - auto-show stopwatch
      console.log('[TrainerSession] Content ended - auto-showing stopwatch');
      setShowStopwatch(true);
      // Optionally auto-start the stopwatch
      // stopwatch.start();
      mediaWasVisibleRef.current = false;
    }
  }, [mediaControl.currentMedia.isVisible]);

  // Send stopwatch updates to learner via whiteboard service (throttled to 100ms)
  useEffect(() => {
    if (!whiteboardService || stopwatch.elapsedTime < 0) return;

    // Check if WebSocket is ready before sending
    if (!whiteboardService.ws || whiteboardService.ws.readyState !== WebSocket.OPEN) {
      return; // Skip sending if WebSocket is not ready
    }

    const now = Date.now();
    // Only send if 100ms has passed since last send
    if (now - lastSyncTimeRef.current >= 100) {
      lastSyncTimeRef.current = now;
      whiteboardService.send('stopwatch_sync', {
        elapsedTime: stopwatch.elapsedTime,
        isRunning: stopwatch.isRunning
      });
    }
  }, [whiteboardService, stopwatch.elapsedTime, stopwatch.isRunning]);

  const [selectedItemId, setSelectedItemId] = useState(null); // Track which item is selected by learner

  // -----------------------------------------------------------
  // 🔹 Purpose: refs to manage timers and stopwatches on the whiteboard
  // 🔸 How it works: Map-like refs store interval IDs and metadata to pause/resume/clear.
  // -----------------------------------------------------------
  const timersRef = useRef(new Map());
  const stopwatchesRef = useRef(new Map());

  // -----------------------------------------------------------
  // 🔹 Purpose: Voice input state via reusable hook
  // 🔸 How it works: uses `useVoiceInput` to handle speech recognition lifecycle
  // -----------------------------------------------------------
  const { listening, transcript, toggleListening: handleVoiceToggle } = useVoiceInput({ lang: 'en-IN' });

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle voice input with automatic transcript sending to learner
  // 🔸 How it works: handles voice input toggle and sends transcript via whiteboard service, coordinates with video conferencing mic
  // -----------------------------------------------------------
  const toggleListening = async () => {
    try {
      // If turning on voice input and video conferencing mic is on, turn it off
      if (!listening && micEnabled && webRTC) {
        const newState = webRTC.toggleMic();
        setMicEnabled(newState);
        toast.info('Video conferencing mic turned off - voice input enabled');
      }

      // Toggle voice input using the new hook
      await handleVoiceToggle();

      // Send the transcript to learner when stopping listening
      if (!listening && transcript && transcript.trim() && !transcript.includes('---Stopped Listening---') && whiteboardService) {
        console.log('[TrainerSession] ✅ Sending prompt to learner:', transcript);
        console.log('[TrainerSession] WhiteboardService status:', whiteboardService ? 'Connected' : 'Not connected');
        whiteboardService.send('prompt_update', {
          text: transcript.trim(),
          timestamp: Date.now()
        });

        // Turn video conferencing mic back on after voice input is done
        if (webRTC && !micEnabled) {
          const newState = webRTC.toggleMic();
          setMicEnabled(newState);
          toast.info('Video conferencing mic turned back on');
        }
      }
    } catch (error) {
      console.error('[TrainerSession] Error in toggleListening:', error);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Component mount - initialize session and resources
  // 🔸 How it works: fetch user from localStorage, validate, then initialize session resources.
  // -----------------------------------------------------------
  useEffect(() => {
    console.log('[TrainerSession] Component mounted, sessionId:', sessionId);
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.error('[TrainerSession] No user data found in localStorage');
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    console.log('[TrainerSession] User data:', { id: user.id, role: user.role, name: user.name });
    initializeSession(user.id);

    // 🔹 Purpose: Cleanup when the component unmounts
    // 🔸 How it works: calls cleanup() to close connections and services.
    return () => {
      console.log('[TrainerSession] Component unmounting, cleaning up');
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // -----------------------------------------------------------
  // 🔹 Purpose: Countdown timer effect showing remaining session time
  // 🔸 How it works: computes end time from sessionInfo.started_at + duration and updates every second
  // -----------------------------------------------------------
  useEffect(() => {
    if (!sessionInfo || !sessionInfo.started_at) return;

    // normalize ISO time - ensure 'Z' to treat as UTC if missing
    const startTimeStr = sessionInfo.started_at.includes('Z') ? sessionInfo.started_at : sessionInfo.started_at + 'Z';
    const endTime = new Date(startTimeStr).getTime() + sessionInfo.duration * 60 * 1000;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = endTime - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft("00:00");
        setTimeExpired(true);
        toast.info("Session time has ended. You can now end the session.");
        return;
      }

      const totalSeconds = Math.floor(distance / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours > 0) {
        // Format as H:MM:SS for long sessions
        setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionInfo]);

  // -----------------------------------------------------------
  // 🔹 Purpose: Periodic check for session status change on server
  // 🔸 How it works: polls sessionService.getSessionDetails every 30s; if status = 'ended', cleanup
  // -----------------------------------------------------------
  useEffect(() => {
    if (!sessionInfo || sessionInfo.status !== 'active') return;

    const checkInterval = setInterval(async () => {
      try {
        const updatedSession = await sessionService.getSessionDetails(sessionId);
        if (updatedSession.status === 'ended') {
          toast.info('Session has ended');
          cleanup();
          navigate('/trainer/dashboard');
        }
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo, sessionId]);

  // Auto-hide info bar after 5 seconds
  useEffect(() => {
    if (showInfoBar) {
      const timer = setTimeout(() => {
        setShowInfoBar(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showInfoBar]);

  // Auto-hide header after 5 seconds on mobile/tablet only
  useEffect(() => {
    // Check if viewport is mobile/tablet (less than 1024px)
    const isMobileOrTablet = () => window.innerWidth < 1024;

    if (showHeader && isMobileOrTablet()) {
      // Clear any existing timeout
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }

      // Set new timeout to hide header after 5 seconds
      headerTimeoutRef.current = setTimeout(() => {
        setShowHeader(false);
      }, 5000);

      return () => {
        if (headerTimeoutRef.current) {
          clearTimeout(headerTimeoutRef.current);
        }
      };
    }
  }, [showHeader]);

  // Show header again on click for mobile/tablet
  const handleHeaderClick = () => {
    if (window.innerWidth < 1024) {
      setShowHeader(true);
    }
  };

  // Listen for item selection messages from learner
  useEffect(() => {
    if (!whiteboardService) return;

    // Set up callback for item selection by learner
    whiteboardService.onItemSelected = (data) => {
      console.log('[TrainerSession] Learner selected item:', data);
      if (data.selectedBy === 'learner') {
        setSelectedItemId(data.itemId);
        // Visual highlight will show on canvas - no need for toast
      }
    };

    // Set up callback for animation pop events from learner
    whiteboardService.onAnimationPopped = (data) => {
      console.log('[TrainerSession] Animation popped by learner:', data);
      handleAnimationPop(data.animationId, data.poppedLeft, data.poppedTop);
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onItemSelected = null;
        whiteboardService.onAnimationPopped = null;
      }
    };
  }, [whiteboardService]);

  // -----------------------------------------------------------
  // 🔹 Purpose: Initialize session data and authorize trainer
  // 🔸 How it works: fetches session details, validates trainer_id, then initializes WebRTC & whiteboard
  // -----------------------------------------------------------
  const initializeSession = async (userId) => {
    try {
      console.log('[TrainerSession] Fetching session details for sessionId:', sessionId);
      // Fetch session details
      const session = await sessionService.getSessionDetails(sessionId);
      console.log('[TrainerSession] Session details received:', {
        id: session.id,
        session_id: session.session_id,
        title: session.title,
        trainer_id: session.trainer_id,
        learner_id: session.learner_id,
        status: session.status,
        learning_contents: session.learning_contents?.length || 0,
        learning_goals: session.learning_goals?.length || 0
      });
      console.log('[TrainerSession] Learning Contents:', session.learning_contents);
      console.log('[TrainerSession] Learning Goals:', session.learning_goals);

      // Log detailed content info for debugging thumbnails
      if (session.learning_contents && session.learning_contents.length > 0) {
        console.log('[TrainerSession] First content item full structure:', JSON.stringify(session.learning_contents[0], null, 2));
        session.learning_contents.forEach((content, index) => {
          console.log(`[TrainerSession] Content ${index + 1} - All URL fields:`, {
            id: content.id,
            title: content.title,
            content_type: content.content_type,
            // All possible URL fields
            thumbnail_url: content.thumbnail_url,
            thumbnail: content.thumbnail,
            image_url: content.image_url,
            url: content.url,
            content_url: content.content_url,
            file_path: content.file_path,
            file_url: content.file_url,
            // Show all keys for debugging
            allKeys: Object.keys(content)
          });
        });
      }

      setSessionInfo(session);

      // 🔹 Purpose: Ensure logged-in user is the trainer for this session
      // 🔸 How it works: compares session.trainer_id to the provided userId and redirects if mismatch
      if (session.trainer_id !== userId) {
        console.error('[TrainerSession] Unauthorized: trainer_id mismatch', {
          session_trainer_id: session.trainer_id,
          user_id: userId
        });
        toast.error('Unauthorized access');
        navigate('/dashboard');
        return;
      }

      console.log('[TrainerSession] Authorization successful, initializing WebRTC');
      await initializeWebRTC();
      setLoading(false);
      console.log('[TrainerSession] Session initialization complete');
    } catch (error) {
      console.error('[TrainerSession] Error initializing session:', error);
      console.error('[TrainerSession] Error details:', error.response?.data);
      toast.error('Failed to initialize session');
      navigate('/dashboard');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Initialize WebRTCService and WhiteboardService
  // 🔸 How it works: creates service instances, sets event handlers, obtains local media, and connects
  // -----------------------------------------------------------
  const initializeWebRTC = async () => {
    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, sessionId, 'trainer');
    try {
      console.log('[TrainerSession] Initializing whiteboard service');
      wbService.initialize();
      setWhiteboardService(wbService);
      console.log('[TrainerSession] Whiteboard service initialized');

      // Initialize WhiteboardTools service for managing all tools
      const tbService = new WhiteboardToolsService(wbService);
      setToolsService(tbService);
      console.log('[TrainerSession] Tools service initialized');
    } catch (error) {
      console.error('[TrainerSession] Error initializing whiteboard:', error);
      toast.error('Failed to initialize whiteboard');
    }

    // Initialize WebRTC
    const rtcService = new SimpleWebRTC(WS_BASE_URL, sessionId, 'trainer');

    try {
      console.log('[TrainerSession] Initializing WebRTC service');

      // Set callback for remote stream (learner's video)
      rtcService.onRemoteStream = (stream) => {
        console.log('[TrainerSession] Received remote stream from learner');
        console.log('[TrainerSession] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

        // Add event listeners for track changes
        stream.getTracks().forEach(track => {
          console.log(`[TrainerSession] Adding listeners to ${track.kind} track`);
          track.addEventListener('ended', () => {
            console.log(`[TrainerSession] Remote ${track.kind} track ended`);
          });
          track.addEventListener('mute', () => {
            console.log(`[TrainerSession] Remote ${track.kind} track muted`);
          });
          track.addEventListener('unmute', () => {
            console.log(`[TrainerSession] Remote ${track.kind} track unmuted`);
          });
        });

        setRemoteStream(stream);
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
          const videoElement = remoteVideoRef.current;
          videoElement.srcObject = stream;

          console.log('[TrainerSession] Video element ready state:', videoElement.readyState);

          // Wait for loadedmetadata before playing
          const playVideo = () => {
            console.log('[TrainerSession] Attempting to play video...');
            videoElement.play().catch((error) => {
              console.error('[TrainerSession] Error playing remote video:', error);
              if (error.name === 'NotAllowedError') {
                toast.warn('Autoplay blocked. Click video to enable.');
              } else if (error.name !== 'AbortError') {
                console.warn('Video play error:', error.name);
              }
            }).then(() => {
              console.log('[TrainerSession] Video playing successfully');
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
        console.log('[TrainerSession] Connection state:', state);
        setConnectionStatus(state);
        if (state === 'failed') {
          // Handle failed connection
          console.log('[TrainerSession] Connection failed');
        } else if (state === 'connected') {
          // Handle successful connection
          console.log('[TrainerSession] Connection successful');
        }
      };

      // Initialize WebRTC (gets local media)
      await rtcService.initialize();
      setWebRTC(rtcService);

      // Update media control states
      setMicEnabled(rtcService.isMicEnabled());
      setCameraEnabled(rtcService.isCameraEnabled());

      console.log('[TrainerSession] WebRTC service initialized');
    } catch (error) {
      console.error('[TrainerSession] WebRTC init error:', error);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle microphone on/off
  // 🔸 How it works: calls webRTC.toggleMic() and updates state, coordinates with voice input
  // -----------------------------------------------------------
  const handleToggleMic = () => {
    if (webRTC) {
      const newState = webRTC.toggleMic();
      setMicEnabled(newState);

      // If turning on video conferencing mic, turn off voice input
      if (newState && listening) {
        handleVoiceToggle(); // Stop voice input
        toast.info('Voice input stopped - video conferencing mic enabled');
      }
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle camera on/off
  // 🔸 How it works: calls webRTC.toggleCamera() and updates state
  // -----------------------------------------------------------
  const handleToggleCamera = () => {
    if (webRTC) {
      const newState = webRTC.toggleCamera();
      setCameraEnabled(newState);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: End session explicitly by trainer
  // 🔸 How it works: calls sessionService.endSession, cleans up local resources, and navigates away
  // -----------------------------------------------------------
  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end this session?')) {
      try {
        await sessionService.endSession(sessionId, '');
        toast.success('Session ended successfully');
        cleanup();
        navigate('/trainer/dashboard');
      } catch (error) {
        console.error('Error ending session:', error);
        toast.error('Failed to end session');
      }
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Trainer leaves session without ending for all
  // 🔸 How it works: cleanup locally and navigate to trainer dashboard
  // -----------------------------------------------------------
  const _handleLeaveSession = () => {
    if (window.confirm('Are you sure you want to leave this session?')) {
      cleanup();
      toast.info('Left session');
      navigate('/trainer/dashboard');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Auto-end session when time expires or other auto trigger
  // 🔸 How it works: calls API with reason, then cleans up and navigates away even on failure
  // -----------------------------------------------------------
  const _handleAutoEndSession = async () => {
    try {
      await sessionService.endSession(sessionId, 'Session ended automatically due to time expiry');
      toast.info('Session ended automatically due to time expiry');
      cleanup();
      navigate('/trainer/dashboard');
    } catch (error) {
      console.error('Error auto-ending session:', error);
      // Still cleanup and navigate even if API call fails
      cleanup();
      navigate('/trainer/dashboard');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Handler when session is ended by other peer (e.g., learner)
  // 🔸 How it works: shows toast, cleans up local resources, navigates trainer away
  // -----------------------------------------------------------
  const _handleSessionEnded = (payload) => {
    console.log('Session ended by:', payload.ended_by);
    toast.info('Session has been ended');
    cleanup();
    navigate('/trainer/dashboard');
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Cleanup function to close WebRTC and Whiteboard services
  // 🔸 How it works: calls service-specific teardown methods to release media and sockets
  // -----------------------------------------------------------
  const cleanup = () => {
    // Stop all media tracks (camera and microphone) - revoke media access
    if (webRTC?.localStream) {
      webRTC.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`[TrainerSession] Stopped ${track.kind} track`);
      });
    }
    if (webRTC) {
      webRTC.close();
      console.log('[TrainerSession] WebRTC closed and media access revoked');
    }
    if (whiteboardService) {
      whiteboardService.close();
    }
    if (toolsService) {
      toolsService.cleanup();
    }

    // clear timers and stopwatches intervals
    timersRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    timersRef.current.clear();
    stopwatchesRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    stopwatchesRef.current.clear();
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Drag start handler for content cards (drag to whiteboard)
  // 🔸 How it works: sets a JSON payload into dataTransfer so drop target can parse it
  // -----------------------------------------------------------
  const onDragStartContent = (e, content) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: content.id,
      title: content.title,
      type: content.content_type,
      url: content.file_url,
      thumbnail: content.thumbnail_url,
      mimeType: content.content_type === 'image' ? 'image/jpeg' : 'application/octet-stream',
      originalFilename: content.title
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Placeholder to save session state locally or to API
  // 🔸 How it works: currently logs and toasts success; replace with actual API if needed later
  // -----------------------------------------------------------
  const handleSaveSession = () => {
    // console.log('[TrainerSession] Save session clicked. Session data:', sessionInfo);
    toast.success('Session saved (local placeholder)');
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Save session report with program, prompt meter, and reinforcement meter
  // 🔸 How it works: captures selected program and meter values, sends to backend API
  // -----------------------------------------------------------
  const handleSaveReport = async () => {
    console.log('[handleSaveReport] Starting - sessionInfo:', sessionInfo);

    if (!sessionInfo || !sessionInfo.id) {
      console.error('[handleSaveReport] Session info not available:', sessionInfo);
      toast.error('Session information not loaded');
      return;
    }

    if (!selectedProgramId || !selectedPromptLevel || !selectedReinforcementLevel) {
      toast.error('Please select a program and both meter values');
      return;
    }

    try {
      const selectedProgram = filteredLearningGoals.find(goal => goal.id === selectedProgramId);

      if (!selectedProgram) {
        toast.error('Selected program not found');
        return;
      }

      if (!sessionInfo.learner_id) {
        toast.error('Learner information not available');
        return;
      }

      const reportData = {
        session_id: sessionInfo.id,
        learner_id: sessionInfo.learner_id,
        program_id: selectedProgramId,
        program_name: selectedProgram.goal,
        prompt_meter: selectedPromptLevel,
        reinforcement_meter: selectedReinforcementLevel
      };

      console.log('[TrainerSession] Report data being sent:', JSON.stringify(reportData, null, 2));
      console.log('[TrainerSession] session_id type:', typeof reportData.session_id, 'value:', reportData.session_id);
      console.log('[TrainerSession] learner_id type:', typeof reportData.learner_id, 'value:', reportData.learner_id);

      await sessionReportService.create(reportData);
      toast.success(`Report saved: ${selectedProgram.goal}`);

      // Reset selections after saving
      setSelectedProgramId(null);
      setSelectedPromptLevel(null);
      setSelectedReinforcementLevel(null);

      // Send reset values to learner
      if (webRTC) {
        webRTC.sendPromptMeter(0);
        webRTC.sendReinforcementMeter(0);
      }
    } catch (error) {
      console.error('[TrainerSession] Error saving report:', error);
      toast.error('Failed to save session report');
    }
  };


  // -----------------------------------------------------------
  // 🔹 Purpose: Update session notes (trainer's notes)
  // 🔸 How it works: updates local state for trainer's own notes
  // -----------------------------------------------------------
  const handleNotesChange = (e) => {
    const newNotes = e.target.value;
    setSessionNotes(newNotes);
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Control learning program search input state
  // 🔸 How it works: simple controlled input for filtering goals
  // -----------------------------------------------------------
  const handleLearningProgramSearch = (e) => {
    setLearningProgramSearch(e.target.value);
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle program checkbox selection - only one can be selected at a time
  // 🔸 How it works: When trainer checks a program, uncheck the previous one and reset meter values to 0
  // -----------------------------------------------------------
  const handleProgramCheck = (programId) => {
    // If the same program is clicked, uncheck it
    if (selectedProgramId === programId) {
      setSelectedProgramId(null);
      setSelectedPromptLevel(null);
      setSelectedReinforcementLevel(null);
      // Send reset values (0) to learner
      if (webRTC) {
        webRTC.sendPromptMeter(0);
        webRTC.sendReinforcementMeter(0);
      }
    } else {
      // If a different program is checked, select the new one and reset meters to 0
      setSelectedProgramId(programId);
      setSelectedPromptLevel(null);
      setSelectedReinforcementLevel(null);
      // Send reset values (0) to learner
      if (webRTC) {
        webRTC.sendPromptMeter(0);
        webRTC.sendReinforcementMeter(0);
      }
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Compute filtered learning goals based on search term
  // 🔸 How it works: performs case-insensitive includes check on sessionInfo.learning_goals
  // -----------------------------------------------------------
  const filteredLearningGoals = sessionInfo?.learning_goals?.filter(goal =>
    goal.goal.toLowerCase().includes(learningProgramSearch.toLowerCase())
  ) || [];

  // -----------------------------------------------------------
  // 🔹 Purpose: Control learning content search input state and search database
  // 🔸 How it works: searches database for content matching the search term with debouncing
  // -----------------------------------------------------------
  const handleLearningContentSearch = async (e) => {
    const searchValue = e.target.value;
    setLearningContentSearch(searchValue);

    // Clear database results if search is empty
    if (!searchValue.trim()) {
      setDatabaseSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Debounce the API call
    setIsSearching(true);
  };

  // Debounced search effect for database query
  useEffect(() => {
    const searchDatabase = async () => {
      if (!learningContentSearch.trim()) {
        setDatabaseSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        console.log('[TrainerSession] Searching database for:', learningContentSearch);

        // Fetch all learning content from database based on user role
        const userData = localStorage.getItem('user_data');
        const user = userData ? JSON.parse(userData) : null;

        let allContent = [];
        if (user?.role === 'admin') {
          allContent = await learningContentService.admin.getAll();
        } else if (user?.role === 'trainer') {
          allContent = await learningContentService.trainer.getAll();
        } else if (user?.role === 'head') {
          allContent = await learningContentService.head.getAll();
        }

        // Filter results based on search term
        const searchLower = learningContentSearch.toLowerCase();
        const filtered = allContent.filter(content => {
          return (
            content.title?.toLowerCase().includes(searchLower) ||
            content.content_type?.toLowerCase().includes(searchLower) ||
            content.category?.toLowerCase().includes(searchLower) ||
            content.description?.toLowerCase().includes(searchLower)
          );
        });

        console.log('[TrainerSession] Database search results:', filtered.length);
        setDatabaseSearchResults(filtered);
      } catch (error) {
        console.error('[TrainerSession] Error searching database:', error);
        toast.error('Failed to search learning content');
        setDatabaseSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce: wait 500ms after user stops typing
    const timeoutId = setTimeout(searchDatabase, 500);
    return () => clearTimeout(timeoutId);
  }, [learningContentSearch]);

  // -----------------------------------------------------------
  // 🔹 Purpose: Compute filtered learning content based on search term
  // 🔸 How it works: If searching, show database results; otherwise show filtered assigned content
  // -----------------------------------------------------------
  const filteredLearningContent = (() => {
    // If there's a search term, prioritize database results
    if (learningContentSearch.trim()) {
      return databaseSearchResults;
    }

    // Otherwise, show all assigned content from session
    return sessionInfo?.learning_contents || [];
  })();

  // -----------------------------------------------------------
  // 🔹 Purpose: Search additional content (mocked for now)
  // 🔸 How it works: triggers when search length > 2 and sets mock results; replace with API call if available
  // -----------------------------------------------------------
  const _handleAdditionalContentSearch = async (e) => {
    const query = e.target.value;
    setAdditionalContentSearch(query);
    if (query.length > 2) {
      // Mock search results - replace with actual API call
      setAdditionalContentResults([
        { id: 1, title: 'Sample Content 1', content_type: 'video' },
        { id: 2, title: 'Sample Content 2', content_type: 'image' },
      ]);
    } else {
      setAdditionalContentResults([]);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle learner tool access (Select, Drag, Keyboard)
  // 🔸 How it works: Updates learner permissions and sends via whiteboard service
  // 🔸 When drag is activated: Auto-sets tool to 'select' to enable drag interactions
  // -----------------------------------------------------------
  const toggleLearnerToolAccess = (toolName) => {
    const newAccess = {
      ...learnerToolAccess,
      [toolName]: !learnerToolAccess[toolName]
    };
    setLearnerToolAccess(newAccess);

    // Auto-enable select permission when drag is activated
    if (toolName === 'drag' && newAccess.drag) {
      newAccess.select = true;
      setLearnerToolAccess(newAccess);
    }

    // Send permission update to learner via whiteboard service
    if (whiteboardService) {
      whiteboardService.send('tool_access', {
        toolName,
        enabled: newAccess[toolName],
        allPermissions: newAccess
      });

      // If drag is being enabled, also send select permission update
      if (toolName === 'drag' && newAccess.drag) {
        whiteboardService.send('tool_access', {
          toolName: 'select',
          enabled: true,
          allPermissions: newAccess
        });
      }
    }
    console.log('[TrainerSession] Learner tool access updated:', newAccess);
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Trigger keyboard tool for learner
  // 🔸 How it works: Sends keyboard trigger command to learner session
  // -----------------------------------------------------------
  const triggerLearnerKeyboard = () => {
    if (whiteboardService) {
      whiteboardService.send('trigger_keyboard', {
        enabled: true,
        timestamp: Date.now()
      });
    } else {
      toast.error('Whiteboard service not available');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Send Fill in the Blanks exercise to specific learner
  // 🔸 How it works: Creates exercise with learner targeting and broadcasts via whiteboard service
  // -----------------------------------------------------------
  const handleSendExercise = (exercise) => {
    if (!whiteboardService || !sessionInfo) {
      toast.error('Cannot send exercise - service not ready');
      console.error('[TrainerSession] Cannot send exercise - whiteboardService:', !!whiteboardService, 'sessionInfo:', !!sessionInfo);
      return;
    }

    console.log('[TrainerSession] Preparing to send exercise:', {
      exerciseId: exercise.id,
      exerciseTitle: exercise.title,
      sessionInfoLearnerId: sessionInfo.learner_id,
      learnerName: sessionInfo.learner_name,
      fillBlanksAccess: learnerToolAccess.fillBlanks
    });

    // Add learner targeting to exercise
    const targetedExercise = {
      ...exercise,
      targetLearnerId: sessionInfo.learner_id,
      allowLearnerInteraction: learnerToolAccess.fillBlanks // Use current permission state
    };

    // Add to canvas items
    setCanvasItems(prev => [...prev, targetedExercise]);

    // Broadcast to whiteboard
    whiteboardService.sendItemUpdate(targetedExercise);

    console.log('[TrainerSession] Exercise sent to learner via whiteboard service:', {
      exerciseId: targetedExercise.id,
      targetLearnerId: targetedExercise.targetLearnerId,
      title: targetedExercise.title,
      allowLearnerInteraction: targetedExercise.allowLearnerInteraction,
      fullExercise: targetedExercise
    });

    toast.success(`📝 Exercise sent to ${sessionInfo.learner_name || 'learner'}!`);
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Add a new bucket to the whiteboard
  // 🔸 How it works: creates a new bucket positioned next to the previous one, updates state and notifies via whiteboardService
  // -----------------------------------------------------------
  const addBucket = () => {
    // Calculate position for new bucket (place next to previous one)
    const lastBucket = buckets[buckets.length - 1];
    const newX = lastBucket ? lastBucket.x + lastBucket.width + 20 : 100;
    const newY = lastBucket ? lastBucket.y : 100;

    const newBucket = {
      id: Date.now(),
      x: newX,
      y: newY,
      width: 150,
      height: 150,
      label: 'Bucket',
      color: bucketColor,
      items: [] // Items inside bucket
    };
    setBuckets(prev => [...prev, newBucket]);

    // Send to other participants
    whiteboardService?.send('bucket_added', newBucket);
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Clear all pen strokes (drawings) from the whiteboard
  // 🔸 How it works: clears the canvas to remove pen strokes, keeps canvas items (images, videos, PDFs)
  // -----------------------------------------------------------
  const eraseAllPen = () => {
    setErasePenTrigger(prev => prev + 1); // Trigger canvas clear in Whiteboard component
    setRedrawCanvasTrigger(prev => prev + 1); // Trigger redraw of canvas items after clear

    // Send clear pen command to learner
    if (whiteboardService) {
      whiteboardService.send('erase_pen', {
        timestamp: Date.now()
      });
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Spawn floating animations (bubbles, smileys, balloons, stars)
  // 🔸 How it works: creates 10 floating items that rise from bottom and can be popped
  // -----------------------------------------------------------
  const spawnFloatingAnimation = (type, emoji) => {
    const count = 10; // 10 items
    const newAnimations = [];
    const baseId = Date.now();

    for (let i = 0; i < count; i++) {
      const animation = {
        id: `${baseId}-${type}-${i}-${Math.random()}`,
        type: type,
        emoji: emoji,
        x: Math.random() * 90 + 5, // 5-95% from left
        startDelay: Math.random() * 1000, // 0-1s staggered start
        duration: 8000 + Math.random() * 4000, // 8-12s to float up
        popped: false
      };
      newAnimations.push(animation);
    }

    // Add to local state
    setFloatingAnimations(prev => [...prev, ...newAnimations]);

    // Broadcast to learner
    if (whiteboardService) {
      whiteboardService.send('floating_animations', {
        animations: newAnimations,
        timestamp: Date.now()
      });
    }

    // Auto-remove after animation completes (12s max duration + 1s buffer)
    setTimeout(() => {
      setFloatingAnimations(prev =>
        prev.filter(a => !newAnimations.find(na => na.id === a.id))
      );
    }, 13000);
  };

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
      console.log('[TrainerSession] Could not play pop sound:', error);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle animation pop from learner
  // 🔸 How it works: updates animation state to show popped version
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
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle clicks on whiteboard tool buttons (timers, emoji, pause, etc.)
  // 🔸 How it works: depending on the tool string, creates items, starts intervals, emits via whiteboardService
  // -----------------------------------------------------------
  const handleToolClick = (tool) => {
    console.log('[TrainerSession] Tool clicked:', tool);
    const canvasEl = document.querySelector('.whiteboard canvas');

    const rect = canvasEl?.getBoundingClientRect();
    const centerX = rect ? rect.width / 2 : 400;
    const centerY = rect ? rect.height / 2 : 250;

    const _now = Date.now();
    let newItem = null;

    // helper to emit via whiteboardService if available
    const emit = (fnName, payload) => {
      try {
        if (whiteboardService && typeof whiteboardService[fnName] === 'function') {
          whiteboardService[fnName](payload);
        } else if (whiteboardService && typeof whiteboardService.send === 'function') {
          // fallback generic emitter
          whiteboardService.send(fnName, payload);
        }
      } catch (e) {
        console.warn('[whiteboardService] emit error', e);
      }
    };

    const _genId = () => Date.now() + Math.floor(Math.random() * 1000);

    console.log('[TrainerSession] Matching tool in switch:', tool);
    switch (tool) {
      // ---------------------- SELECT (Learner Tool Access) ----------------------
      case '✋ Select': {
        toggleLearnerToolAccess('select');
        return;
      }

      // ---------------------- DRAG (Learner Tool Access) ----------------------
      case '↔️ Drag': {
        toggleLearnerToolAccess('drag');
        return;
      }

      // ---------------------- KEYBOARD (Trigger for Learner) ----------------------
      case '⌨️ Keyboard': {
        triggerLearnerKeyboard();
        return;
      }

      // ---------------------- STOPWATCH ----------------------
      case '⏲️ Stopwatch': {
        if (toolsService) {
          const stopwatchId = toolsService.startStopwatch();
          const label = 'Stopwatch';
          setActiveIcons(prev => ({ ...prev, [label]: true }));

          // Add stopwatch item to canvas
          newItem = {
            id: stopwatchId,
            type: 'stopwatch',
            x: centerX - 50,
            y: centerY - 50,
            width: 100,
            height: 100,
            label: '⏲️ Stopwatch',
            elapsedSeconds: 0
          };
        }
        break;
      }

      // ---------------------- FEEDBACK & EMOJIS ----------------------
      case '👍 Good Job!': {
        console.log('[TrainerSession] MATCHED Good Job case!');
        const message = 'Good Job! 👍';
        console.log('[TrainerSession] Setting feedback message:', message);
        setFeedbackMessage(message);
        if (whiteboardService) {
          whiteboardService.send('feedback_message', {
            message: message,
            timestamp: Date.now()
          });
        }
        // toast removed: Good Job feedback (keeps UI quiet for learner)
        // Auto-hide after 3 seconds
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      case '🌟 Wow!': {
        console.log('[TrainerSession] MATCHED Wow case!');
        const message = 'Wow! 🌟';
        setFeedbackMessage(message);
        if (whiteboardService) {
          whiteboardService.send('feedback_message', {
            message: message,
            timestamp: Date.now()
          });
        }
        // toast removed: Wow feedback
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      case '💪 Doing Well': {
        console.log('[TrainerSession] MATCHED Doing Well case!');
        const message = 'Doing Well 💪';
        setFeedbackMessage(message);
        if (whiteboardService) {
          whiteboardService.send('feedback_message', {
            message: message,
            timestamp: Date.now()
          });
        }
        // toast removed: Doing Well feedback
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      case '🙏 Thank You': {
        const message = 'Thank You! 🙏';
        setFeedbackMessage(message);
        if (whiteboardService) {
          whiteboardService.send('feedback_message', {
            message: message,
            timestamp: Date.now()
          });
        }
        // toast removed: Thank You feedback
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      case '❤️ Loved it': {
        const message = 'Love It! ❤️';
        setFeedbackMessage(message);
        if (whiteboardService) {
          whiteboardService.send('feedback_message', {
            message: message,
            timestamp: Date.now()
          });
        }
        // toast removed: Love It feedback
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      case '😌 Relax': {
        console.log('[TrainerSession] MATCHED Relax case!');
        const message = 'Relax 😌';
        setFeedbackMessage(message);
        if (whiteboardService) {
          whiteboardService.send('feedback_message', {
            message: message,
            timestamp: Date.now()
          });
        }
        // toast removed: Relax feedback
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      case '🫧 Bubbles': {
        console.log('[TrainerSession] Spawning bubble animation');
        spawnFloatingAnimation('bubble', '🫧');
        return;
      }

      case '😊 Smileys': {
        console.log('[TrainerSession] Spawning smileys animation');
        spawnFloatingAnimation('smiley', '😊');
        return;
      }

      case '🎈 Balloons': {
        console.log('[TrainerSession] Spawning balloons animation');
        spawnFloatingAnimation('balloon', '🎈');
        return;
      }

      case '⭐ Stars': {
        console.log('[TrainerSession] Spawning stars animation');
        spawnFloatingAnimation('star', '⭐');
        return;
      }

      case '⏳ Wait': {
        console.log('[TrainerSession] Showing wait message');
        const message = 'Please Wait ⏳';
        setWaitingMessage(message);
        if (whiteboardService) {
          whiteboardService.send('waiting_message', {
            message: message,
            timestamp: Date.now()
          });
        }
        // Auto-hide after 3 seconds
        setTimeout(() => setWaitingMessage(''), 3000);
        return;
      }

      // ---------------------- FILL IN THE BLANKS ----------------------
      case '📝 Fill Blanks': {
        console.log('[TrainerSession] Opening Fill in the Blanks creator');
        // Open the creator modal instead of directly creating exercise
        setShowFillBlanksCreator(true);
        return; // Don't create item here, wait for modal
      }

      // ---------------------- DEFAULT ----------------------
      default:
        console.log('[TrainerSession] No case matched for tool:', tool);
        toast.info(`Tool ${tool} clicked`);
        return;
    }

    // -------------------------------------------------------
    // 🔹 Purpose: Add generated newItem to canvas and broadcast if necessary
    // 🔸 How it works: appends item to canvasItems and emits sendItemUpdate/sendItemRemove for TTL items
    // -------------------------------------------------------
    if (newItem) {
      setCanvasItems(prev => {
        const next = [...prev, newItem];
        // broadcast full item to learners (if applicable)
        if (['emoji', 'timer', 'stopwatch', 'overlay', 'reaction', 'animation', 'feedback_animation'].includes(newItem.type)) {
          emit('sendItemUpdate', newItem);
        }
        return next;
      });

      // auto-remove short-lived items if ttl provided
      if (newItem.ttl && newItem.ttl > 0 && ['emoji', 'reaction', 'animation', 'feedback_animation'].includes(newItem.type)) {
        setTimeout(() => {
          setCanvasItems(prev => prev.filter(i => i.id !== newItem.id));
          emit('sendItemRemove', { id: newItem.id });
        }, newItem.ttl);
      }
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Render loading state while initialization completes
  // 🔸 How it works: shows spinner centered if loading flag is true
  // -----------------------------------------------------------
  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  return (
    <div className="session-page">
      {/* Navigation / Header - Auto-hide after 5s on mobile/tablet */}
      <div className={`session-header ${!showHeader ? 'hidden' : ''}`} onClick={handleHeaderClick}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">HurshBin Trainer</div>
            <div className="session-header-subtitle">
              {sessionInfo?.title ?? 'Training Session'} — Learner : {sessionInfo?.learner_name ?? 'Learner'}
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
              onClick={() => navigate('/trainer/dashboard')}
            >
              🏠 Dashboard
            </button>
            <button className="btn-session btn-session-settings" onClick={() => console.log('[TrainerSession] Open settings')}>
              ⚙️ Settings
            </button>
            <button className="btn-session btn-session-active" onClick={() => console.log('[TrainerSession] Active')}>
              Live
            </button>
          </div>
        </div>
      </div>

      {/* Info bar - Auto-hide after 5 seconds */}
      {showInfoBar && (
        <div className="session-info-banner">
          <span className="session-info-text"><strong>ℹ️ Session Active:</strong> All interactions are being recorded. Audio prompts via mic will be converted to text for prompter (not audible to learner).</span>
          <button
            onClick={() => setShowInfoBar(false)}
            className="text-gray-600 hover:text-gray-800 font-bold text-lg ml-2 sm:ml-4"
            title="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Hamburger menus removed - using 80-20 layout on mobile/tablet */}

      {/* Main layout - Desktop: 3 columns, Tablet/Mobile: 80% center + 20% right stacked */}
      <div className="session-main-layout" style={{ minHeight: 'calc(100vh - 6.25rem)' }}>
        {/* Desktop Only: Left Sidebar - Learning Program */}
        <div className="session-left-sidebar">
          <VideoSection
            remoteStream={remoteStream}
            remoteVideoRef={remoteVideoRef}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            handleToggleMic={handleToggleMic}
            handleToggleCamera={handleToggleCamera}
            sessionInfo={sessionInfo}
            connectionStatus={connectionStatus}
          />
          <div className="bg-gray-50 border-2 border-gray-300 p-2 sm:p-4 md:p-5 rounded h-fit max-h-[90vh] overflow-y-auto session-sidebar mt-3 sm:mt-4 md:mt-5">
            <div className="bg-blue-500 text-white font-semibold p-1.5 sm:p-2 md:p-3 -mx-2 sm:-mx-4 md:-mx-5 -mt-2 sm:-mt-4 md:-mt-5 mb-2 sm:mb-4 md:mb-5 rounded-t text-xs sm:text-sm md:text-base">
              📋 Learning Program
            </div>

            <div className="bg-white border-2 border-blue-500 p-2 sm:p-3 md:p-4 rounded mb-3 sm:mb-5 md:mb-6 flex items-center">
              <input
                type="text"
                className="flex-1 bg-gray-100 px-2 py-1.5 sm:py-2 md:py-2.5 rounded text-xs md:text-sm border-none outline-none mr-2"
                placeholder="🔍 Search Child Name / IIP..."
                value={learningProgramSearch}
                onChange={handleLearningProgramSearch}
              />
            </div>

            <div className="bg-gray-50 p-1.5 sm:p-2 md:p-3 rounded mb-3 sm:mb-4 md:mb-5">
              <div className="text-[10px] sm:text-xs md:text-sm font-semibold mb-2 text-slate-800">
                Selected: {sessionInfo?.learner_name ?? '—'} {sessionInfo?.iip_id ? `- ${sessionInfo.iip_id}` : ''}
              </div>
            </div>

            <div className="text-xs sm:text-sm md:text-base font-semibold mb-2">Program Items</div>
            <div className="max-h-[180px] sm:max-h-[220px] md:max-h-[260px] overflow-y-auto mb-3 sm:mb-4 md:mb-5">
              {filteredLearningGoals.length > 0 ? (
                filteredLearningGoals.map((goal, index) => (
                  <div key={goal.id ?? index} className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 md:p-3 bg-white border border-gray-300 rounded my-1 text-[10px] sm:text-xs md:text-sm">
                    <input
                      type="checkbox"
                      className="w-3 h-3 sm:w-4 sm:h-4 cursor-pointer"
                      checked={selectedProgramId === goal.id}
                      onChange={() => handleProgramCheck(goal.id)}
                    />
                    <div className="flex-1">{index + 1}. {goal.goal}</div>
                    <div className="bg-gray-200 px-1.5 sm:px-2 md:px-3 py-1 md:py-2 rounded font-semibold min-w-[25px] sm:min-w-[30px] md:min-w-[35px] text-center cursor-pointer text-[10px] sm:text-xs md:text-sm" title="Click to record prompt level">—</div>
                  </div>
                ))
              ) : <div className="text-[10px] sm:text-xs md:text-sm text-gray-500 italic">No matching program items found.</div>
              }

            </div>



            <div className="text-xs sm:text-sm md:text-base font-semibold mt-3 sm:mt-4 md:mt-5 mb-2">📊 Prompt <br /> Meter</div>
            <div className="bg-white border-2 border-blue-500 rounded p-1.5 sm:p-2 md:p-3 mb-3 sm:mb-4 md:mb-5">
              <div className="flex flex-wrap gap-0.5 sm:gap-1 md:gap-2 justify-center">
                {['I', '10', '20', '30', '40', '50', '60', '70', '80', '90'].map((p) => (
                  <div
                    key={p}
                    className={`${selectedPromptLevel === p ? 'bg-blue-600' : 'bg-green-600'} text-white px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-2.5 rounded font-semibold text-[10px] sm:text-xs md:text-sm cursor-pointer min-w-[28px] sm:min-w-[32px] md:min-w-[38px] text-center hover:bg-green-700`}
                    onClick={() => {
                      setSelectedPromptLevel(p);
                      webRTC && webRTC.sendPromptMeter(p);
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
              <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-1 sm:mt-2 md:mt-3 text-center">Click to record prompt level for selected item</div>
              {selectedPromptLevel && (
                <div className="text-[10px] sm:text-xs md:text-sm font-semibold text-center mt-1 sm:mt-2 md:mt-3 text-blue-600">
                  Selected: {selectedPromptLevel}
                </div>
              )}
            </div>

            <div className="text-xs sm:text-sm md:text-base font-semibold mb-2">🎯 Reinforcement Meter</div>
            <div className="bg-white border-2 border-green-600 rounded p-1.5 sm:p-2 md:p-3 mb-3 sm:mb-4 md:mb-5">
              <div className="flex flex-wrap gap-0.5 sm:gap-1 md:gap-2 justify-center">
                {['Full', '90', '80', '70', '60', '50', '40', '30', '20', '10'].map((r) => (
                  <div
                    key={r}
                    className={`${selectedReinforcementLevel === r ? 'bg-blue-600' : 'bg-green-600'} text-white px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-2.5 rounded font-semibold text-[10px] sm:text-xs md:text-sm cursor-pointer min-w-[32px] sm:min-w-[38px] md:min-w-[45px] text-center hover:bg-green-700`}
                    onClick={() => {
                      setSelectedReinforcementLevel(r);
                      webRTC && webRTC.sendReinforcementMeter(r);
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>

              {selectedReinforcementLevel && (
                <div className="text-[10px] sm:text-xs font-semibold text-center mt-1 sm:mt-2 text-blue-600">
                  Selected: {selectedReinforcementLevel}
                </div>
              )}
            </div>

            {/* Save Report Button */}
            {selectedProgramId && selectedPromptLevel && selectedReinforcementLevel && (
              <button
                onClick={handleSaveReport}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-1.5 sm:py-2 px-2 sm:px-3 rounded text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center justify-center gap-1 sm:gap-2"
              >
                💾 <span className="hidden xs:inline">Save Session Report</span><span className="xs:hidden">Save Report</span>
              </button>
            )}
            {selectedProgramId && (!selectedPromptLevel || !selectedReinforcementLevel) && (
              <div className="text-[9px] sm:text-xs text-orange-600 mb-3 sm:mb-4 text-center bg-orange-50 p-1.5 sm:p-2 rounded border border-orange-200">
                ⚠️ Select both meters to save
              </div>
            )}

            {/* Speech Section */}
            <h3 className="text-sm sm:text-base font-semibold mb-2">🎙️ Voice Input</h3>
            <button
              onClick={toggleListening}
              className={`${listening ? 'bg-red-500' : 'bg-green-500'} text-white border-none rounded-full w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] text-base sm:text-lg cursor-pointer mb-2 flex justify-center items-center mx-auto hover:opacity-90`}
            >
              {listening ? "🔇" : <FaMicrophone />}
            </button>
            <p className="text-[10px] sm:text-xs text-center text-gray-600 mb-2">
              {listening ? 'Recording... Click to stop' : 'Click to start recording'}
            </p>
            <div className="bg-white border border-gray-200 p-2 min-h-[50px] sm:min-h-[60px] rounded whitespace-pre-wrap text-xs sm:text-sm max-h-[120px] sm:max-h-[150px] overflow-y-auto mb-2">
              {transcript || <span className="text-gray-400 italic">Your speech will appear here...</span>}
            </div>
            {transcript && !listening && (
              <button
                onClick={() => {
                  if (whiteboardService && transcript.trim()) {
                    console.log('[TrainerSession] ✅ Manually sending prompt to learner:', transcript);
                    whiteboardService.send('prompt_update', {
                      text: transcript.trim(),
                      timestamp: Date.now()
                    });
                  }
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1.5 sm:py-2 px-2 sm:px-3 rounded text-xs sm:text-sm font-semibold mb-2"
              >
                📤 Send to Learner
              </button>
            )}

          </div>
        </div>

        {/* Center Area - 80% on mobile/tablet, flexible on desktop */}
        <div className="session-center-area">

          {/* Whiteboard */}
          <div className="session-whiteboard-container">
            {/* Whiteboard component - keep logic intact */}
            <div className="w-full h-full">
              <Whiteboard
                whiteboardService={whiteboardService}
                isTrainer={true}
                canvasItems={canvasItems}
                setCanvasItems={setCanvasItems}
                keyboardMode={keyboardMode}
                keyboardText={keyboardText}
                setKeyboardText={setKeyboardText}
                keyboardPosition={keyboardPosition}
                setKeyboardPosition={setKeyboardPosition}
                learnerSelectedItemId={selectedItemId}
                textMessages={textMessages}
                setTextMessages={setTextMessages}
                feedbackMessage={feedbackMessage}
                waitingMessage={waitingMessage}
                floatingAnimations={floatingAnimations}
                onAnimationPop={handleAnimationPop}
                tool={tool}
                setTool={setTool}
                color={color}
                setColor={setColor}
                lineWidth={lineWidth}
                setLineWidth={setLineWidth}
                bucketColor={bucketColor}
                setBucketColor={setBucketColor}
                buckets={buckets}
                setBuckets={setBuckets}
                clearCanvasTrigger={clearCanvasTrigger}
                erasePenTrigger={erasePenTrigger}
                redrawCanvasTrigger={redrawCanvasTrigger}
                stopwatchFormattedTime={stopwatch.isRunning ? stopwatch.formattedTime : null}
                stopwatchIsRunning={stopwatch.isRunning}
                toolActive={toolActive}
              />
            </div>
          </div>

          {/* Whiteboard Drawing Tools - Beautiful Heading */}
          <div className="w-full" style={{ marginBottom: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded shadow-md flex items-center" style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
                  <span style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}>🎨</span>
                  <div className="font-semibold" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 1rem)' }}>Whiteboard Drawing Tools</div>
                </div>
              </div>


            </div>
          </div>
          <div className="w-full flex flex-wrap items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
            {/* Drawing tool buttons */}
            <div className="flex" style={{ gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}>
              <button
                onClick={() => {
                  if (tool === 'pen' && toolActive && !eraserActive) {
                    // Deactivate pen
                    setToolActive(false);
                  } else {
                    // Activate pen - deactivate other tools first
                    setTool('pen');
                    setToolActive(true);
                    setEraserActive(false);
                    setEraseAllActive(false);
                  }
                }}
                className={`${tool === 'pen' && toolActive && !eraserActive ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-white border-gray-300 hover:bg-gray-100'} border-2 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center`}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Pen Tool (Click to activate/deactivate)"
              >
                <span>✏️</span>
                <span className="hidden xs:inline">Pen</span>
                {tool === 'pen' && toolActive && !eraserActive}
              </button>
              <button
                onClick={() => {
                  if (eraserActive) {
                    // Deactivate eraser
                    setEraserActive(false);
                    setToolActive(false);
                  } else {
                    // Activate eraser - deactivate other tools first
                    setTool('eraser');
                    setToolActive(true);
                    setEraserActive(true);
                    setEraseAllActive(false);
                  }
                }}
                className={`${eraserActive ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-white border-gray-300 hover:bg-gray-100'} border-2 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center`}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Eraser Tool (Click to activate/deactivate)"
              >
                <span>🧽</span>
                <span className="hidden xs:inline">Eraser</span>
                {eraserActive}
              </button>
              <button
                onClick={() => {
                  if (eraseAllActive) {
                    // Deactivate erase all
                    setEraseAllActive(false);
                  } else {
                    // Activate erase all - deactivate other tools first
                    setEraseAllActive(true);
                    setEraserActive(false);
                    setToolActive(false);
                    eraseAllPen();
                  }
                }}
                className={`${eraseAllActive ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-white border-gray-300 hover:bg-gray-100'} border-2 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center`}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Erase All Pen Strokes"
              >
                <span>🗑️</span>
                <span className="hidden sm:inline">Erase All</span>
                {eraseAllActive}
              </button>
              <button
                onClick={() => {
                  if (tool === 'bucket' && toolActive) {
                    // Bucket is active, add a new bucket
                    addBucket();
                  } else {
                    // Activate bucket tool - deactivate other tools first
                    setTool('bucket');
                    setToolActive(true);
                    setEraserActive(false);
                    setEraseAllActive(false);
                    toast.info('Bucket tool activated - click again to add buckets');
                  }
                }}
                className={`${tool === 'bucket' && toolActive ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-white border-gray-300 hover:bg-gray-100'} border-2 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center`}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Bucket Tool (Click to activate, click again to add bucket)"
              >
                <span>🪣</span>
                <span className="hidden xs:inline">Bucket</span>
                {tool === 'bucket' && toolActive}
              </button>
            </div>

            {/* Color and Size Controls */}
            <div className="flex items-center flex-wrap" style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)' }}>
              <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
                <label className="font-semibold text-slate-700 hidden sm:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Pen Color:</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={tool === 'eraser'}
                  className="rounded cursor-pointer border border-gray-300"
                  style={{ width: 'clamp(1.25rem, 3vw, 1.75rem)', height: 'clamp(1.25rem, 3vw, 1.75rem)' }}
                  title="Pen Color"
                />
              </div>

              <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
                <label className="font-semibold text-slate-700 hidden sm:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Bucket Color:</label>
                <input
                  type="color"
                  value={bucketColor}
                  onChange={(e) => setBucketColor(e.target.value)}
                  className="rounded cursor-pointer border border-gray-300"
                  style={{ width: 'clamp(1.25rem, 3vw, 1.75rem)', height: 'clamp(1.25rem, 3vw, 1.75rem)' }}
                  title="Bucket Color"
                />
              </div>

              <div className="flex items-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
                  <label className="font-semibold text-slate-700 hidden md:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Brush Size:</label>

                  {/* Slider: make slightly larger than before */}
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(parseInt(e.target.value))}
                    className="brush-size-slider"
                    title="Brush Size"
                    aria-label="Brush size slider"
                    style={{
                      width: 'clamp(5rem, 12vw, 10rem)',
                      // set CSS variable used by stylesheet to drive the filled track
                      ['--pct']: `${Math.round(((lineWidth - 1) / (10 - 1)) * 100)}%`
                    }}
                  />
                </div>

                {/* Preview showing current brush/eraser size */}
                <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
                  <div
                    className="brush-preview"
                    title="Brush preview"
                    style={{
                      width: `${Math.max(6, lineWidth * 3)}px`,
                      height: `${Math.max(6, lineWidth * 3)}px`,
                      background: tool === 'eraser' ? 'transparent' : color,
                      border: tool === 'eraser' ? '2px solid red' : '1px solid rgba(0,0,0,0.6)',
                      borderRadius: tool === 'eraser' ? '4px' : '9999px'
                    }}
                  />

                  <div className="text-slate-600" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>{lineWidth}</div>
                </div>
              </div>
            </div>

            {/* Clear Canvas Button */}
            <button
              onClick={() => {
                setCanvasItems([]);
                setBuckets([]);
                setClearCanvasTrigger(prev => prev + 1); // Trigger full canvas clear including pen strokes
                if (whiteboardService) {
                  whiteboardService.send('clear_canvas', {
                    timestamp: Date.now()
                  });
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition-colors flex items-center"
              style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
              title="Clear All Canvas Items and Pen Strokes"
            >
              <span>🗑️</span>
              <span className="hidden sm:inline">Clear All</span>
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap bg-white rounded" style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)', padding: 'clamp(0.5rem, 2vw, 1rem)', marginTop: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
            <div className="flex items-center justify-between w-full" style={{ marginBottom: '0.5rem' }}>
              <div className="flex items-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 0.75rem)' }}>
                <div className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded shadow-sm flex items-center" style={{ padding: 'clamp(0.25rem, 1.5vw, 0.5rem) clamp(0.5rem, 2vw, 0.75rem)', gap: 'clamp(0.25rem, 1vw, 0.5rem)' }}>
                  <span style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>🛠️</span>
                  <div className="font-semibold" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.75rem)' }}>Whiteboard Tools & Learner Access</div>
                </div>              </div>


            </div>

            {/* Learner Tool Access Controls */}
            <div className="w-full flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 pb-2 sm:pb-3">
              {/* Select Tool Toggle */}
              <button
                onClick={() => toggleLearnerToolAccess('select')}
                className={`${learnerToolAccess.select
                  ? 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-lg text-white'
                  : 'bg-white hover:bg-gray-50 border-gray-400 text-slate-800'
                  } border-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all duration-200 flex items-center gap-1`}
                title={learnerToolAccess.select ? 'Click to disable Select' : 'Click to enable Select'}
              >
                <span>✋</span>
                <span>Select</span>
              </button>

              {/* Drag Tool Toggle */}
              <button
                onClick={() => toggleLearnerToolAccess('drag')}
                className={`${learnerToolAccess.drag
                  ? 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-lg text-white'
                  : 'bg-white hover:bg-gray-50 border-gray-400 text-slate-800'
                  } border-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all duration-200 flex items-center gap-1`}
                title={learnerToolAccess.drag ? 'Click to disable Drag' : 'Click to enable Drag'}
              >
                <span>↔️</span>
                <span>Drag</span>
              </button>

              {/* Keyboard Trigger */}
              <button
                onClick={() => {
                  // Toggle keyboard access for learner
                  toggleLearnerToolAccess('keyboard');
                  // If enabling, also send an immediate trigger so the keyboard appears right away
                  if (!learnerToolAccess.keyboard) {
                    triggerLearnerKeyboard();
                  }
                }}
                className={`${learnerToolAccess.keyboard ? 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600' : 'bg-white border-gray-400 text-blue-600 hover:bg-blue-50'} border-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all duration-200 flex items-center gap-1`}
                title={learnerToolAccess.keyboard ? 'Revoke keyboard access' : 'Grant keyboard access'}
              >
                <span>⌨️</span>
                <span>Keyboard</span>
              </button>

              {/* FILL IN THE BLANKS - CREATE EXERCISE */}
              <button
                onClick={() => {
                  // Toggle learner interaction permission
                  const willEnable = !learnerToolAccess.fillBlanks;
                  toggleLearnerToolAccess('fillBlanks');

                  // Update all existing fill-in-blanks exercises with the permission state
                  setCanvasItems(prev => prev.map(item =>
                    item.type === 'fill-in-blanks'
                      ? { ...item, allowLearnerInteraction: willEnable }
                      : item
                  ));

                  // Broadcast the permission change to all participants
                  if (whiteboardService) {
                    whiteboardService.send('fillBlanksPermission', {
                      allowed: willEnable,
                      timestamp: Date.now()
                    });
                  }

                  toast.success(willEnable ? '✅ Learners can now fill in the blanks!' : '🔒 Fill in the blanks locked');
                }}
                className={`${learnerToolAccess.fillBlanks
                  ? 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 border-green-600 text-white shadow-lg'
                  : 'bg-white border-gray-400 text-slate-800 hover:bg-gray-50'
                  } border-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all duration-200 flex items-center gap-1`}
                title={learnerToolAccess.fillBlanks ? 'Click to lock fill in the blanks' : 'Click to allow learners to fill in the blanks'}
              >
                <span>{learnerToolAccess.fillBlanks ? '✏️' : '📝'}</span>
                <span>Fill Blanks</span>
              </button>
            </div>


            {/* Trainer Whiteboard Tools */}
            <div className="w-full">
              <div className="w-full mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 px-2 sm:px-3 py-1.5 sm:py-2 rounded shadow-md flex items-center gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg">⏲️</span>
                      <div>
                        <div className="text-xs sm:text-sm font-semibold">Timers</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStopwatch(prev => !prev)}
                  className={`inline-flex items-center gap-1 sm:gap-2 my-1 sm:my-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold ${showStopwatch ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'}`}
                  aria-expanded={showStopwatch}
                  aria-controls="stopwatch-panel"
                  title="Toggle stopwatch panel"
                >
                  <span>⏲️</span>
                  <span className="hidden sm:inline">Stopwatch</span>
                </button>
              </div>



              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded shadow-sm flex items-center gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm">✨</span>
                  <div className="text-[10px] sm:text-xs font-semibold">Feedback & Emojis</div>
                </div>              </div>
              <div className="flex flex-wrap gap-0.5 sm:gap-1 w-full">
                {[
                  { label: 'Good Job!', icon: '👍' },
                  { label: 'Wow!', icon: '🌟' },
                  { label: 'Doing Well', icon: '💪' },
                  { label: 'Thank You', icon: '🙏' },
                  { label: 'Loved it', icon: '❤️' },
                  { label: 'Relax', icon: '😌' },
                  { label: 'Bubbles', icon: '🫧' },
                  { label: 'Smileys', icon: '😊' },
                  { label: 'Balloons', icon: '🎈' },
                  { label: 'Stars', icon: '⭐' },
                  { label: 'Wait', icon: '⏳' }
                ].map((t, i) => {
                  // Use pastel colors for Bubbles, Smileys, Balloons, Stars - no shadow/border
                  const isFloatingEmoji = ['Bubbles', 'Smileys', 'Balloons', 'Stars'].includes(t.label);
                  const baseClass = isFloatingEmoji
                    ? (activeIcons[t.label] ? 'bg-blue-200 text-gray-800' : 'bg-pink-100 hover:bg-pink-200 text-gray-800')
                    : (activeIcons[t.label] ? 'bg-blue-500 border-blue-600 shadow-lg text-white' : 'bg-white border-2 border-gray-300 hover:bg-gray-100');

                  return (
                    <button
                      key={i}
                      onClick={() => handleToolClick(`${t.icon} ${t.label}`)}
                      className={`${baseClass} px-1.5 sm:px-2 py-1.5 sm:py-2 rounded text-[9px] sm:text-[10px] text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center gap-0.5 sm:gap-1`}
                      title={t.label}
                    >
                      <span>{t.icon}</span>
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CREATE EXERCISES SECTION */}
            <div className="w-full">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded shadow-sm flex items-center gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm">📚</span>
                  <div className="text-[10px] sm:text-xs font-semibold">Create Exercises</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-2 w-full">
                {/* Create Fill in the Blanks Exercise */}
                <button
                  onClick={() => handleToolClick('📝 Fill Blanks')}
                  className="bg-gradient-to-r from-purple-400 to-indigo-400 hover:from-purple-500 hover:to-indigo-500 border-2 border-purple-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-all duration-200 flex items-center gap-1 shadow-lg"
                  title="Create a new Fill in the Blanks exercise"
                >
                  <span>📝</span>
                  <span>Create</span>
                </button>
              </div>
            </div>
            <div className="border-2 border-gray-300 p-2 sm:p-4 my-2 sm:my-4 rounded bg-gray-50 w-full">
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold text-slate-800 text-sm sm:text-base">📝 Session Notes</div>
                <button
                  onClick={() => {
                    setSessionNotes('');
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-semibold transition-colors"
                  title="Clear all notes"
                >
                  🗑️ <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
              <textarea
                className="w-full p-2 rounded mt-1 text-xs text-gray-800 min-h-[60px] sm:min-h-[80px] border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={sessionNotes}
                onChange={handleNotesChange}
                placeholder="Write session notes here..."
              />
            </div>

            {/* Message box */}
            <div className="border-2 border-gray-300 p-2 sm:p-4 mt-2 rounded bg-gray-50 w-full">
              <div className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">💬 Message Box</div>
              <div className="max-h-[120px] sm:max-h-[150px] overflow-y-auto mb-2">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message-bubble ${msg.sender === 'trainer' ? 'message-bubble-sent' : 'message-bubble-received'}`}>
                    <strong>{msg.sender}:</strong> {msg.text}
                    <div className="text-[9px] text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1 sm:gap-2 items-center">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type message..."
                  className="flex-1 p-1.5 sm:p-2 border border-gray-300 rounded text-xs"
                />
                <button
                  onClick={sendMessage}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white border-none rounded cursor-pointer hover:bg-blue-600 text-xs sm:text-sm"
                >
                  Send
                </button>
              </div>
            </div>

            <div className="text-right mt-3 sm:mt-4 w-full">
              <button className="bg-green-600 text-white px-4 sm:px-8 py-2 sm:py-3 rounded inline-flex items-center gap-1 sm:gap-2 text-sm sm:text-base cursor-pointer hover:bg-green-700" onClick={handleSaveSession}>
                💾 <span className="hidden xs:inline">Save Session</span>
                <span className="text-[9px] sm:text-[10px] font-normal opacity-90 hidden sm:inline">(Saves: Name, Date, Time, Video, Notes, Prompts)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - 20% on mobile/tablet with all sections visible */}
        <div className="session-right-column">
          {/* Video Conference - 25% height */}
          <div className=" video-section-container">
            <div className="section-header">
              <span>📹 Video Conferencing</span>
            </div>
            <VideoSection
              remoteStream={remoteStream}
              remoteVideoRef={remoteVideoRef}
              micEnabled={micEnabled}
              cameraEnabled={cameraEnabled}
              handleToggleMic={handleToggleMic}
              handleToggleCamera={handleToggleCamera}
              sessionInfo={sessionInfo}
              connectionStatus={connectionStatus}
            />
          </div>

          {/* Learning Program - 25% height */}
          <div className=" learning-program-container">
            <div className="section-header">
              <span>📋 Learning Program</span>
            </div>
            <div className="section-content">
              <div className="bg-white border-2 border-blue-500 rounded flex items-center" style={{ padding: 'clamp(0.25rem, 1vw, 0.375rem)', marginBottom: 'clamp(0.375rem, 1.5vw, 0.5rem)' }}>
                <input
                  type="text"
                  className="flex-1 bg-gray-100 rounded border-none outline-none"
                  style={{ padding: 'clamp(0.2rem, 0.8vw, 0.25rem)', fontSize: 'clamp(0.5rem, 1vw, 0.625rem)', marginRight: '0.25rem' }}
                  placeholder="🔍 Search..."
                  value={learningProgramSearch}
                  onChange={handleLearningProgramSearch}
                />
              </div>

              <div className="text-xs font-semibold mb-1" style={{ fontSize: 'clamp(0.425rem, 1vw, 0.525rem)' }}>Program Items</div>
              <div className="flex-1 overflow-y-auto min-h-0" style={{ marginBottom: 'clamp(0.375rem, 1.5vw, 0.5rem)' }}>
                {filteredLearningGoals.length > 0 ? (
                  filteredLearningGoals.map((goal, index) => (
                    <div key={goal.id ?? index} className="flex items-center gap-0.5 bg-white border border-gray-300 rounded my-0.5" style={{ padding: 'clamp(0.2rem, 0.8vw, 0.25rem)', fontSize: 'clamp(0.425rem, 1vw, 0.525rem)' }}>
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        style={{ width: 'clamp(0.625rem, 1.5vw, 0.75rem)', height: 'clamp(0.625rem, 1.5vw, 0.75rem)' }}
                        checked={selectedProgramId === goal.id}
                        onChange={() => handleProgramCheck(goal.id)}
                      />
                      <div className="flex-1 truncate">{index + 1}. {goal.goal}</div>
                    </div>
                  ))
                ) : <div className="text-gray-500 italic text-xs">No items</div>
                }
              </div>

              <div className="text-xs font-semibold mb-0.5" style={{ fontSize: 'clamp(0.425rem, 1vw, 0.525rem)' }}>📊 Prompt Level</div>
              <div className="flex flex-wrap justify-center gap-0.5" style={{ gap: 'clamp(0.1rem, 0.3vw, 0.25rem)', marginBottom: 'clamp(0.25rem, 1vw, 0.375rem)' }}>
                {['I', '10', '20', '30', '40', '50', '60', '70', '80', '90'].map((p) => (
                  <div
                    key={p}
                    className={`${selectedPromptLevel === p ? 'bg-blue-600' : 'bg-green-600'} text-white rounded font-semibold cursor-pointer text-center hover:bg-green-700`}
                    style={{ padding: 'clamp(0.1rem, 0.4vw, 0.12rem)', fontSize: 'clamp(0.325rem, 0.7vw, 0.4rem)', minWidth: 'clamp(1rem, 2.2vw, 1.5rem)', lineHeight: '1' }}
                    onClick={() => {
                      setSelectedPromptLevel(p);
                      webRTC && webRTC.sendPromptMeter(p);
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Learning Content - 25% height */}
          <div className=" learning-content-container">
            <div className="section-header">
              <span>📚 Learning Content</span>
            </div>
            <div className="section-content">
              <LearningContentSidebar
                learningContentSearch={learningContentSearch}
                handleLearningContentSearch={handleLearningContentSearch}
                filteredLearningContent={filteredLearningContent}
                isSearching={isSearching}
                onDragStartContent={onDragStartContent}
                onRemoveFromWhiteboard={(itemId) => {
                  setCanvasItems(prev => prev.filter(item => item.id !== itemId));
                  whiteboardService?.send('item_remove', { id: itemId });
                }}
              />
            </div>
          </div>

          {/* Stopwatch - Below Learning Content */}
          {showStopwatch && (
            <StopwatchDisplay
              formattedTime={stopwatch.formattedTime}
              isRunning={stopwatch.isRunning}
              onStart={stopwatch.start}
              onPause={stopwatch.pause}
              onResume={stopwatch.resume}
              onReset={stopwatch.reset}
              onSetTime={stopwatch.setTime}
              showControls={true}
              size="md"
              variant="standard"
            />
          )}
        </div>
      </div>

      {/* Session Info Bar */}
      <div className="bg-slate-700 text-white px-3 sm:px-5 py-2 sm:py-3 mt-3 sm:mt-5 mx-2 sm:mx-4 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div className="text-[10px] sm:text-xs">
          <strong>Session Info:</strong> {sessionInfo?.learner_name ?? '—'} | {sessionInfo?.started_at ? new Date(sessionInfo.started_at).toLocaleDateString() : '--'} | Started: {sessionInfo?.started_at ? new Date(sessionInfo.started_at).toLocaleTimeString() : '--'} | Duration: {sessionInfo?.duration ? `${sessionInfo.duration} min` : '--'}
          <div className="flex gap-1 sm:gap-2 w-full sm:w-auto">
            <button className="bg-red-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded text-[10px] sm:text-xs cursor-pointer hover:bg-red-600 flex-1 sm:flex-none" onClick={handleEndSession}>⏹️ <span className="hidden xs:inline">End Session</span></button>
            <button className="bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded text-[10px] sm:text-xs cursor-pointer hover:bg-blue-600 flex-1 sm:flex-none" onClick={() => console.log('[TrainerSession] Pause clicked')}>⏸️ <span className="hidden xs:inline">Pause</span></button>
          </div>
        </div>

      </div>

      {/* Fill in the Blanks Creator Modal */}
      <FillBlanksCreator
        isOpen={showFillBlanksCreator}
        onClose={() => setShowFillBlanksCreator(false)}
        onSend={handleSendExercise}
        learnerName={sessionInfo?.learner_name || 'Learner'}
      />
    </div>
  );
};

export default TrainerSession;
