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
import sessionNotesService from '../../api/services/sessionNotesService';
import learningContentService from '../../api/services/learningContentService';
import sessionReportService from '../../api/services/sessionReportService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Whiteboard from '../../components/common/Whiteboard';
import MessageList from '../../components/common/MessageList';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import YouTubePopup from '../../components/common/YouTubePopup';
import useMessages from '../../hooks/useMessages';
import useVoiceInput from '../../hooks/useVoiceInput';
import useStopwatch from '../../hooks/useStopwatch';
import { useMediaControl } from '../../context/MediaControlContext';
import TrainerVideoConference from '../../components/videoConference/TrainerVideoConference';
import MoveableVideoFeed from '../../components/videoConference/MoveableVideoFeed';
import WhiteboardSection from './WhiteboardSection';
import VideoSection from './VideoSection';
import LearningProgramSidebar from './LearningProgramSidebar';
import LearningContentSidebar from './LearningContentSidebar';
import { FaMicrophone, FaBars, FaTimes } from 'react-icons/fa';
// Fill blanks exercise removed
import Emoji from '../../components/common/Emoji';
import Exercise from '../../components/session/Exercise';
import RecordingControls from '../../components/session/RecordingControls';
import JanusRecordingService from '../../api/services/janusService';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { markSessionActive, clearSessionActivity, updateSessionActivity } from '../../utils/sessionActivityTracker';
import '../../styles/session.css';


