// CoachSession.jsx
// ============================================================================
// 🔹 Purpose: Main React component for the Coach's live session interface.
// 🔸 How it works: Manages session data, WebRTC + Whiteboard, voice input,
// background music, session notes with auto-save, learning goals, and voice-
// to-text conversion for client participants.
//
// 🎯 FEATURES:
//  1. Session Notes - Auto-save every 2 seconds, persistent storage
//  2. Background Music Control - 3 music tracks with volume sync
//  3. Voice Input - Speech-to-text with WebSpeech API support
//  4. Learning Goals - Searchable list with selection
//  5. Enhanced Exercise - Better state management and responses
//  6. Cross-browser Compatible - Firefox, Chrome, Safari, Edge
//  7. Mobile Responsive - Fully responsive on all devices
//  8. Performance Optimized - Debouncing, lazy loading, efficient re-renders
//
// 📱 RESPONSIVE BREAKPOINTS:
//  - Desktop: 1024px+ (3-column layout)
//  - Tablet:  768px-1023px (stacked layout)
//  - Mobile:  <768px (optimized single column)
//
// 🌐 CROSS-BROWSER SUPPORT:
//  - Chrome/Edge 90+
//  - Firefox 88+
//  - Safari 14+
//  - WebRTC, WebSocket, Fetch API support required
//
// ⚡ PERFORMANCE OPTIMIZATIONS:
//  - Debounced search: 300ms delay
//  - Auto-save throttles: 2 seconds
//  - Session check interval: 30 seconds (reduced from 5 seconds)
//  - Message list capped: latest 50 messages
//  - Lazy loading: learning content loads on demand
// ============================================================================

