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

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useStopwatch from '../../hooks/useStopwatch';
import useVoiceInput from '../../hooks/useVoiceInput';
import { useMediaControl } from '../../context/MediaControlContext';
import { FaMicrophone } from 'react-icons/fa';
import Emoji from '../../components/common/Emoji';
import LearningContentSidebar from '../trainer/LearningContentSidebar';
import LearningProgramSidebar from '../trainer/LearningProgramSidebar';
import YouTubePopup from '../../components/common/YouTubePopup';
import Exercise from '../../components/session/Exercise';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
// Import session utilities from InstructorSessionLayout
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
  triggerParticipantKeyboard,
  getAudioContext,
  playPopSound,
  handleAnimationPop as utilHandleAnimationPop
} from '../../components/session/InstructorSessionLayout';

import {
  MUSIC_OPTIONS,
  autoSaveSessionNotes,
  sendFloatingAnimation,
  toggleParticipantToolAccess,
  formatTimeRemaining,
  setupParticipantAnimationPopListener
} from '../../utils/instructorSession';

import { markSessionActive, clearSessionActivity, updateSessionActivity } from '../../utils/sessionActivityTracker';
import '../../styles/session.css';

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
  const remoteVideoRef = useRef(null); // Ref for remote video element

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

  const musicOptions = MUSIC_OPTIONS;

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

  // YouTube popup state
  const [youtubePopups, setYoutubePopups] = useState([]); // Array of { id, videoId, title, position }

  // Messages - Removed useMessages hook (not used in trainer session layout)
  // const {
  //   messages,
  //   currentMessage,
  //   setCurrentMessage,
  //   sendMessage,
  //   handleKeyPress,
  //   addReceivedMessage
  // } = useMessages(webRTC, 'coach');

  // useEffect(() => {
  //   if (webRTC) {
  //     webRTC.onMessage = (message) => {
  //       addReceivedMessage({
  //         sender: message.sender === 'coach' ? 'You' : message.sender,
  //         text: message.text,
  //         timestamp: message.timestamp
  //       });
  //     };
  //   }
  //   return () => {
  //     if (webRTC) {
  //       webRTC.onMessage = null;
  //     }
  //   };
  // }, [webRTC, addReceivedMessage]);

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
  const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]);
  const whiteboardCanvasRef = useRef(null); // Ref for whiteboard canvas (for positioning)

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
  const [drawerOpen, setDrawerOpen] = useState({
    video: true,
    program: false,
    content: false
  }); // Drawer states for mobile/tablet

  // Drawing tools
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [buckets, setBuckets] = useState([]);
  const [bucketColor, setBucketColor] = useState('#8B6F47');
  const [showExercise, setShowExercise] = useState(false);
  const [exerciseData, setExerciseData] = useState({
    question: '',
    answer: ''
  });
  const [toolActive, setToolActive] = useState(false);
  const [eraserActive, setEraserActive] = useState(false);
  const [eraseAllActive, setEraseAllActive] = useState(false);

  // Tool access control for client
  const [clientToolAccess, setClientToolAccess] = useState({
    select: false,    // Can select items on canvas
    drag: false       // Can drag items on canvas
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
      // Show nothing when search is empty - only show results after user searches
      setFilteredLearningGoals([]);
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
    setupParticipantAnimationPopListener(whiteboardService, floatingAnimations, setFloatingAnimations, playPopSound);

    // Set up callback for exercise answer updates from client
    whiteboardService.onExerciseAnswerUpdate = (data) => {
      // console.log('[CoachSession] 📝 Client answer updated:', data);
      if (data.qaItems) {
        // New format with multiple Q&A items
        setExerciseData(prev => ({
          ...prev,
          qaItems: data.qaItems
        }));
      } else {
        // Single answer format
        setExerciseData(prev => ({
          ...prev,
          question: data.question || prev.question,
          answer: data.answer || ''
        }));
      }
    };

    // Set up callback for exercise submission from client
    whiteboardService.onExerciseResponse = (data) => {
      // console.log('[CoachSession] 📋 Client submitted exercise:', data);
      if (data.qaItems) {
        // New format with multiple Q&A items
        setExerciseData(prev => ({
          ...prev,
          qaItems: data.qaItems
        }));
      } else {
        // Backward compatibility for single answer
        setExerciseData(prev => ({
          ...prev,
          question: data.question,
          clientAnswer: data.clientAnswer
        }));
      }
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onItemSelected = null;
        whiteboardService.onAnimationPopped = null;
        whiteboardService.onExerciseAnswerUpdate = null;
        whiteboardService.onExerciseResponse = null;
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

  // Show header again on click for mobile/tablet
  const handleHeaderClick = () => {
    if (window.innerWidth < 1024) {
      setShowHeader(true);
    }
  };

  // Attach client's remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[CoachSession] Attaching remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

  // Animation pop handler using utility function
  const handleAnimationPop = (animationId, poppedLeft, poppedTop) => {
    utilHandleAnimationPop({
      animationId,
      poppedLeft,
      poppedTop,
      floatingAnimations,
      setFloatingAnimations,
      whiteboardService
    });
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
    const dragPayload = {
      id: content.id,
      title: content.title,
      type: content.is_youtube ? 'youtube' : content.content_type,
      url: content.file_url || null,
      thumbnail: content.thumbnail_url || null,
      mimeType: content.content_type === 'image' ? 'image/jpeg' : 'application/octet-stream',
      originalFilename: content.title,
      is_youtube: content.is_youtube || false,
      youtube_url: content.youtube_url || null,
      youtube_video_id: content.youtube_video_id || null,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle YouTube content dropped on whiteboard
  const handleYoutubeDropped = (videoData) => {
    const newPopup = {
      id: Date.now(),
      videoId: videoData.videoId,
      title: videoData.title,
      position: videoData.position,
    };

    // console.log('[CoachSession] YouTube popup created:', newPopup);
    setYoutubePopups(prev => [...prev, newPopup]);

    // Broadcast to client via whiteboard service
    if (whiteboardService && typeof whiteboardService.send === 'function') {
      whiteboardService.send('youtube_popup_created', {
        popupId: newPopup.id,
        videoId: newPopup.videoId,
        title: newPopup.title,
        position: newPopup.position,
        timestamp: Date.now()
      });
      // console.log('[CoachSession] YouTube popup sync sent to client');
    }
  };

  // Close a YouTube popup and sync to client
  const handleCloseYoutubePopup = (popupId) => {
    setYoutubePopups(prev => prev.filter(popup => popup.id !== popupId));

    // Broadcast closure to client via whiteboard service
    if (whiteboardService && typeof whiteboardService.send === 'function') {
      whiteboardService.send('youtube_popup_closed', {
        popupId: popupId,
        timestamp: Date.now()
      });
      // console.log('[CoachSession] YouTube popup closed, sync sent to client');
    }
  };



  // Exercise tool handlers
  const handleExerciseUpdate = (exerciseInfo) => {
    // console.log('[CoachSession] Exercise updated:', exerciseInfo);
    setExerciseData(exerciseInfo);

    // Send exercise to client via whiteboard service
    if (whiteboardService) {
      whiteboardService.send('exercise_update', {
        question: exerciseInfo.question,
        answer: exerciseInfo.answer || '',
        timestamp: Date.now()
      });
    }
  };

  const handleExerciseAnswerChange = (answerData) => {
    // console.log('[CoachSession] Client answer updated:', answerData);
    // Update the answer in exerciseData
    setExerciseData(prev => ({
      ...prev,
      answer: answerData.answer || ''
    }));
  };

  const handleExerciseSubmit = (response) => {
    console.log('[CoachSession] Exercise response received:', response);

    // Handle client's answer submission
    if (response.status === 'submitted') {
      // Send feedback to client or save the response
      if (whiteboardService) {
        console.log('[CoachSession] ✅ Sending exercise_response to learners');
        whiteboardService.send('exercise_response', {
          question: response.question,
          answer: response.answer,
          timestamp: Date.now()
        });
      }
    } else if (response.status === 'sent_to_learner') {
      // Send exercise to client when "Send to Client" is clicked
      if (whiteboardService) {
        console.log('[CoachSession] ✅ Sending exercise_update to learners:', response.question);
        whiteboardService.send('exercise_update', {
          question: response.question,
          answer: '',
          timestamp: Date.now()
        });
      }
    }
  };

  const handleExerciseDelete = () => {
    // console.log('[CoachSession] Exercise deleted');
    setShowExercise(false);
    setExerciseData({
      question: '',
      answer: ''
    });

    // Notify client that exercise has been closed
    if (whiteboardService) {
      whiteboardService.send('exercise_closed', {
        message: 'Exercise has been closed by coach',
        timestamp: Date.now()
      });
    }
  };

  // ========================================
  // HANDLER FUNCTIONS FOR NEW FEATURES (Memoized for Performance)
  // ========================================

  // Session Notes Handlers
  const handleNotesChange = useCallback((newNotes) => {
    setSessionNotes(newNotes);
    // Use shared auto-save utility
    autoSaveSessionNotes(sessionId, newNotes, autoSaveTimerRef, sessionNotesService);
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
          // When music ends, it will loop automatically (loop attribute set)
        }}
      />

      {/* Navigation / Header - Auto-hide after 5s on mobile/tablet */}
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
              onClick={() =>
                window.open('/coach/dashboard', '_blank', 'noopener,noreferrer')
              }
            >
              🏠 Dashboard
            </button>

          </div>
        </div>
      </div>

      {/* Info bar - Auto-hide after 5 seconds */}
      {showInfoBar && (
        <div className="session-info-banner">
          <span className="session-info-text"><strong>ℹ️ Session Active:</strong> All interactions are being recorded. Audio prompts via mic will be converted to text for prompter (not audible to client).</span>
          <button
            onClick={() => setShowInfoBar(false)}
            className="text-gray-600 hover:text-gray-800 font-bold text-lg ml-2 sm:ml-4"
            title="Close"
          >
            ×
          </button>
        </div>
      )}


      {/* Main layout - Desktop: 3 columns, Tablet/Mobile: 70% center + 30% right stacked */}
      <div className="session-main-layout" style={{ minHeight: 'calc(100vh - 6.25rem)' }}>
        {/* Desktop Only: Left Sidebar - Learning Program */}
        <div className="session-left-sidebar">
          {/* Fixed Video Feed - Above Learning Program */}
          {remoteStream && (
            <div style={{
              width: '100%',
              height: 'clamp(120px, 20vh, 180px)',
              backgroundColor: '#000',
              borderRadius: '8px',
              border: '2px solid #374151',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              margin: '8px 0',
              flexShrink: 0
            }}>
              {/* Video Label */}
              <div style={{
                padding: '6px 10px',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 'bold',
                borderBottom: '1px solid #555'
              }}>
                👨‍💼 Client {connectionStatus && `(${connectionStatus})`}
              </div>

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
          <LearningProgramSidebar
            sessionInfo={sessionInfo}
            filteredLearningGoals={filteredLearningGoals}
            selectedPromptLevel={selectedPromptLevel}
            setSelectedPromptLevel={setSelectedPromptLevel}
            selectedReinforcementLevel={selectedReinforcementLevel}
            setSelectedReinforcementLevel={setSelectedReinforcementLevel}
            webRTC={webRTC}
            toggleListening={toggleListening}
            listening={listening}
            transcript={transcript}
            whiteboardService={whiteboardService}
            learningGoalsSearch={learningGoalsSearch}
            setLearningGoalsSearch={setLearningGoalsSearch}
          />
        </div>

        {/* Center Area - 70% on mobile/tablet, flexible on desktop */}
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
                toolAccess={clientToolAccess}
                remoteSelectedItemIds={remoteSelectedItemIds}
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
                bucketColor={bucketColor}
                setBucketColor={setBucketColor}
                clearCanvasTrigger={clearCanvasTrigger}
                erasePenTrigger={erasePenTrigger}
                redrawCanvasTrigger={redrawCanvasTrigger}
                stopwatchFormattedTime={stopwatch.isRunning ? stopwatch.formattedTime : null}
                stopwatchIsRunning={stopwatch.isRunning}
                toolActive={toolActive}
                onYoutubeDropped={handleYoutubeDropped}
                canvasRefForParent={whiteboardCanvasRef}
              />
            </div>
          </div>

          {/* YouTube Popups - Rendered outside whiteboard container to avoid stacking context issues */}
          {youtubePopups.map(popup => (
            <YouTubePopup
              key={popup.id}
              popupId={popup.id}
              videoId={popup.videoId}
              title={popup.title}
              onClose={() => handleCloseYoutubePopup(popup.id)}
              initialPosition={popup.position}
              isTrainer={true}
            />
          ))}

          {/* Exercise Tool */}
          {showExercise && (
            <div className="exercise-tool-container" style={{ marginTop: '20px', padding: '0 10px', position: 'relative' }}>
              <Exercise
                isTrainer={true}
                attendeeLabel="Guest/Client"
                onExerciseSubmit={handleExerciseSubmit}
                onExerciseUpdate={handleExerciseUpdate}
                onExerciseDelete={handleExerciseDelete}
                onAnswerChange={handleExerciseAnswerChange}
                whiteboardService={whiteboardService}
                initialExercise={exerciseData.question ? exerciseData : null}
              />
            </div>
          )}

          {/* Video Controls - Below Whiteboard */}
          <div className="w-full mt-4 mb-3">
            <div className="flex items-center justify-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
              <button
                onClick={handleToggleMic}
                className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{ padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}
                title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
              >
                <span>{micEnabled ? '🎤' : '🔇'}</span>
                {/* <span>{micEnabled ? 'Mic On' : 'Mic Off'}</span> */}
              </button>
              <button
                onClick={handleToggleCamera}
                className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{ padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}
                title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                <span>{cameraEnabled ? '📹' : '📷'}</span>
                {/* <span>{cameraEnabled ? 'Camera On' : 'Camera Off'}</span> */}
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
            musicOptions={musicOptions}
            toggleBackgroundMusic={toggleBackgroundMusic}
            selectedMusic={selectedMusic}
            backgroundMusicPlaying={backgroundMusicPlaying}
            musicVolume={musicVolume}
            handleMusicVolumeChange={handleMusicVolumeChange}
            showSessionNotes={true}
            sessionNotes={sessionNotes}
            handleNotesChange={handleNotesChange}
            handleClearNotes={handleClearNotes}
          />
        </div>

        {/* Right Column - 30% on mobile/tablet (Learning Content + Learning Program) */}
        <div className="session-right-column">
          {/* Learning Content - 25% height */}
          <div className=" learning-content-container ">
            <div className="section-content">
              <span className='bg-[#7a2c2c] text-white px-2 py-3 bold rounded'>📚 Learning Content</span>
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



          {/* Learning Program - 25% height - Tablet/Mobile */}
          <div className="learning-program-container">

            <div className="section-content">
              <LearningProgramSidebar
                sessionInfo={sessionInfo}
                filteredLearningGoals={filteredLearningGoals}
                selectedPromptLevel={selectedPromptLevel}
                setSelectedPromptLevel={setSelectedPromptLevel}
                selectedReinforcementLevel={selectedReinforcementLevel}
                setSelectedReinforcementLevel={setSelectedReinforcementLevel}
                webRTC={webRTC}
                toggleListening={toggleListening}
                listening={listening}
                transcript={transcript}
                whiteboardService={whiteboardService}
                learningGoalsSearch={learningGoalsSearch}
                setLearningGoalsSearch={setLearningGoalsSearch}
              />
            </div>
          </div>
        </div>
      </div>
      {/* Session Info Bar - fixed to bottom with no surrounding margin */}
      <div className="session-info-bar session-control-buttons" style={{ justifyContent: 'center' }}>
        <div className="session-info-actions">
          <button
            className={isFrozen ? "btn-freeze-session active" : "btn-freeze-session"}
            onClick={handleFreeze}
            title={isFrozen ? "Unfreeze Client Window" : "Freeze Client Window"}
          >
            {isFrozen ? '🔓' : '🔒'} <span className="xs:inline">{isFrozen ? 'Unfreeze' : 'Freeze'}</span>
          </button>
          <button
            className="btn-end-session"
            onClick={handleEndSession}
            title="End Session"
          >
            ⏹️ <span className="xs:inline">End</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachSession;
