// CoachSession.jsx
// Coach session page - Mirrors TrainerSession.jsx
// Simplified version without reinforcement meter, voice input, session notes, and session reports

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import learningContentService from '../../api/services/learningContentService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Whiteboard from '../../components/common/Whiteboard';
import MessageList from '../../components/common/MessageList';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useMessages from '../../hooks/useMessages';
import useStopwatch from '../../hooks/useStopwatch';
import { useMediaControl } from '../../context/MediaControlContext';
import MoveableVideoFeed from '../../components/videoConference/MoveableVideoFeed';
import { FaMicrophone, FaBars, FaTimes } from 'react-icons/fa';
import Emoji from '../../components/common/Emoji';
import LearningContentSidebar from '../trainer/LearningContentSidebar';
import Exercise from '../../components/session/Exercise';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
// Import session utilities
import {
  REACTION_SVG_ASSETS,
  WB_BUTTON_STYLES,
  BUCKET_COLORS,
  WhiteboardTools,
  getWSBaseURL,
  initializeWhiteboardService,
  initializeVideoConferenceService,
  initializeToolsService,
  toggleMicrophone as utilToggleMicrophone,
  toggleCamera as utilToggleCamera,
  toggleFreeze as utilToggleFreeze,
  clearAllCanvas,
  addBucket as utilAddBucket,
  eraseAllPen as utilEraseAllPen,
  spawnFloatingAnimation as utilSpawnFloatingAnimation,
  handleToolClick as utilHandleToolClick,
  sendFeedbackMessage,
  sendWaitingMessage,
  toggleToolAccess as utilToggleToolAccess,
  cleanupSessionResources,
  syncStopwatchToParticipant,
  endSession as utilEndSession,
  calculateTimeRemaining,
  triggerParticipantKeyboard
} from '../../utils/sessionUtils';

const CoachSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = getWSBaseURL(); // Use utility function

  // Service instances
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);
  const [toolsService, setToolsService] = useState(null);
  const isInitializingRef = useRef(false);
  const clientConnectedRef = useRef(false);

  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoPosition, setVideoPosition] = useState({ x: 20, y: 20 });
  const [videoSize, setVideoSize] = useState({ width: 320, height: 240 });

  // Mic/video controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [timeLeft, setTimeLeft] = useState(null);

  // Messages
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress,
    addReceivedMessage
  } = useMessages(webRTC, 'coach');

  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        addReceivedMessage({
          sender: message.sender === 'coach' ? 'You' : message.sender,
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

  const [textMessages, setTextMessages] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [waitingMessage, setWaitingMessage] = useState('');
  const [floatingAnimations, setFloatingAnimations] = useState([]);
  const activeFloatingAnimationTypesRef = useRef(new Set());

  // Learning content
  const [learningContentSearch, setLearningContentSearch] = useState('');
  const [databaseSearchResults, setDatabaseSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [defaultContent, setDefaultContent] = useState([]); // Latest 5 content from admin

  // Whiteboard state
  const [canvasItems, setCanvasItems] = useState([]);
  const [keyboardMode] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]);

  // UI state
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeIcons, setActiveIcons] = useState({});
  const [showInfoBar, setShowInfoBar] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const headerTimeoutRef = useRef(null);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [erasePenTrigger, setErasePenTrigger] = useState(0);
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

  // Drawing tools
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [buckets, setBuckets] = useState([]);
  const [bucketColor, setBucketColor] = useState('#8B6F47');
  const [showExercise, setShowExercise] = useState(false);
  const [toolActive, setToolActive] = useState(false);
  const [eraserActive, setEraserActive] = useState(false);
  const [eraseAllActive, setEraseAllActive] = useState(false);

  // Text tool state
  const [textBoxes, setTextBoxes] = useState([]);
  const [activeTextBoxId, setActiveTextBoxId] = useState(null);
  const [textSize, setTextSize] = useState(16);
  const [showTextSizeSlider, setShowTextSizeSlider] = useState(false);

  // Tool access control for client
  const [clientToolAccess, setClientToolAccess] = useState({
    select: false,
    drag: false,
    keyboard: false
  });

  // Stopwatch
  const stopwatch = useStopwatch();
  const lastSyncTimeRef = useRef(0);
  const [showStopwatch, setShowStopwatch] = useState(false);
  const mediaControl = useMediaControl();
  const mediaWasVisibleRef = useRef(false);

  // Auto-show stopwatch when learning content ends
  useEffect(() => {
    if (mediaWasVisibleRef.current && !mediaControl.currentMedia.isVisible) {
      setShowStopwatch(true);
    }
    mediaWasVisibleRef.current = mediaControl.currentMedia.isVisible;
  }, [mediaControl.currentMedia.isVisible]);

  // Send stopwatch updates to client via whiteboard service
  useEffect(() => {
    if (whiteboardService && stopwatch.isRunning) {
      const now = Date.now();
      if (now - lastSyncTimeRef.current > 100) {
        whiteboardService.send('stopwatch_sync', {
          elapsedTime: stopwatch.elapsedTime,
          isRunning: stopwatch.isRunning
        });
        lastSyncTimeRef.current = now;
      }
    }
  }, [whiteboardService, stopwatch.elapsedTime, stopwatch.isRunning]);

  // Unified whiteboard button styles - Use utility constants
  const wbBtnBase = WB_BUTTON_STYLES.base;
  const wbBtnActive = WB_BUTTON_STYLES.active;
  const wbSmallBtnBase = WB_BUTTON_STYLES.smallBase;
  const wbSmallBtnActive = WB_BUTTON_STYLES.smallActive;

  const timersRef = useRef(new Map());
  const stopwatchesRef = useRef(new Map());

  // Component mount - initialize session
  useEffect(() => {
    console.log('[CoachSession] Component mounted, sessionId:', sessionId);
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.error('[CoachSession] No user data found in localStorage');
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    console.log('[CoachSession] User data:', { id: user.id, role: user.role, name: user.name });

    if (user.role !== 'coach') {
      toast.error('Unauthorized access - coaches only');
      navigate('/');
      return;
    }

    // Only initialize if not already initialized
    if (!webRTC && !whiteboardService && !isInitializingRef.current) {
      initializeSession(user.id);
    }

    return () => {
      console.log('[CoachSession] Component unmounting, cleaning up');
      cleanup();
    };
  }, [sessionId, navigate]); // Only re-run if sessionId changes

  // Load initial content (latest 5 from admin) on mount
  useEffect(() => {
    const loadDefaultContent = async () => {
      try {
        const allContent = await learningContentService.coach.getAll();
        // Sort by created_at descending and take first 5
        const latest = allContent
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);
        setDefaultContent(latest);
      } catch (error) {
        console.error('[CoachSession] Error loading default content:', error);
        setDefaultContent([]);
      }
    };

    loadDefaultContent();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!sessionInfo || !sessionInfo.started_at || !sessionInfo.duration) {
      setTimeLeft('--:--');
      return;
    }

    // Ensure we're parsing the date correctly - handle both ISO strings and timestamps
    let startTime;
    if (typeof sessionInfo.started_at === 'string') {
      // Parse ISO string to UTC timestamp
      startTime = new Date(sessionInfo.started_at.replace(' ', 'T')).getTime();
    } else {
      startTime = new Date(sessionInfo.started_at).getTime();
    }

    // Validate the parsed time
    if (isNaN(startTime)) {
      console.error('[CoachSession] Invalid start time:', sessionInfo.started_at);
      setTimeLeft('--:--');
      return;
    }

    const durationMs = sessionInfo.duration * 60 * 1000;
    const endTime = startTime + durationMs;

    // Update immediately
    const updateTimer = () => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeLeft('00:00');
        return false; // Timer finished
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        return true; // Timer still running
      }
    };

    // Initial update
    if (!updateTimer()) {
      return; // Don't start interval if already finished
    }

    // Set up interval
    const intervalId = setInterval(() => {
      if (!updateTimer()) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sessionInfo]);

  // Listen for item selection messages from client/guest
  useEffect(() => {
    if (!whiteboardService) return;

    // Set up callback for item selection by client/guest
    whiteboardService.onItemSelected = (data) => {
      console.log('[CoachSession] Remote user selected items:', data);
      // Store remote selections regardless of who sent them
      if (data.itemIds && Array.isArray(data.itemIds)) {
        setRemoteSelectedItemIds(data.itemIds);
      }
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onItemSelected = null;
      }
    };
  }, [whiteboardService]);

  // Auto-hide info bar after 5 seconds
  useEffect(() => {
    if (showInfoBar) {
      const timer = setTimeout(() => setShowInfoBar(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showInfoBar]);

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
      console.log('[CoachSession] Session details:', session);

      // 🔹 Purpose: Prevent access to already-ended sessions (e.g., via browser back button)
      // 🔸 How it works: Check if session status is 'ended', redirect immediately
      if (session.status === 'ended') {
        toast.warning('This session has already ended');
        navigate('/coach/dashboard');
        return;
      }

      setSessionInfo(session);

      await initializeWebRTC(session.session_id);
      setLoading(false);
    } catch (error) {
      console.error('[CoachSession] Error initializing session:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to initialize session';
      toast.error(errorMsg);
      navigate('/coach/dashboard');
    }
  };

  const initializeWebRTC = async (numericSessionId) => {
    // Prevent duplicate initialization
    if (isInitializingRef.current) {
      console.log('[CoachSession] Already initializing, skipping duplicate call');
      return;
    }
    isInitializingRef.current = true;

    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, numericSessionId, 'coach');
    try {
      wbService.initialize();
      setWhiteboardService(wbService);

      // Set up callback for bucket added/updated
      wbService.onBucketAdded = (data) => {
        console.log('[CoachSession] Bucket added:', data);
        setBuckets(prev => {
          const exists = prev.find(bucket => bucket.id === data.id);
          if (!exists) {
            return [...prev, data];
          }
          return prev;
        });
      };

      wbService.onBucketUpdate = (data) => {
        console.log('[CoachSession] Bucket updated:', data);
        if (data.removed) {
          setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
        } else {
          setBuckets(prev => prev.map(bucket =>
            bucket.id === data.id ? { ...bucket, ...data } : bucket
          ));
        }
      };

      // Set up callback for floating animations (reactions)
      wbService.onFloatingAnimations = (data) => {
        console.log('[CoachSession] Floating animations received:', data);
        setFloatingAnimations(prev => [...prev, ...data.animations]);

        // Auto-remove after 13 seconds (same as trainer)
        setTimeout(() => {
          setFloatingAnimations(prev =>
            prev.filter(a => !data.animations.find(na => na.id === a.id))
          );
        }, 13000);
      };

      // Set up callback for erase pen event
      wbService.onErasePen = () => {
        console.log('[CoachSession] Received erase pen event');
        setErasePenTrigger(prev => prev + 1);
        setRedrawCanvasTrigger(prev => prev + 1);
      };

      const tbService = new WhiteboardToolsService(wbService);
      setToolsService(tbService);
    } catch (error) {
      console.error('[CoachSession] Error initializing whiteboard:', error);
      toast.error('Failed to initialize whiteboard');
    }

    // Initialize Video Conference Service
    const videoService = new VideoConferenceService(WS_BASE_URL, numericSessionId, 'coach');

    try {
      videoService.onLocalStream = (stream) => {
        console.log('[CoachSession] Local stream initialized');
        setLocalStream(stream);
        setConnectionStatus('Waiting for client...');
      };

      videoService.onRemoteStream = (stream) => {
        console.log('[CoachSession] Received remote stream from client');
        setRemoteStream(stream);
        setConnectionStatus('Connected');

        // Only show toast once when client first connects
        if (!clientConnectedRef.current) {
          clientConnectedRef.current = true;
          toast.success(`${sessionInfo?.client_name || 'Client'} has joined the session`);
        }
      };

      videoService.onConnectionStateChange = (state) => {
        console.log('[CoachSession] Connection state changed to:', state);
        const statusMap = {
          'new': 'connecting',
          'connecting': 'connecting',
          'connected': 'connected',
          'disconnected': 'disconnected',
          'failed': 'failed',
          'closed': 'disconnected'
        };
        setConnectionStatus(statusMap[state] || state);

        // Handle client disconnect
        if ((state === 'disconnected' || state === 'closed') && clientConnectedRef.current) {
          console.log('[CoachSession] Client disconnected');
          toast.info(`${sessionInfo?.client_name || 'Client'} has left the session`);
          setRemoteStream(null);
          clientConnectedRef.current = false;
        }
      };

      videoService.onError = (error) => {
        console.error('[CoachSession] Video conference error:', error);
        toast.error(`Video error: ${error.message}`);
      };

      await videoService.initialize();
      setWebRTC(videoService);
    } catch (error) {
      console.error('[CoachSession] Video Conference init error:', error);
      toast.error('Failed to initialize video connection: ' + error.message);
    }
  };

  const handleToggleMic = () => {
    if (webRTC) {
      utilToggleMicrophone(webRTC, setMicEnabled);
    }
  };

  const handleToggleCamera = () => {
    if (webRTC) {
      utilToggleCamera(webRTC, setCameraEnabled);
    }
  };

  const handleEndSession = async () => {
    await utilEndSession({
      whiteboardService,
      sessionServiceEndFn: (id, notes) => coachSessionService.endSession(id, notes),
      sessionId,
      notes: '',
      cleanupFn: cleanup,
      navigate,
      dashboardPath: '/coach/dashboard',
      roleName: 'coach'
    });
  };

  const handleFreeze = () => {
    utilToggleFreeze(isFrozen, setIsFrozen, webRTC, 'client');
  };

  const cleanup = () => {
    cleanupSessionResources({
      videoService: webRTC,
      whiteboardService,
      toolsService,
      recordingService: null,
      secondaryVideoService: null,
      isInitializingRef
    });
  };

  const toggleClientToolAccess = (toolName) => {
    utilToggleToolAccess(toolName, clientToolAccess, setClientToolAccess, whiteboardService, setTool);
  };

  const triggerClientKeyboard = () => {
    triggerParticipantKeyboard(whiteboardService, 'client');
  };

  const addBucket = () => {
    // Use conservative canvas dimensions to ensure buckets stay within bounds
    // These are approximate - actual canvas is responsive but we use safe margins
    utilAddBucket(buckets, setBuckets, whiteboardService, bucketColor, 900, 500);
  };

  const eraseAllPen = () => {
    utilEraseAllPen({
      setErasePenTrigger,
      setRedrawCanvasTrigger,
      whiteboardService
    });
  };

  const spawnFloatingAnimation = (type, asset) => {
    utilSpawnFloatingAnimation({
      type,
      asset,
      activeFloatingAnimationTypesRef: activeFloatingAnimationTypesRef.current,
      setFloatingAnimations,
      whiteboardService,
      count: 10
    });
  };

  const handleToolClick = (tool) => {
    utilHandleToolClick({
      tool,
      setFeedbackMessage,
      setWaitingMessage,
      setShowExercise,
      spawnFloatingAnimation,
      toggleLearnerToolAccess: toggleClientToolAccess,
      whiteboardService,
      REACTION_SVG_ASSETS
    });
  };

  const audioContextRef = useRef(null);
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playPopSound = (animationType) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      switch (animationType) {
        case 'bubble':
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.1);
          break;
        case 'balloon':
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.15);
          break;
        case 'smiley':
          osc.frequency.setValueAtTime(700, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.05);
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.08);
          break;
        case 'star':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.12);
          break;
        default:
          osc.frequency.setValueAtTime(500, ctx.currentTime);
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.1);
      }
    } catch (error) {
      console.error('[CoachSession] Error playing pop sound:', error);
    }
  };

  const handleAnimationPop = (animationId, poppedLeft, poppedTop) => {
    // Find the animation to get its type for sound effect
    const animation = floatingAnimations.find(a => a.id === animationId);
    if (animation) {
      playPopSound(animation.type);
    }

    setFloatingAnimations(prev =>
      prev.map(anim =>
        anim.id === animationId
          ? { ...anim, popped: true, poppedLeft, poppedTop }
          : anim
      )
    );

    // Broadcast the animation pop event to learner
    if (whiteboardService) {
      whiteboardService.send('animation_popped', {
        animationId,
        poppedLeft,
        poppedTop,
        timestamp: Date.now()
      });
    }
  };

  // Learning content search handler with lazy loading
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
  React.useEffect(() => {
    const searchDatabase = async () => {
      if (!learningContentSearch.trim()) {
        setDatabaseSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        console.log('[CoachSession] Searching database for:', learningContentSearch);

        // Fetch all learning content from database based on user role
        const userData = localStorage.getItem('user_data');
        const user = userData ? JSON.parse(userData) : null;

        let allContent = [];
        if (user?.role === 'admin') {
          allContent = await learningContentService.admin.getAll();
        } else if (user?.role === 'coach') {
          allContent = await learningContentService.coach?.getAll() || [];
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

        console.log('[CoachSession] Database search results:', filtered);
        setDatabaseSearchResults(filtered);
      } catch (error) {
        console.error('[CoachSession] Error searching database:', error);
        setDatabaseSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchDatabase, 300);
    return () => clearTimeout(timeoutId);
  }, [learningContentSearch]);

  // Filtered learning content logic
  const filteredLearningContent = (() => {
    // If there's a search term, show database results
    if (learningContentSearch.trim()) {
      return databaseSearchResults;
    }

    // Otherwise, show latest 5 content from admin as default
    return defaultContent;
  })();

  // Drag start handler for content cards
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

  // Text tool handlers
  const handleAddTextBox = () => {
    const newTextBox = {
      id: `text_${Date.now()}`,
      text: '',
      x: window.innerWidth / 2 - 200,
      y: window.innerHeight / 2 - 75,
      width: 400,
      height: 150,
      fontSize: textSize,
      fontColor: '#000000'
    };

    setTextBoxes(prev => [...prev, newTextBox]);
    setActiveTextBoxId(newTextBox.id);

    // Broadcast to clients
    if (whiteboardService) {
      whiteboardService.send('text_box_added', newTextBox);
    }
  };

  const handleTextBoxChange = (id, text) => {
    setTextBoxes(prev => prev.map(box =>
      box.id === id ? { ...box, text } : box
    ));

    // Broadcast text change in real-time
    if (whiteboardService) {
      whiteboardService.send('text_box_update', { id, text });
    }
  };

  const handleTextBoxResize = (id, width, height) => {
    setTextBoxes(prev => prev.map(box =>
      box.id === id ? { ...box, width, height } : box
    ));

    // Broadcast resize
    if (whiteboardService) {
      whiteboardService.send('text_box_update', { id, width, height });
    }
  };

  const handleTextBoxMove = (id, x, y) => {
    setTextBoxes(prev => prev.map(box =>
      box.id === id ? { ...box, x, y } : box
    ));

    // Broadcast move
    if (whiteboardService) {
      whiteboardService.send('text_box_update', { id, x, y });
    }
  };

  const handleRemoveTextBox = (id) => {
    setTextBoxes(prev => prev.filter(box => box.id !== id));
    if (activeTextBoxId === id) {
      setActiveTextBoxId(null);
    }

    // Broadcast removal
    if (whiteboardService) {
      whiteboardService.send('text_box_removed', { id });
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  return (
    <div className={`session-page ${pageClassName}`}>
      {/* Navigation / Header */}
      <div className={`session-header ${!showHeader ? 'hidden' : ''} ${navbarClassName}`} onClick={handleHeaderClick}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">HurshBin Coach</div>
            <div className="session-header-subtitle">
              {sessionInfo?.title ?? 'Coach Session'} — Client: {sessionInfo?.client_name ?? 'Client'}
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
              className="btn-secondary"
              style={{ color: 'white' }}
              onClick={() => window.open('/coach/dashboard', '_blank', 'noopener,noreferrer')}
            >
              🏠 Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Info bar */}
      {showInfoBar && (
        <div className="session-info-banner">
          <span className="session-info-text">
            <strong>ℹ️ Session Active:</strong> All interactions are being recorded.
          </span>
          <button
            onClick={() => setShowInfoBar(false)}
            className="text-gray-600 hover:text-gray-800 font-bold text-lg ml-2 sm:ml-4"
            title="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="session-main-layout" style={{ minHeight: 'calc(100vh - 6.25rem)' }}>
        {/* Desktop Only: Left Sidebar - Learning Content */}
        <div className="flex flex-col" style={{ maxHeight: ' 110vh' }}>
          <div className="bg-white rounded-lg shadow p-4 flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
            <h3 className="text-lg font-bold mb-3">📚 Learning Content</h3>
            <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
              <LearningContentSidebar
                learningContentSearch={learningContentSearch}
                handleLearningContentSearch={handleLearningContentSearch}
                filteredLearningContent={filteredLearningContent}
                isSearching={isSearching}
                onDragStartContent={onDragStartContent}
                onRemoveFromWhiteboard={(itemId) => {
                  setCanvasItems(prev => prev.filter(item => item.id !== itemId));
                }}
              />
            </div>
          </div>

          {/* Message Box - Below Learning Content */}
          <div className="mb-4 session-message-box border-2 border-gray-300 mt-4 rounded bg-gray-50 w-full flex-shrink-0" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', maxHeight: '300px', display: 'flex', flexDirection: 'column' }}>
            <div className="font-semibold text-slate-800 mb-2" style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1rem)' }}>💬 Message Box</div>
            <div className="overflow-y-auto mb-2 flex-1" style={{ maxHeight: '150px', minHeight: '80px' }}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`message-bubble ${msg.sender === 'You' ? 'message-bubble-sent' : 'message-bubble-received'}`}>
                  <strong>{msg.sender}:</strong> {msg.text}
                  <div className="text-gray-500 mt-1" style={{ fontSize: 'clamp(0.5rem, 1vw, 0.625rem)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}>
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type message..."
                className="flex-1 border border-gray-300 rounded"
                style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)' }}
              />
              <button
                onClick={sendMessage}
                className="bg-[#DB9D32] text-white border-none rounded cursor-pointer hover:bg-[#9C4D0B]"
                style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem) clamp(0.75rem, 2vw, 1.25rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)' }}
              >
                Send
              </button>
            </div>
          </div>
          {/* Stopwatch */}
          {showStopwatch && (
            <div  >
              <StopwatchDisplay
                formattedTime={stopwatch.formattedTime}
                isRunning={stopwatch.isRunning}
                onStart={stopwatch.start}
                onPause={stopwatch.pause}
                onResume={stopwatch.resume}
                onReset={stopwatch.reset}
                onSetTime={stopwatch.setTime}
                showControls={true}
                size="xs"
                variant="standard"
              />
            </div>
          )}
        </div>

        {/* Center Area */}
        <div className="session-center-area">
          {/* Whiteboard */}
          <div className="session-whiteboard-container">
            {/* Moveable Video Feed Overlay */}
            {remoteStream && (
              <MoveableVideoFeed
                videoStream={remoteStream}
                label="Client"
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
                isTrainer={true}
                canvasItems={canvasItems}
                setCanvasItems={setCanvasItems}
                toolAccess={clientToolAccess}
                keyboardMode={keyboardMode}
                keyboardText={keyboardText}
                setKeyboardText={setKeyboardText}
                keyboardPosition={keyboardPosition}
                setKeyboardPosition={setKeyboardPosition}
                remoteSelectedItemIds={remoteSelectedItemIds}
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
                buckets={buckets}
                setBuckets={setBuckets}
                clearCanvasTrigger={clearCanvasTrigger}
                erasePenTrigger={erasePenTrigger}
                redrawCanvasTrigger={redrawCanvasTrigger}
                stopwatchFormattedTime={stopwatch.isRunning ? stopwatch.formattedTime : null}
                stopwatchIsRunning={stopwatch.isRunning}
                toolActive={toolActive}
                textBoxes={textBoxes}
                onTextBoxChange={handleTextBoxChange}
                onTextBoxResize={handleTextBoxResize}
                onTextBoxMove={handleTextBoxMove}
                onRemoveTextBox={handleRemoveTextBox}
                activeTextBoxId={activeTextBoxId}
                setActiveTextBoxId={setActiveTextBoxId}
              />
            </div>
          </div>

          {/* Video Controls */}
          <div className="w-full mt-4 mb-3">
            <div className="flex items-center justify-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
              <button
                onClick={handleToggleMic}
                className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{ padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}
                title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
              >
                <span>{micEnabled ? '🎤' : '🔇'}</span>
              </button>
              <button
                onClick={handleToggleCamera}
                className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{ padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}
                title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                <span>{cameraEnabled ? '📹' : '📷'}</span>
              </button>
              <button
                onClick={handleEndSession}
                className="bg-red-600 hover:bg-red-700 media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md"
                style={{ padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}
              >
                🔴 End
              </button>
            </div>
          </div>

          {/* Whiteboard Drawing Tools */}
          <WhiteboardTools
            tool={tool}
            setTool={setTool}
            toolActive={toolActive}
            setToolActive={setToolActive}
            eraserActive={eraserActive}
            setEraserActive={setEraserActive}
            setEraseAllActive={setEraseAllActive}
            eraseAllPen={eraseAllPen}
            addBucket={addBucket}
            color={color}
            setColor={setColor}
            lineWidth={lineWidth}
            setLineWidth={setLineWidth}
            bucketColor={bucketColor}
            setBucketColor={setBucketColor}
            setCanvasItems={setCanvasItems}
            setBuckets={setBuckets}
            setFloatingAnimations={setFloatingAnimations}
            setClearCanvasTrigger={setClearCanvasTrigger}
            whiteboardService={whiteboardService}
            toolAccess={clientToolAccess}
            toggleToolAccess={toggleClientToolAccess}
            showStopwatch={showStopwatch}
            setShowStopwatch={setShowStopwatch}
            showExercise={showExercise}
            setShowExercise={setShowExercise}
            activeIcons={activeIcons}
            handleToolClick={handleToolClick}
            wbBtnBase={wbBtnBase}
            wbBtnActive={wbBtnActive}
            wbSmallBtnBase={wbSmallBtnBase}
            wbSmallBtnActive={wbSmallBtnActive}
            participantType="client"
          />

          {/* Exercise Tool */}
          {showExercise && (
            <div className="exercise-tool-container" style={{ marginTop: '20px', padding: '0 10px', position: 'relative' }}>
              <Exercise
                isTrainer={true}
                whiteboardService={whiteboardService}
                onClose={() => {
                  setShowExercise(false);
                  if (whiteboardService) {
                    whiteboardService.send('exercise_closed', {
                      timestamp: Date.now()
                    });
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachSession;