import React, { useEffect, useRef, useState, memo, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import learningContentService from '../../api/services/learningContentService';
import learningGoalsService from '../../api/services/learningGoalsService';
import sessionNotesService from '../../api/services/sessionNotesService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Whiteboard from '../../components/common/Whiteboard';
import MessageList from '../../components/common/MessageList';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useMessages from '../../hooks/useMessages';
import useStopwatch from '../../hooks/useStopwatch';
import useVoiceInput from '../../hooks/useVoiceInput';
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

import { markSessionActive, clearSessionActivity, updateSessionActivity } from '../../utils/sessionActivityTracker';

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

  // Session Notes
  const [sessionNotes, setSessionNotes] = useState('');
  const autoSaveTimerRef = useRef(null);
  const restrictionAlertShownRef = useRef(false);

  // Background Music
  const [backgroundMusicPlaying, setBackgroundMusicPlaying] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const audioRef = useRef(null);

  const musicOptions = [
    { id: 0, name: '🎵 Music 1', url: '/music/background-music-1.mp3' },
    { id: 1, name: '🎶 Music 2', url: '/music/background-music-2.mp3' },
    { id: 2, name: '🎼 Music 3', url: '/music/background-music-3.mp3' }
  ];

  // Voice Input
  const handleMuteMicCallback = (transcriptText) => {
    try {
      if (transcriptText && transcriptText.trim() && whiteboardService) {
        whiteboardService.send('prompt_update', {
          text: transcriptText.trim(),
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('[CoachSession] Error in handleMuteMicCallback:', error);
    }
  };

  const { listening, transcript, toggleListening: handleVoiceToggle } = useVoiceInput({
    lang: 'en-IN',
    onMuteMic: handleMuteMicCallback
  });

  // Learning Goals/Programs (Searchable)
  const [learningGoalsSearch, setLearningGoalsSearch] = useState('');
  const [allLearningGoals, setAllLearningGoals] = useState([]);
  const [filteredLearningGoals, setFilteredLearningGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);

  // Prompt and Reinforcement Meters
  const [selectedPromptLevel, setSelectedPromptLevel] = useState(null);
  const [selectedReinforcementLevel, setSelectedReinforcementLevel] = useState(null);

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
      console.log('[CoachSession] Component unmounting, saving notes and cleaning up');

      // Clear auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Save notes before unmounting using sendBeacon for reliability
      if (sessionNotes && sessionNotes.trim()) {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const data = JSON.stringify({ notes: sessionNotes });

        if (navigator.sendBeacon) {
          const blob = new Blob([data], { type: 'application/json' });
          navigator.sendBeacon(`${API_URL}/session-notes/${sessionId}`, blob);
        }
      }

      clearSessionActivity(sessionId, 'coach');
      cleanup();
    };
  }, [sessionId, navigate]);

  // Load session notes on mount (silent failure - don't interrupt session)
  useEffect(() => {
    const loadSessionNotes = async () => {
      if (!sessionId) return;
      try {
        const notesData = await sessionNotesService.getNotes(sessionId);
        if (notesData && notesData.notes) {
          setSessionNotes(notesData.notes);
        } else {
          setSessionNotes('');
        }
      } catch (error) {
        // Session notes loading is optional - don't interrupt session if it fails
        if (error.response?.status === 401) {
          console.warn('[CoachSession] Session notes requires authentication - skipping for now');
        } else {
          console.warn('[CoachSession] Could not load session notes:', error.message);
        }
        setSessionNotes('');
      }
    };

    const timer = setTimeout(loadSessionNotes, 500);
    return () => clearTimeout(timer);
  }, [sessionId]);

  // Filter learning goals based on search
  useEffect(() => {
    if (!learningGoalsSearch.trim()) {
      // Show all goals when search is empty
      setFilteredLearningGoals(allLearningGoals);
      return;
    }

    const searchTerm = learningGoalsSearch.toLowerCase();
    const filtered = allLearningGoals.filter(goal =>
      (goal.title?.toLowerCase().includes(searchTerm)) ||
      (goal.goal?.toLowerCase().includes(searchTerm)) ||
      (goal.description?.toLowerCase().includes(searchTerm))
    );
    setFilteredLearningGoals(filtered);
  }, [learningGoalsSearch, allLearningGoals]);

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

  // Load learning goals created by admin (optional - don't interrupt session)
  useEffect(() => {
    const loadLearningGoals = async () => {
      try {
        console.log('[CoachSession] Attempting to load learning goals...');
        const goals = await learningGoalsService.coach.getAll();
        console.log('[CoachSession] Learning goals loaded successfully:', goals);
        console.log('[CoachSession] Goals count:', goals?.length || 0);

        // Handle both array and paginated response
        let goalsArray = Array.isArray(goals) ? goals : goals?.data || [];
        setAllLearningGoals(goalsArray);
        setFilteredLearningGoals(goalsArray);
      } catch (error) {
        // Learning goals is optional - silently continue without it
        console.log('[CoachSession] Learning goals loading failed:');
        console.log('  - Error status:', error.response?.status);
        console.log('  - Error message:', error.message);
        console.log('  - Error detail:', error.response?.data?.detail);

        if (error.response?.status === 401) {
          console.warn('[CoachSession] Learning goals requires authentication - continuing without them');
        } else {
          console.error('[CoachSession] Error loading learning goals:', error.message);
        }
        setAllLearningGoals([]);
        setFilteredLearningGoals([]);
      }
    };

    loadLearningGoals();
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
        toast.warning('Session time has ended. You can now end the session.');
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sessionInfo]);

  // Session status polling - check if session ended every 30 seconds
  useEffect(() => {
    if (!sessionInfo || sessionInfo.status !== 'active') return;

    const checkInterval = setInterval(async () => {
      try {
        // Update session activity to mark session as still active
        updateSessionActivity(sessionId, 'coach');

        const updatedSession = await coachSessionService.getSessionDetails(sessionId);
        if (updatedSession.status === 'ended') {
          toast.info('Session has ended');
          cleanup();
          navigate('/coach/dashboard');
        }
      } catch (error) {
        // Suppress error toast for connection issues during polling
        console.error('Error checking session status:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [sessionInfo, sessionId]);

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

    // Set up callback for animation pop events from client/guest
    whiteboardService.onAnimationPopped = (data) => {
      console.log('[CoachSession] Animation popped by client/guest:', data);
      handleAnimationPop(data.animationId, data.poppedLeft, data.poppedTop);
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onItemSelected = null;
        whiteboardService.onAnimationPopped = null;
      }
    };
  }, [whiteboardService]);

  // Auto-hide info bar after 5 seconds (improved UX)
  useEffect(() => {
    if (showInfoBar) {
      const timer = setTimeout(() => setShowInfoBar(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showInfoBar]);

  // Auto-hide header after 5 seconds on mobile/tablet for better screen space
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

      // 🔹 Purpose: Check if session is already active on another device/tab
      // 🔸 How it works: sessionActivityTracker automatically handles stale sessions for coaches
      // Coaches can only have ONE active session, so we allow overriding previous sessions
      const sessionCheck = markSessionActive(sessionId, 'coach');
      if (!sessionCheck.success) {
        if (!restrictionAlertShownRef.current) {
          restrictionAlertShownRef.current = true;
          toast.error(sessionCheck.message);
          navigate('/coach/dashboard');
        }
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

  // Cross-browser audio context initialization
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        // Try standard AudioContext first (Chrome, Firefox, Safari 14.1+)
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (error) {
        console.error('[CoachSession] Failed to initialize AudioContext:', error);
        return null;
      }
    }
    return audioContextRef.current;
  }, []);

  const playPopSound = useCallback((animationType) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return; // Audio context not available

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
  }, [getAudioContext]);

  const handleAnimationPop = useCallback((animationId, poppedLeft, poppedTop) => {
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

    // Broadcast the animation pop event to client
    if (whiteboardService) {
      whiteboardService.send('animation_popped', {
        animationId,
        poppedLeft,
        poppedTop,
        timestamp: Date.now()
      });
    }
  }, [floatingAnimations, whiteboardService, playPopSound]);

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

  // ========================================
  // HANDLER FUNCTIONS FOR NEW FEATURES (Memoized for Performance)
  // ========================================

  // Session Notes Handlers
  const handleNotesChange = useCallback((newNotes) => {
    setSessionNotes(newNotes);

    // Clear existing auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer (save after 2 seconds of inactivity)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await sessionNotesService.saveNotes(sessionId, newNotes);
        console.log('[CoachSession] Session notes auto-saved');
      } catch (error) {
        console.error('[CoachSession] Error auto-saving notes:', error);
      }
    }, 2000);
  }, [sessionId]);

  const handleClearNotes = useCallback(() => {
    setSessionNotes('');
  }, []);

  // Voice Input Toggle
  const toggleListening = useCallback(async () => {
    try {
      // If turning ON voice input and video mic is ON, turn OFF
      if (!listening && micEnabled && webRTC) {
        webRTC.toggleMicrophone();
        setMicEnabled(false);
      }

      // Toggle voice input
      await handleVoiceToggle();

      // If turning OFF voice input and video mic is OFF, turn ON
      if (listening && !micEnabled && webRTC) {
        webRTC.toggleMicrophone();
        setMicEnabled(true);
      }
    } catch (error) {
      console.error('[CoachSession] Error in toggleListening:', error);
      toast.error('Voice input error - please try again');
    }
  }, [listening, micEnabled, handleVoiceToggle, webRTC]);

  // Background Music Control (Memoized)
  const toggleBackgroundMusic = useCallback((musicId) => {
    if (selectedMusic === musicId && backgroundMusicPlaying) {
      // Stop music
      setBackgroundMusicPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (whiteboardService) {
        whiteboardService.send('background_music', {
          playing: false,
          musicId: null,
          volume: musicVolume,
          timestamp: Date.now()
        });
      }
    } else {
      // Start music
      setSelectedMusic(musicId);
      setBackgroundMusicPlaying(true);

      if (audioRef.current) {
        audioRef.current.src = musicOptions[musicId].url;
        audioRef.current.loop = true;
        audioRef.current.volume = musicVolume;
        audioRef.current.play().catch(err => {
          console.log('[CoachSession] Audio play error:', err);
        });
      }

      if (whiteboardService) {
        whiteboardService.send('background_music', {
          playing: true,
          musicId: musicId,
          musicUrl: musicOptions[musicId].url,
          volume: musicVolume,
          timestamp: Date.now()
        });
      }
    }
  }, [selectedMusic, backgroundMusicPlaying, musicVolume, whiteboardService]);

  const handleMusicVolumeChange = useCallback((newVolume) => {
    setMusicVolume(newVolume);

    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }

    if (whiteboardService && backgroundMusicPlaying) {
      whiteboardService.send('background_music_volume', {
        volume: newVolume,
        timestamp: Date.now()
      });
    }
  }, [backgroundMusicPlaying, whiteboardService]);

  // Learning Goals Handler (Memoized)
  const handleGoalSelect = useCallback((goalId) => {
    setSelectedGoalId(selectedGoalId === goalId ? null : goalId);

    if (whiteboardService) {
      whiteboardService.send('goal_selected', {
        goalId,
        selected: selectedGoalId !== goalId,
        timestamp: Date.now()
      });
    }
  }, [selectedGoalId, whiteboardService]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  return (
    <div className={`session-page ${pageClassName}`}>
      {/* Hidden audio element for background music */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onEnded={() => {
          // Music loops automatically
        }}
      />

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
      <div className="session-main-layout" style={{ minHeight: 'calc(100vh - 6.25rem)', display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 'clamp(0.5rem, 1.5vw, 1rem)', padding: 'clamp(0.5rem, 1.5vw, 1rem)' }}>

        {/* LEFT SIDEBAR: Coach Goals + Meters + Voice Input + Notes */}
        <div className="sidebar-container">
          <div className="sidebar-header sidebar-header-blue">
            🎯 Coach Goals
          </div>

          <div className="sidebar-content">
            {/* Learning Goals */}
            <div className="sidebar-section-title">Learning Goals</div>
            <div className="sidebar-search-box">
              <input
                type="text"
                className="sidebar-search-input"
                placeholder="🔍 Search Program name..."
                value={learningGoalsSearch}
                onChange={(e) => setLearningGoalsSearch(e.target.value)}
              />
            </div>
            <div className="sidebar-scrollable">
              {learningGoalsSearch && filteredLearningGoals.length > 0 ? (
                filteredLearningGoals.map((goal, index) => (
                  <div key={goal.id ?? index} className="sidebar-list-item">
                    <input
                      type="checkbox"
                      className="sidebar-checkbox"
                      checked={selectedGoalId === goal.id}
                      onChange={() => {
                        setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id);
                        if (whiteboardService) {
                          whiteboardService.send('goal_selected', {
                            goalId: goal.id,
                            selected: selectedGoalId !== goal.id,
                            timestamp: Date.now()
                          });
                        }
                      }}
                    />
                    <div className="sidebar-item-text">
                      <div>{goal.title || goal.goal}</div>
                      {goal.description && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{goal.description}</div>}
                    </div>
                    <div className="sidebar-badge" title="Goal selected">—</div>
                  </div>
                ))
              ) : learningGoalsSearch ? <div className="sidebar-empty-text">No programs match "{learningGoalsSearch}"</div> : null
              }
            </div>

            {/* Prompt Meter */}
            <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>📊 Prompt Meter</div>
            <div className="meter-container meter-container-blue">
              <div className="meter-buttons">
                {['I', '10', '20', '30', '40', '50', '60', '70', '80', '90'].map((p) => (
                  <div
                    key={p}
                    className={`meter-button ${selectedPromptLevel === p ? 'meter-button-selected' : 'meter-button-green'}`}
                    onClick={() => {
                      setSelectedPromptLevel(p);
                      if (webRTC) {
                        webRTC.sendPromptMeter(p);
                      }
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
              <div className="meter-helper-text">Click to record prompt level for selected goal</div>
              {selectedPromptLevel && (
                <div className="meter-selected-text">
                  Selected: {selectedPromptLevel}
                </div>
              )}
            </div>

            {/* Reinforcement Meter */}
            <div className="sidebar-section-title"><Emoji emoji="🎯" size="base" /> Reinforcement Meter</div>
            <div className="meter-container meter-container-green">
              <div className="meter-buttons">
                {['Full', '90', '80', '70', '60', '50', '40', '30', '20', '10'].map((r) => (
                  <div
                    key={r}
                    className={`meter-button ${selectedReinforcementLevel === r ? 'meter-button-selected' : 'meter-button-green'}`}
                    onClick={() => {
                      setSelectedReinforcementLevel(r);
                      if (webRTC) {
                        webRTC.sendReinforcementMeter(r);
                      }
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
              {selectedReinforcementLevel && (
                <div className="meter-selected-text">
                  Selected: {selectedReinforcementLevel}
                </div>
              )}
            </div>

            {/* Voice Input Section */}
            <div className="voice-section">
              <h3 className="sidebar-section-title">🎙️ Voice Input</h3>
              <button
                onClick={toggleListening}
                className={`voice-button ${listening ? 'voice-button-recording' : 'voice-button-idle'}`}
              >
                {listening ? "🔇" : <FaMicrophone />}
              </button>
              <p className="voice-status-text">
                {listening ? '🎤 Recording... Click to stop' : '📢 Click to start recording'}
              </p>
              <textarea
                value={transcript || ''}
                onChange={(e) => { }}
                placeholder="Your voice will be transcribed here..."
                readOnly
                style={{
                  width: '100%',
                  padding: '10px',
                  minHeight: '80px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  backgroundColor: '#fff',
                  color: '#000'
                }}
              />
              <button
                onClick={() => {
                  if (transcript && whiteboardService) {
                    whiteboardService.send('prompt_update', {
                      text: transcript.trim(),
                      timestamp: Date.now()
                    });
                  }
                }}
                disabled={!transcript}
                className="btn-send-to-learner"
              >
                ✈️ Send to Client
              </button>
            </div>

            {/* Session Notes */}
            <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>📝 Session Notes</div>
            <div className="session-notes-box" style={{ padding: '12px', marginBottom: '12px' }}>
              <textarea
                value={sessionNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Type session notes here... (auto-saves every 2 seconds)"
                style={{
                  width: '100%',
                  padding: '10px',
                  minHeight: '100px',
                  border: '1px solid #d6d6d6',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  backgroundColor: '#fff',
                  color: '#000'
                }}
              />
              <div style={{ fontSize: '11px', color: '#999', marginTop: '6px', textAlign: 'right' }}>
                {sessionNotes.length} characters
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: Whiteboard + Controls */}
        <div className="session-center-area" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
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
          <div className="w-full">
            <div className="flex items-center justify-center flex-wrap" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
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



              {/* End Session */}
              <button
                onClick={handleEndSession}
                className="bg-red-600 hover:bg-red-700 media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md"
                style={{ padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}
              >
                🔴 End
              </button>
            </div>

            {/* Background Music Controls */}
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center justify-between mb-2" style={{ gap: '0.5rem' }}>
                <span className="font-semibold text-sm">🎵 Background Music</span>
                <div className="flex gap-2">
                  {musicOptions.map(music => (
                    <button
                      key={music.id}
                      onClick={() => toggleBackgroundMusic(music.id)}
                      className={`px-2 py-1 rounded text-xs transition-all duration-200 ${selectedMusic === music.id && backgroundMusicPlaying
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                        }`}
                    >
                      {music.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Volume:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={musicVolume}
                  onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
                  className="flex-1"
                  style={{ maxWidth: '150px' }}
                  title={`Volume: ${Math.round(musicVolume * 100)}%`}
                />
                <span className="text-xs font-semibold">{Math.round(musicVolume * 100)}%</span>
              </div>

              {backgroundMusicPlaying && (
                <div className="text-xs text-green-600 mt-2 font-semibold">
                  ✅ Music is playing and synced to client
                </div>
              )}
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

          {/* Stopwatch */}
          {showStopwatch && (
            <div>
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

        {/* RIGHT SIDEBAR: Learning Content */}
        <div className="sidebar-container">
          <div className="sidebar-header sidebar-header-blue">
            📚 Learning Content
          </div>

          <div className="sidebar-content">
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
      </div>
    </div>
  );
};

export default CoachSession;