const REACTION_SVG_ASSETS = {
  smiley: {
    type: 'svg',
    src: '/reactions/realistic-pastel-smile.svg',
    alt: 'Realistic Pastel Smile'
  },
  bubble: {
    type: 'svg',
    src: '/reactions/realistic-bubble.svg',
    alt: 'Realistic Soap Bubble'
  },
  balloon: [
    {
      type: 'svg',
      src: '/reactions/02_pastel_mint.svg',
      alt: 'Realistic Pink Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/03_pastel_pink.svg',
      alt: 'Realistic Red Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/04_pastel_lavender.svg',
      alt: 'Realistic Blue Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/05_pastel_peach.svg',
      alt: 'Realistic Green Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/06_pastel_coral.svg',
      alt: 'Realistic Yellow Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/07_pastel_teal.svg',
      alt: 'Realistic Purple Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/08_pastel_yellow.svg',
      alt: 'Realistic Orange Balloon'
    }
  ],
  star: {
    type: 'svg',
    src: '/reactions/realistic-oil-pastel-star.svg',
    alt: 'Realistic Oil Pastel Star'
  }
};


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

  // Auto-hide navbar hook
  const { navbarClassName, pageClassName } = useAutoHideNavbar();

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
  const [recordingService, setRecordingService] = useState(null);
  const isInitializingRef = useRef(false); // Prevent duplicate initialization

  // -----------------------------------------------------------
  // 🔹 Purpose: Media streams for video conferencing
  // 🔸 How it works: localStream is trainer's camera/mic, remoteStream is learner's
  // -----------------------------------------------------------
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const remoteVideoRef = useRef(null); // Ref for remote video element
  const learnerConnectedRef = useRef(false); // Track if learner has connected

  // Video position and size for moveable video feed
  const [videoPosition, setVideoPosition] = useState({ x: 20, y: 20 });
  const [videoSize, setVideoSize] = useState({ width: 320, height: 240 });

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
  const [textMessages, setTextMessages] = useState([]); // For text messages displayed on whiteboard
  const [sessionNotes, setSessionNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState(''); // For feedback messages displayed on whiteboard
  const [waitingMessage, setWaitingMessage] = useState(''); // For waiting message displayed on whiteboard
  const [floatingAnimations, setFloatingAnimations] = useState([]); // For floating bubbles, smileys, balloons, stars

  // -----------------------------------------------------------
  // 🔹 Purpose: Load session notes from backend on mount
  // 🔸 How it works: fetches existing notes if session exists, handles errors gracefully
  // -----------------------------------------------------------
  useEffect(() => {
    const loadSessionNotes = async () => {
      if (!sessionId) return;
      try {
        console.log('[TrainerSession] Loading session notes for sessionId:', sessionId);
        const notesData = await sessionNotesService.getNotes(sessionId);
        if (notesData && notesData.notes) {
          console.log('[TrainerSession] ✅ Session notes loaded, version:', notesData.version);
          setSessionNotes(notesData.notes);
        } else {
          console.log('[TrainerSession] ℹ️ No existing session notes found, starting fresh');
          setSessionNotes('');
        }
      } catch (error) {
        console.warn('[TrainerSession] ⚠️ Could not load session notes (may not exist yet):', error.message);
        // Don't show error toast - this is expected if notes haven't been created yet
        setSessionNotes('');
      }
    };

    // Small delay to ensure sessionId is available
    const timer = setTimeout(loadSessionNotes, 500);
    return () => clearTimeout(timer);
  }, [sessionId]);

  // Debug: Log when feedbackMessage changes
  useEffect(() => {
    console.log('[TrainerSession] feedbackMessage state changed to:', feedbackMessage);
  }, [feedbackMessage]);

  const [additionalContentSearch, setAdditionalContentSearch] = useState('');
  const [additionalContentResults, setAdditionalContentResults] = useState([]);
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

  // -----------------------------------------------------------
  // 🔹 Purpose: Background music player state
  // 🔸 How it works: trainer can play/stop background music that syncs to learner
  // -----------------------------------------------------------
  const [backgroundMusicPlaying, setBackgroundMusicPlaying] = useState(false); // Is music playing
  const [selectedMusic, setSelectedMusic] = useState(null); // Currently selected music (0, 1, or 2)
  const [musicVolume, setMusicVolume] = useState(0.5); // Music volume (0 to 1)
  const audioRef = useRef(null); // Reference to audio element

  // Music options - you can add URLs to your music files here
  const musicOptions = [
    { id: 0, name: '🎵 Music 1', url: '/music/background-music-1.mp3' },
    { id: 1, name: '🎶 Music 2', url: '/music/background-music-1.mp3' },
    { id: 2, name: '🎼 Music 3', url: '/music/background-music-1.mp3' }
  ];

  // Hamburger menu state for responsive sidebars
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  // Keep simple active toggles for Timers and Emojis.
  // These no longer trigger business logic (timer/stopwatch/emoji overlay/shuffle/clear).
  const [activeIcons, setActiveIcons] = useState({});
  const [showInfoBar, setShowInfoBar] = useState(true);

  // -----------------------------------------------------------
  // 🔹 Purpose: Freeze mode state
  // 🔸 How it works: tracks whether learner window is frozen
  // -----------------------------------------------------------
  const [isFrozen, setIsFrozen] = useState(false);
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
  // Unified whiteboard button styles (white background, black text)
  const wbBtnBase = 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center';
  const wbBtnActive = 'bg-white border-2 border-[#DB9D32] text-black shadow-lg rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center';
  const wbSmallBtnBase = 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1';
  const wbSmallBtnActive = 'bg-white border-2 border-[#DB9D32] text-black shadow-lg rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1';
  const [buckets, setBuckets] = useState([]);
  const [bucketColor, setBucketColor] = useState('#FF6B6B'); // Default bucket color
  const bucketColors = [
    { name: 'Red', hex: '#FF6B6B' },
    { name: 'Teal', hex: '#4ECDC4' },
    { name: 'Yellow', hex: '#FFE66D' },
    { name: 'Mint', hex: '#95E1D3' }
  ];

  // -----------------------------------------------------------
  // 🔹 Purpose: YouTube popup state
  // 🔸 How it works: tracks open YouTube videos dragged to whiteboard
  // -----------------------------------------------------------
  const [youtubePopups, setYoutubePopups] = useState([]); // Array of { id, videoId, title, position }
  const [toolActive, setToolActive] = useState(false); // Track if drawing tool is active
  const [eraserActive, setEraserActive] = useState(false); // Track if eraser tool is active
  const [eraseAllActive, setEraseAllActive] = useState(false); // Track if erase all tool is active

  // -----------------------------------------------------------
  // 🔹 Purpose: Tool access control for learner (trainer can grant/revoke permissions)
  // 🔸 How it works: trainer controls which tools learner can use via toggle switches
  // -----------------------------------------------------------
  const [learnerToolAccess, setLearnerToolAccess] = useState({
    select: false,    // Can select items on canvas
    drag: false       // Can drag items on canvas
  });

  // Fill in the blanks feature removed

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

  const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]); // Track remote user's selections

  // -----------------------------------------------------------
  // 🔹 Purpose: Exercise tool state
  // 🔸 How it works: manages exercise creation, display, and learner responses
  // -----------------------------------------------------------
  const [showExercise, setShowExercise] = useState(false);
  const [exerciseData, setExerciseData] = useState({
    question: ''
  });

  // -----------------------------------------------------------
  // 🔹 Purpose: refs to manage timers and stopwatches on the whiteboard
  // 🔸 How it works: Map-like refs store interval IDs and metadata to pause/resume/clear.
  // -----------------------------------------------------------
  const timersRef = useRef(new Map());
  const stopwatchesRef = useRef(new Map());

  // -----------------------------------------------------------
  // 🔹 Purpose: Callback for when trainer mutes microphone (auto-send prompt)
  // 🔸 How it works: sends the transcript to learner when mute is triggered
  // -----------------------------------------------------------
  const handleMuteMicCallback = (transcriptText) => {
    try {
      if (transcriptText && transcriptText.trim() && whiteboardService) {
        whiteboardService.send('prompt_update', {
          text: transcriptText.trim(),
          timestamp: Date.now()
        });

      }
    } catch (error) {
      console.error('[TrainerSession] Error in handleMuteMicCallback:', error);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Voice input state via reusable hook
  // 🔸 How it works: uses `useVoiceInput` to handle speech recognition lifecycle
  // -----------------------------------------------------------
  const { listening, transcript, toggleListening: handleVoiceToggle, transcriptRef } = useVoiceInput({
    lang: 'en-IN',
    onMuteMic: handleMuteMicCallback
  });

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle voice input with automatic transcript sending to learner
  // 🔸 How it works: handles voice input toggle and coordinates with video conferencing mic
  // -----------------------------------------------------------
  const toggleListening = async () => {
    try {
      // If turning ON voice input and video conferencing mic is currently ON, turn it OFF
      if (!listening && micEnabled && webRTC) {
        console.log('[TrainerSession] Turning ON voice input, turning OFF video mic');
        webRTC.toggleMicrophone();
        setMicEnabled(false);
        toast.info('Video conferencing mic disabled - Voice input enabled');
      }

      // Toggle voice input using the new hook
      // The hook will auto-send via the onMuteMic callback when mic is muted
      await handleVoiceToggle();

      // If turning OFF voice input and video conferencing mic is currently OFF, turn it ON
      // Note: 'listening' is the OLD state before toggle, so we check if it WAS true (now turning OFF)
      if (listening && !micEnabled && webRTC) {
        console.log('[TrainerSession] Turning OFF voice input, turning ON video mic');
        webRTC.toggleMicrophone();
        setMicEnabled(true);
        toast.info('Voice input disabled - Video conferencing mic enabled');
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

    // 🔹 Purpose: Cleanup when the component unmounts - save notes before leaving
    // 🔸 How it works: clears auto-save timer, saves final notes, then calls cleanup()
    return () => {
      console.log('[TrainerSession] Component unmounting, saving notes and cleaning up');

      // Clear auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Save notes before unmounting (use navigator.sendBeacon for reliability)
      if (sessionNotes && sessionNotes.trim()) {
        const token = localStorage.getItem('access_token');
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const data = JSON.stringify({ notes: sessionNotes });

        // Use sendBeacon for reliable sending even when page is closing
        if (navigator.sendBeacon) {
          const blob = new Blob([data], { type: 'application/json' });
          navigator.sendBeacon(`${API_URL}/session-notes/${sessionId}`, blob);
        }
      }

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
  // Also updates session activity to track ongoing sessions
  // -----------------------------------------------------------
  useEffect(() => {
    if (!sessionInfo || sessionInfo.status !== 'active') return;

    const checkInterval = setInterval(async () => {
      try {
        // Update session activity to mark session as still active
        updateSessionActivity(sessionId, 'trainer');

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
      console.log('[TrainerSession] Remote user selected items:', data);
      if (data.itemIds && Array.isArray(data.itemIds)) {
        setRemoteSelectedItemIds(data.itemIds);
      }
    };

    // Set up callback for animation pop events from learner
    whiteboardService.onAnimationPopped = (data) => {
      console.log('[TrainerSession] Animation popped by learner:', data);
      handleAnimationPop(data.animationId, data.poppedLeft, data.poppedTop);
    };

    // Set up callback for exercise answer updates from learner
    whiteboardService.onExerciseAnswerUpdate = (data) => {
      console.log('[TrainerSession] 📝 Learner answer updated:', data);
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
          learnerAnswer: data.learnerAnswer
        }));
      }
    };

    // Set up callback for exercise submission from learner
    whiteboardService.onExerciseResponse = (data) => {
      console.log('[TrainerSession] 📋 Learner submitted exercise:', data);
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
          learnerAnswer: data.learnerAnswer
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

      // 🔹 Purpose: Check if session is already active on another device/tab
      // 🔸 How it works: uses sessionActivityTracker to prevent multiple access
      const sessionCheck = markSessionActive(sessionId, 'trainer');
      if (!sessionCheck.success) {
        // Only show alert once (prevent duplicate toasts in StrictMode)
        if (!restrictionAlertShownRef.current) {
          restrictionAlertShownRef.current = true;
          console.warn('[TrainerSession] Session already active:', sessionCheck.message);
          toast.error(sessionCheck.message);
          navigate('/trainer/dashboard');
        }
        return;
      }

      console.log('[TrainerSession] Authorization successful, initializing WebRTC');
      await initializeWebRTC(session.id);
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
  const initializeWebRTC = async (numericSessionId) => {
    // Prevent duplicate initialization
    if (isInitializingRef.current) {
      console.log('[TrainerSession] Already initializing, skipping duplicate call');
      return;
    }
    isInitializingRef.current = true;

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

    // Initialize Video Conference Service
    const videoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'trainer');

    try {
      console.log('[TrainerSession] Initializing Video Conference service');

      // Set callback for local stream (trainer's camera/mic)
      videoService.onLocalStream = (stream) => {
        console.log('[TrainerSession] Local stream received');
        setLocalStream(stream);
      };

      // Set callback for remote stream (learner's video)
      videoService.onRemoteStream = (stream) => {
        console.log('[TrainerSession] Remote stream received from learner');
        setRemoteStream(stream);

        // Only show toast once when learner first connects
        if (!learnerConnectedRef.current) {
          learnerConnectedRef.current = true;
          toast.success(`${sessionInfo?.learner_name || 'Learner'} has joined the session`);
        }
      };

      // Set callback for connection state changes
      videoService.onConnectionStateChange = (state) => {
        console.log('[TrainerSession] Connection state:', state);
        const statusMap = {
          'new': 'connecting',
          'connecting': 'connecting',
          'connected': 'connected',
          'disconnected': 'disconnected',
          'failed': 'failed',
          'closed': 'disconnected'
        };
        setConnectionStatus(statusMap[state] || state);

        // Handle learner disconnect
        if ((state === 'disconnected' || state === 'closed') && learnerConnectedRef.current) {
          console.log('[TrainerSession] Learner disconnected');
          toast.info(`${sessionInfo?.learner_name || 'Learner'} has left the session`);
          setRemoteStream(null);
          learnerConnectedRef.current = false;
        }
      };

      // Set error callback
      videoService.onError = (error) => {
        console.error('[TrainerSession] Video conference error:', error);
        toast.error(`Video error: ${error.message}`);
      };

      // Initialize video conference (gets local media and sets up connection)
      await videoService.initialize();
      setWebRTC(videoService);

      // Initialize recording service with numeric database ID
      console.log('[TrainerSession] Initializing recording service with numeric session ID:', numericSessionId);
      const recService = new JanusRecordingService(videoService, numericSessionId);
      setRecordingService(recService);

      // Update media control states
      setMicEnabled(videoService.isMicrophoneEnabled());
      setCameraEnabled(videoService.isCameraEnabled());

      console.log('[TrainerSession] Video Conference service initialized');
      console.log('[TrainerSession] Recording service initialized');
    } catch (error) {
      console.error('[TrainerSession] Video Conference init error:', error);
      toast.error('Failed to initialize video conference');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle microphone on/off
  // 🔸 How it works: calls webRTC.toggleMicrophone() and updates state, coordinates with voice input
  // -----------------------------------------------------------
  const handleToggleMic = async () => {
    if (webRTC) {
      const newState = webRTC.toggleMicrophone();
      setMicEnabled(newState);

      // If turning ON video conferencing mic and voice input is ON, turn OFF voice input
      if (newState && listening) {
        console.log('[TrainerSession] Turning ON video mic, turning OFF voice input');
        await handleVoiceToggle(); // Stop voice input
        toast.info('Voice input stopped - video conferencing mic enabled');
      }
      // If turning OFF video conferencing mic, don't auto-enable voice input
      // User should manually enable voice input if they want it
      else if (!newState && !listening) {
        console.log('[TrainerSession] Video mic turned OFF');
        toast.info('Video conferencing mic disabled');
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
  // 🔸 How it works: saves notes, calls sessionService.endSession, cleans up local resources, and navigates away
  // -----------------------------------------------------------
  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end this session?')) {
      try {
        // Broadcast session end to learner before ending
        if (whiteboardService) {
          whiteboardService.send('session_ended', {
            message: 'Trainer has ended the session',
            timestamp: Date.now()
          });
        }

        // Save notes before ending session
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }

        // Final save of notes
        if (sessionNotes && sessionNotes.trim()) {
          try {
            await sessionNotesService.saveNotes(sessionId, sessionNotes);
            console.log('[TrainerSession] Session notes saved before ending');
          } catch (error) {
            console.error('[TrainerSession] Error saving notes before ending:', error);
          }
        }

        await sessionService.endSession(sessionId, sessionNotes || '');
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
  // 🔹 Purpose: Toggle freeze mode for learner window
  // 🔸 How it works: sends freeze/unfreeze signal via WebRTC to learner
  // -----------------------------------------------------------
  const handleFreeze = () => {
    const newFreezeState = !isFrozen;
    setIsFrozen(newFreezeState);

    if (webRTC) {
      const freezeSignal = {
        type: 'freeze',
        frozen: newFreezeState,
        timestamp: new Date().toISOString()
      };
      webRTC.sendSignal(freezeSignal);
      console.log('[TrainerSession] Freeze signal sent:', freezeSignal);
      // toast.info(newFreezeState ? 'Learner window frozen' : 'Learner window unfrozen');
    } else {
      console.error('[TrainerSession] Cannot send freeze signal - WebRTC not initialized');
      toast.error('Unable to send freeze signal');
      setIsFrozen(!newFreezeState); // Revert state
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Exercise tool handlers
  // 🔸 How it works: manages exercise creation, updates, and learner responses
  // -----------------------------------------------------------
  const handleExerciseUpdate = (exerciseInfo) => {
    console.log('[TrainerSession] Exercise updated:', exerciseInfo);
    setExerciseData(exerciseInfo);

    // Send exercise to learner via whiteboard service
    if (whiteboardService) {
      whiteboardService.send('exercise_update', {
        qaItems: exerciseInfo.qaItems,
        question: exerciseInfo.question, // Keep for backward compatibility
        timestamp: Date.now()
      });
    }
  };

  const handleExerciseAnswerChange = (answerData) => {
    console.log('[TrainerSession] Learner answer updated:', answerData);
    // Trainer only displays answer updates received via WebSocket
    // Do not broadcast back - prevents feedback loops
  };

  const handleExerciseSubmit = (response) => {
    console.log('[TrainerSession] Exercise response received:', response);

    // Handle learner's answer submission
    if (response.status === 'submitted') {
      // Send feedback to learner or save the response
      if (whiteboardService) {
        whiteboardService.send('exercise_response', {
          qaItems: response.qaItems,
          learnerAnswer: response.learnerAnswer,
          timestamp: Date.now()
        });
      }
    } else if (response.status === 'sent_to_learner') {
      // Send exercise to learner when "Send to Learner" is clicked
      if (whiteboardService) {
        whiteboardService.send('exercise_update', {
          qaItems: response.qaItems,
          timestamp: Date.now()
        });
      }
    }
  };

  const handleExerciseDelete = () => {
    console.log('[TrainerSession] Exercise deleted');
    setShowExercise(false);
    setExerciseData({
      question: ''
    });

    // Notify learner that exercise has been closed
    if (whiteboardService) {
      whiteboardService.send('exercise_closed', {
        message: 'Exercise has been closed by trainer',
        timestamp: Date.now()
      });
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

    // Reset initialization flag to allow re-initialization
    isInitializingRef.current = false;
    if (whiteboardService) {
      whiteboardService.close();
    }
    if (toolsService) {
      toolsService.cleanup();
    }
    if (recordingService) {
      recordingService.destroy();
      console.log('[TrainerSession] Recording service cleaned up');
    }

    // clear timers and stopwatches intervals
    timersRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    timersRef.current.clear();
    stopwatchesRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    stopwatchesRef.current.clear();

    // Clear session activity tracking
    clearSessionActivity(sessionId, 'trainer');
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Drag start handler for content cards (drag to whiteboard)
  // 🔸 How it works: sets a JSON payload into dataTransfer so drop target can parse it
  // -----------------------------------------------------------
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

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle YouTube content dropped on whiteboard
  // 🔸 How it works: Creates a new YouTube popup entry with position and syncs to learner
  // -----------------------------------------------------------
  const handleYoutubeDropped = (videoData) => {
    const newPopup = {
      id: Date.now(),
      videoId: videoData.videoId,
      title: videoData.title,
      position: videoData.position,
    };

    console.log('[TrainerSession] YouTube popup created:', newPopup);
    setYoutubePopups(prev => [...prev, newPopup]);

    // Broadcast to learner via whiteboard service
    if (whiteboardService && typeof whiteboardService.send === 'function') {
      whiteboardService.send('youtube_popup_created', {
        popupId: newPopup.id,
        videoId: newPopup.videoId,
        title: newPopup.title,
        position: newPopup.position,
        timestamp: Date.now()
      });
      console.log('[TrainerSession] YouTube popup sync sent to learner');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Close a YouTube popup and sync to learner
  // 🔸 How it works: Removes popup from state array and broadcasts closure
  // -----------------------------------------------------------
  const handleCloseYoutubePopup = (popupId) => {
    setYoutubePopups(prev => prev.filter(popup => popup.id !== popupId));

    // Broadcast closure to learner via whiteboard service
    if (whiteboardService && typeof whiteboardService.send === 'function') {
      whiteboardService.send('youtube_popup_closed', {
        popupId: popupId,
        timestamp: Date.now()
      });
      console.log('[TrainerSession] YouTube popup closed, sync sent to learner');
    }
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
  // 🔹 Purpose: Update session notes (trainer's notes) with auto-save
  // 🔸 How it works: updates local state and auto-saves to backend with debouncing
  // -----------------------------------------------------------
  const autoSaveTimerRef = useRef(null);
  const restrictionAlertShownRef = useRef(false); // Prevent duplicate toast alerts

  const handleNotesChange = (e) => {
    const newNotes = e.target.value;
    setSessionNotes(newNotes);

    // Clear existing auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer (save after 2 seconds of no typing)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        console.log('[TrainerSession] 💾 Auto-saving session notes...');
        await sessionNotesService.saveNotes(sessionId, newNotes);
        console.log('[TrainerSession] ✅ Session notes auto-saved successfully');
      } catch (error) {
        console.error('[TrainerSession] ❌ Error auto-saving notes:', error);
        // Don't show toast for auto-save errors to avoid interrupting user
      }
    }, 2000);
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Clear session notes
  // 🔸 How it works: clears local state and sends empty notes to backend
  // -----------------------------------------------------------
  const handleClearNotes = async () => {
    try {
      console.log('[TrainerSession] Clearing session notes');
      setSessionNotes('');
      // Clear the auto-save timer if one is pending
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      // Immediately save the clear action to backend
      await sessionNotesService.clearNotes(sessionId);
      console.log('[TrainerSession] ✅ Session notes cleared successfully');
      toast.info('Session notes cleared');
    } catch (error) {
      console.error('[TrainerSession] ❌ Error clearing notes:', error);
      toast.error('Failed to clear notes');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Force save notes on disconnect/reconnect
  // 🔸 How it works: immediately saves current notes bypassing debounce
  // Used for disconnect recovery when connection is restored
  // -----------------------------------------------------------
  const handleForceSaveNotes = async () => {
    try {
      console.log('[TrainerSession] Force-saving notes (disconnect recovery)');
      await sessionNotesService.forceSaveNotes(sessionId, sessionNotes);
      console.log('[TrainerSession] ✅ Notes force-saved successfully');
      toast.info('Notes recovered and saved');
    } catch (error) {
      console.error('[TrainerSession] ❌ Error force-saving notes:', error);
      toast.error('Failed to recover notes');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Add disconnect handler to force-save notes if connection is lost
  // 🔸 How it works: listens for beforeunload and pagehide events to save notes
  // -----------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (sessionNotes && sessionNotes.trim()) {
        // Try to force-save notes before unload
        handleForceSaveNotes();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [sessionId, sessionNotes]);

  // -----------------------------------------------------------

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
  const filteredLearningGoals = sessionInfo?.learning_goals || [];

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
  // 🔹 Purpose: Toggle learner tool access (Select, Drag)
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
  // 🔹 Purpose: Play/stop background music
  // 🔸 How it works: Trainer can select and play music that syncs to learner session
  // -----------------------------------------------------------
  const toggleBackgroundMusic = (musicId) => {
    // If clicking the same music, toggle play/stop
    if (selectedMusic === musicId && backgroundMusicPlaying) {
      // Stop music
      setBackgroundMusicPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Notify learner to stop music
      if (whiteboardService) {
        whiteboardService.send('background_music', {
          playing: false,
          musicId: null,
          volume: musicVolume,
          timestamp: Date.now()
        });
      }
    } else {
      // Start music with selected track
      setSelectedMusic(musicId);
      setBackgroundMusicPlaying(true);

      if (audioRef.current) {
        audioRef.current.src = musicOptions[musicId].url;
        audioRef.current.loop = true; // Loop the music
        audioRef.current.volume = musicVolume; // Set volume from state
        audioRef.current.play().catch(err => console.log('Audio play error:', err));
      }

      // Notify learner to play the same music
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
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Update music volume
  // 🔸 How it works: Changes volume for both trainer and learner
  // -----------------------------------------------------------
  const handleMusicVolumeChange = (newVolume) => {
    setMusicVolume(newVolume);

    // Update volume in current audio player
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }

    // Notify learner of volume change
    if (whiteboardService && backgroundMusicPlaying) {
      whiteboardService.send('background_music_volume', {
        volume: newVolume,
        timestamp: Date.now()
      });
    }
  };

  // Fill-in-blanks sending removed

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
      color: bucketColor, // Use selected bucket color
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
  const generateSpacedPositions = (count, minPercent = 5, maxPercent = 95) => {
    if (count <= 1) return [50];
    const range = maxPercent - minPercent;
    const step = range / (count - 1);
    return Array.from({ length: count }, (_, index) => {
      const base = minPercent + step * index;
      const maxJitter = step * 0.35;
      const jitter = (Math.random() - 0.5) * maxJitter;
      return Math.min(maxPercent, Math.max(minPercent, base + jitter));
    });
  };

  const spawnFloatingAnimation = (type, asset) => {
    const count = 8; // 8 items
    const baseId = Date.now() + Math.random(); // Unique ID to allow multiple animations of same type
    const positions = generateSpacedPositions(count);
    const newAnimations = positions.map((position, i) => {
      // For balloons, randomly select from the color array
      const selectedAsset = Array.isArray(asset)
        ? asset[Math.floor(Math.random() * asset.length)]
        : asset;

      return {
        id: `${baseId}-${type}-${i}-${Math.random()}`,
        type,
        asset: selectedAsset ? { ...selectedAsset } : null,
        x: position,
        startDelay: Math.random() * 1000, // 0-1s staggered start
        duration: 8000 + Math.random() * 4000, // 8-12s to float up
        popped: false
      };
    });

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
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      case '🫧 Bubbles': {
        console.log('[TrainerSession] Spawning bubble animation');
        spawnFloatingAnimation('bubble', REACTION_SVG_ASSETS.bubble);
        return;
      }

      case '😊 Smileys': {
        console.log('[TrainerSession] Spawning smileys animation');
        spawnFloatingAnimation('smiley', REACTION_SVG_ASSETS.smiley);
        return;
      }

      case '🎈 Balloons': {
        console.log('[TrainerSession] Spawning balloons animation');
        spawnFloatingAnimation('balloon', REACTION_SVG_ASSETS.balloon);
        return;
      }

      case '⭐ Stars': {
        console.log('[TrainerSession] Spawning stars animation');
        spawnFloatingAnimation('star', REACTION_SVG_ASSETS.star);
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

      // ---------------------- EXERCISE TOOL ----------------------
      case '💡 Exercise': {
        console.log('[TrainerSession] Exercise tool clicked');
        setShowExercise(true);
        return;
      }

      // ---------------------- FILL IN THE BLANKS ----------------------
      // Fill Blanks removed

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
              className="btn-secondary"
              style={{ color: 'white' }}
              onClick={() =>
                window.open('/trainer/dashboard', '_blank', 'noopener,noreferrer')
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


      {/* Main layout - Desktop: 3 columns, Tablet/Mobile: 70% center + 30% right stacked */}
      <div className="session-main-layout" style={{ minHeight: 'calc(100vh - 6.25rem)' }}>
        {/* Desktop Only: Left Sidebar - Learning Program */}
        <div className="session-left-sidebar">
          <LearningProgramSidebar
            sessionInfo={sessionInfo}
            filteredLearningGoals={filteredLearningGoals}
            selectedPromptLevel={selectedPromptLevel}
            setSelectedPromptLevel={setSelectedPromptLevel}
            selectedReinforcementLevel={selectedReinforcementLevel}
            setSelectedReinforcementLevel={setSelectedReinforcementLevel}
            selectedProgramId={selectedProgramId}
            handleProgramCheck={handleProgramCheck}
            webRTC={webRTC}
            toggleListening={toggleListening}
            listening={listening}
            transcript={transcript}
            whiteboardService={whiteboardService}
            onSaveReport={handleSaveReport}
          />
        </div>

        {/* Center Area - 70% on mobile/tablet, flexible on desktop */}
        <div className="session-center-area">

          {/* Whiteboard */}
          <div className="session-whiteboard-container">
            {/* Moveable Video Feed Overlay */}
            {remoteStream && (
              <MoveableVideoFeed
                videoStream={remoteStream}
                label="Learner"
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

            {/* Whiteboard component - keep logic intact */}
            <div className="w-full h-full">
              <Whiteboard
                whiteboardService={whiteboardService}
                isTrainer={true}
                canvasItems={canvasItems}
                setCanvasItems={setCanvasItems}
                toolAccess={learnerToolAccess}
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
                bucketColor={bucketColor}
                setBucketColor={setBucketColor}
                clearCanvasTrigger={clearCanvasTrigger}
                erasePenTrigger={erasePenTrigger}
                redrawCanvasTrigger={redrawCanvasTrigger}
                stopwatchFormattedTime={stopwatch.isRunning ? stopwatch.formattedTime : null}
                stopwatchIsRunning={stopwatch.isRunning}
                toolActive={toolActive}
                onYoutubeDropped={handleYoutubeDropped}
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
              {/* <button
                onClick={() => setShowExercise(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '4rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  zIndex: 10
                }}
                title="Close Exercise Tool"
              >
                ✕ Close
              </button> */}
              <Exercise
                isTrainer={true}
                onExerciseSubmit={handleExerciseSubmit}
                onExerciseUpdate={handleExerciseUpdate}
                onExerciseDelete={handleExerciseDelete}
                initialExercise={Object.keys(exerciseData).some(key => exerciseData[key]) ? exerciseData : null}
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
              {/* {recordingService && sessionInfo && (
                <div className="flex items-center ml-3">
                  <RecordingControls
                    recordingService={recordingService}
                    sessionStatus={connectionStatus}
                    sessionId={sessionInfo.id}
                  />
                </div>
              )} */}
            </div>

          </div>
          {/* Whiteboard Drawing Tools - Beautiful Heading */}
          <div className="session-whiteboard-tools w-full flex flex-wrap items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
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
                className={`${tool === 'pen' && toolActive && !eraserActive ? wbBtnActive : wbBtnBase}`}
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
                className={`${eraserActive ? wbBtnActive : wbBtnBase}`}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Eraser Tool (Click to activate/deactivate)"
              >
                <span>🧽</span>
                <span className="hidden xs:inline">Eraser</span>
                {eraserActive}
              </button>
              <button
                onClick={() => {
                  // One-click: clear only pen strokes
                  eraseAllPen();
                }}
                className={wbBtnBase}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Erase All Pen Strokes"
              >
                <Emoji emoji="🗑️" size="base" />
                <span className="hidden sm:inline">Erase All</span>
              </button>
              {/* Clear Canvas Button */}
              <button
                onClick={() => {
                  console.log('[TrainerSession] 🗑️ Clear All button clicked!');
                  console.log('[TrainerSession] whiteboardService available:', !!whiteboardService);
                  setCanvasItems([]);
                  setBuckets([]);
                  setFloatingAnimations([]); // Clear all floating animations (bubbles, balloons, smileys, stars)
                  setClearCanvasTrigger(prev => prev + 1); // Trigger full canvas clear including pen strokes
                  if (whiteboardService) {
                    console.log('[TrainerSession] 📤 Sending clear_canvas message to learner...');
                    whiteboardService.send('clear_canvas', {
                      timestamp: Date.now()
                    });
                    console.log('[TrainerSession] ✅ clear_canvas message sent!');
                  } else {
                    console.error('[TrainerSession] ❌ ERROR: whiteboardService is NULL/UNDEFINED!');
                  }
                }}
                className={wbBtnBase}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Clear All Canvas Items and Pen Strokes"
              >
                <Emoji emoji="🗑️" size="base" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
              <button
                onClick={() => {
                  // Single-click: immediately add a new bucket
                  addBucket();
                }}
                className={wbBtnBase}
                style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                title="Add Bucket"
              >
                <Emoji emoji="🪣" size="base" />
                <span className="hidden xs:inline">Bucket</span>
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

              {/* Bucket Color Selector */}
              <div className="flex items-center flex-wrap" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
                <label className="font-semibold text-slate-700 hidden sm:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Bucket Color:</label>
                <div className="flex flex-wrap gap-1" style={{ gap: 'clamp(0.125rem, 0.3vw, 0.25rem)' }}>
                  {bucketColors.map((bc) => (
                    <button
                      key={bc.hex}
                      onClick={() => setBucketColor(bc.hex)}
                      className="rounded border-2 transition-all"
                      style={{
                        backgroundColor: bc.hex,
                        width: 'clamp(1.25rem, 3vw, 1.75rem)',
                        height: 'clamp(1.25rem, 3vw, 1.75rem)',
                        borderColor: bucketColor === bc.hex ? '#000000' : '#ccc',
                        borderWidth: bucketColor === bc.hex ? '3px' : '2px',
                        cursor: 'pointer'
                      }}
                      title={`Bucket Color: ${bc.name}`}
                    />
                  ))}
                </div>
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

            {/* All tools group - learner access + trainer interactive buttons */}
            <div className="all-tools-group w-full">
              {/* Learner Tool Access Controls */}
              <div className="session-tools-section w-full flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 pb-2 sm:pb-3">
                {/* Select Tool Toggle */}
                <button
                  onClick={() => toggleLearnerToolAccess('select')}
                  className={`${learnerToolAccess.select ? wbSmallBtnActive : wbSmallBtnBase}`}
                  title={learnerToolAccess.select ? 'Click to disable Select' : 'Click to enable Select'}
                >
                  <span>✋</span>
                  <span>Select</span>
                </button>

                {/* Drag Tool Toggle */}
                <button
                  onClick={() => toggleLearnerToolAccess('drag')}
                  className={`${learnerToolAccess.drag ? wbSmallBtnActive : wbSmallBtnBase}`}
                  title={learnerToolAccess.drag ? 'Click to disable Drag' : 'Click to enable Drag'}
                >
                  <span>↔️</span>
                  <span>Drag</span>
                </button>

                {/* Exercise Tool Button */}
                <button
                  onClick={() => setShowExercise(true)}
                  className={`${showExercise ? wbSmallBtnActive : wbSmallBtnBase}`}
                  title="Open Exercise Tool - Create Q&A exercises with keyword validation"
                >
                  <span>💡</span>
                  <span>Q & A</span>
                </button>

                {/* Background Music Control */}
                <div className="flex gap-1 flex-wrap items-center">
                  {musicOptions.map((music) => (
                    <button
                      key={music.id}
                      onClick={() => toggleBackgroundMusic(music.id)}
                      className={`${selectedMusic === music.id && backgroundMusicPlaying
                        ? wbSmallBtnActive
                        : wbSmallBtnBase
                        }`}
                      title={`${selectedMusic === music.id && backgroundMusicPlaying
                        ? `Playing ${music.name} - Click to stop`
                        : `Click to play ${music.name}`
                        }`}
                    >
                      <span>{music.name}</span>
                    </button>
                  ))}

                  {/* Volume Slider */}
                  {backgroundMusicPlaying && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-white border-2 border-gray-300 rounded-lg">
                      <span className="text-xs font-semibold text-gray-700">🔊</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={musicVolume * 100}
                        onChange={(e) => handleMusicVolumeChange(e.target.value / 100)}
                        className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        title={`Volume: ${Math.round(musicVolume * 100)}%`}
                      />
                      <span className="text-xs font-semibold text-gray-700">{Math.round(musicVolume * 100)}%</span>
                    </div>
                  )}
                </div>

                {/* Fill Blanks tool removed */}
                <button
                  onClick={() => setShowStopwatch(prev => !prev)}
                  className={`${showStopwatch ? wbSmallBtnActive : wbSmallBtnBase}`}
                  aria-expanded={showStopwatch}
                  aria-controls="stopwatch-panel"
                  title="Toggle stopwatch panel"
                >
                  <Emoji emoji="⏲️" size="base" />
                  <span className="hidden sm:inline">Stopwatch</span>
                </button>
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
                  // Use unified button theme for feedback/tool buttons
                  return (
                    <button
                      key={i}
                      onClick={() => handleToolClick(`${t.icon} ${t.label}`)}
                      className={`${activeIcons[t.label] ? wbBtnActive : wbBtnBase} px-1.5 sm:px-2 py-1.5 sm:py-2 rounded text-[9px] sm:text-[10px] text-center session-hover-transition transition-all duration-200 font-semibold flex items-center gap-0.5 sm:gap-1`}
                      title={t.label}
                    >
                      <Emoji emoji={t.icon} size="base" className="inline-block" />
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>{/* end .all-tools-group */}

            {/* Session Notes */}
            <div className="session-notes-section border-2 border-gray-300 my-2 sm:my-4 rounded bg-gray-50 w-full" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold text-slate-800" style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1rem)' }}>📝 Session Notes</div>
                <button
                  onClick={handleClearNotes}
                  className="session-interactive-buttons bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition-colors"
                  style={{ padding: 'clamp(0.25rem, 0.8vw, 0.375rem) clamp(0.5rem, 1.2vw, 0.75rem)', fontSize: 'clamp(0.5rem, 1.2vw, 0.625rem)' }}
                  title="Clear all notes"
                >
                  <Emoji emoji="🗑️" size="base" /> <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
              <textarea
                className="w-full rounded mt-1 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#DB9D32]"
                style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', minHeight: 'clamp(60px, 15vw, 80px)' }}
                value={sessionNotes}
                onChange={handleNotesChange}
                placeholder="Write session notes here..."
              />
            </div>

            {/* Message box */}
            <div className="session-message-box border-2 border-gray-300 mt-2 rounded bg-gray-50 w-full" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
              <div className="font-semibold text-slate-800 mb-2" style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1rem)' }}>💬 Message Box</div>
              <div className="overflow-y-auto mb-2" style={{ maxHeight: 'clamp(100px, 25vw, 150px)' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message-bubble ${msg.sender === 'trainer' ? 'message-bubble-sent' : 'message-bubble-received'}`}>
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
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type message..."
                  className="flex-1 border border-gray-300 rounded"
                  style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)' }}
                />
                <button
                  onClick={sendMessage}
                  className="btn-primary text-white border-none rounded cursor-pointer hover:bg-[#9C4D0B]"
                  style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem) clamp(0.75rem, 2vw, 1.25rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)' }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
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
                selectedProgramId={selectedProgramId}
                handleProgramCheck={handleProgramCheck}
                webRTC={webRTC}
                toggleListening={toggleListening}
                listening={listening}
                transcript={transcript}
                whiteboardService={whiteboardService}
                onSaveReport={handleSaveReport}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Session Info Bar - fixed to bottom with no surrounding margin */}
      <div className="session-info-bar session-control-buttons">
        <div className="session-info-text">
          <strong>Session Info:</strong> {sessionInfo?.learner_name ?? '—'} | {sessionInfo?.started_at ? new Date(sessionInfo.started_at).toLocaleDateString() : '--'} | Started: {sessionInfo?.started_at ? new Date(sessionInfo.started_at).toLocaleTimeString() : '--'} | Duration: {sessionInfo?.duration ? `${sessionInfo.duration} min` : '--'}
        </div>
        <div className="session-info-actions">
          <button
            className={isFrozen ? "btn-freeze-session active" : "btn-freeze-session"}
            onClick={handleFreeze}
            title={isFrozen ? "Unfreeze Learner Window" : "Freeze Learner Window"}
          >
            {isFrozen ? '🔓' : '🔒'} <span className="xs:inline">{isFrozen ? 'Unfreeze' : 'Freeze'}</span>
          </button>
          <button
            className="btn-end-session"
            onClick={handleEndSession}
            title="End Session"
          >
            ⏹️ <span className="xs:inline">End Session</span>
          </button>
        </div>
      </div>
      {/* Fill in the Blanks feature removed */}
    </div>
  );
};

export default TrainerSession;
