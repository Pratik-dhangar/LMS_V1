// TrainerSession.js
// -------------------------------------------------------------
// 🔹 Purpose: Main React component for the Trainer's live session interface.
// 🔸 How it works: Manages session data, initializes WebRTC + Whiteboard services,
// handles speech recognition, timers/stopwatches on the whiteboard,
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
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import YouTubePopup from '../../components/common/YouTubePopup';
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
  toggleToolAccess as utilToggleToolAccess,
  cleanupSessionResources,
  syncStopwatchToParticipant,
  endSession as utilEndSession,
  calculateTimeRemaining,
  getAudioContext,
  playPopSound,
  handleAnimationPop as utilHandleAnimationPop,
  handleToolClick as utilHandleToolClick,
  sendFeedbackMessage,
  sendWaitingMessage
} from '../../utils/sessionUtils';


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

  // Base URL for websocket - Use utility function
  const WS_BASE_URL = getWSBaseURL();

  // -----------------------------------------------------------
  // 🔹 Purpose: Hold instances of WebRTC and Whiteboard services
  // 🔸 How it works: Dual VideoConferenceService instances for mesh P2P (Learner + Observer)
  // -----------------------------------------------------------
  const [learnerRTC, setLearnerRTC] = useState(null); // Primary connection for Learner
  const [observerRTC, setObserverRTC] = useState(null); // Secondary connection for Observer
  const [whiteboardService, setWhiteboardService] = useState(null);
  const [toolsService, setToolsService] = useState(null);
  const [recordingService, setRecordingService] = useState(null);
  const isInitializingRef = useRef(false); // Prevent duplicate initialization
  const observerInitializedRef = useRef(false); // Prevent duplicate observer initialization
  const activeFloatingAnimationTypesRef = useRef(new Set()); // Track active floating animation types

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
        // console.log('[TrainerSession] Loading session notes for sessionId:', sessionId);
        const notesData = await sessionNotesService.getNotes(sessionId);
        if (notesData && notesData.notes) {
          // console.log('[TrainerSession] ✅ Session notes loaded, version:', notesData.version);
          setSessionNotes(notesData.notes);
        } else {
          // console.log('[TrainerSession] ℹ️ No existing session notes found, starting fresh');
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
    // console.log('[TrainerSession] feedbackMessage state changed to:', feedbackMessage);
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
  // 🔹 Purpose: Observer modal state
  // 🔸 How it works: Show modal when observer (head) joins to prompt screen share
  // -----------------------------------------------------------
  const [showObserverModal, setShowObserverModal] = useState(false);
  const [observerData, setObserverData] = useState(null);

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
    { id: 1, name: '🎶 Music 2', url: '/music/background-music-2.mp3' },
    { id: 2, name: '🎼 Music 3', url: '/music/background-music-3.mp3' }
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
  // Unified whiteboard button styles - Use utility constants
  const wbBtnBase = WB_BUTTON_STYLES.base;
  const wbBtnActive = WB_BUTTON_STYLES.active;
  const wbSmallBtnBase = WB_BUTTON_STYLES.smallBase;
  const wbSmallBtnActive = WB_BUTTON_STYLES.smallActive;
  const [buckets, setBuckets] = useState([]);
  const [bucketColor, setBucketColor] = useState('#8B6F47'); // Default bucket color (Brown)
  const bucketColors = BUCKET_COLORS; // Use utility constant

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
      // console.log('[TrainerSession] Content ended - auto-showing stopwatch');
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
    question: '',
    answer: ''
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
      if (!listening && micEnabled && learnerRTC) {
        // console.log('[TrainerSession] Turning ON voice input, turning OFF video mic');
        learnerRTC.toggleMicrophone();
        setMicEnabled(false);
        // toast.info('Video conferencing mic disabled - Voice input enabled');
      }

      // Toggle voice input using the new hook
      // The hook will auto-send via the onMuteMic callback when mic is muted
      await handleVoiceToggle();

      // If turning OFF voice input and video conferencing mic is currently OFF, turn it ON
      // Note: 'listening' is the OLD state before toggle, so we check if it WAS true (now turning OFF)
      if (listening && !micEnabled && learnerRTC) {
        // console.log('[TrainerSession] Turning OFF voice input, turning ON video mic');
        learnerRTC.toggleMicrophone();
        setMicEnabled(true);
        // toast.info('Voice input disabled - Video conferencing mic enabled');
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
    // console.log('[TrainerSession] Component mounted, sessionId:', sessionId);
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.error('[TrainerSession] No user data found in localStorage');
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    // console.log('[TrainerSession] User data:', { id: user.id, role: user.role, name: user.name });
    initializeSession(user.id);

    // 🔹 Purpose: Cleanup when the component unmounts - save notes before leaving
    // 🔸 How it works: clears auto-save timer, saves final notes, then calls cleanup()
    return () => {
      // console.log('[TrainerSession] Component unmounting, saving notes and cleaning up');

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
      // console.log('[TrainerSession] Remote user selected items:', data);
      if (data.itemIds && Array.isArray(data.itemIds)) {
        setRemoteSelectedItemIds(data.itemIds);
      }
    };

    // Set up callback for animation pop events from learner
    whiteboardService.onAnimationPopped = (data) => {
      // console.log('[TrainerSession] Animation popped by learner:', data);
      handleAnimationPop(data.animationId, data.poppedLeft, data.poppedTop);
    };

    // Set up callback for exercise answer updates from learner
    whiteboardService.onExerciseAnswerUpdate = (data) => {
      // console.log('[TrainerSession] 📝 Learner answer updated:', data);
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

    // Set up callback for exercise submission from learner
    whiteboardService.onExerciseResponse = (data) => {
      // console.log('[TrainerSession] 📋 Learner submitted exercise:', data);
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
      // console.log('[TrainerSession] Fetching session details for sessionId:', sessionId);
      // Fetch session details
      const session = await sessionService.getSessionDetails(sessionId);
      //   console.log('[TrainerSession] Session details received:', {
      //   id: session.id,
      //     session_id: session.session_id,
      //       title: session.title,
      //         trainer_id: session.trainer_id,
      //           learner_id: session.learner_id,
      //             status: session.status,
      //               learning_contents: session.learning_contents?.length || 0,
      //                 learning_goals: session.learning_goals?.length || 0
      // });
      // console.log('[TrainerSession] Learning Contents:', session.learning_contents);
      // console.log('[TrainerSession] Learning Goals:', session.learning_goals);

      // Log detailed content info for debugging thumbnails
      if (session.learning_contents && session.learning_contents.length > 0) {
        // console.log('[TrainerSession] First content item full structure:', JSON.stringify(session.learning_contents[0], null, 2));
        session.learning_contents.forEach((content, index) => {
          //   console.log(`[TrainerSession] Content ${index + 1} - All URL fields:`, {
          //   id: content.id,
          //     title: content.title,
          //       content_type: content.content_type,
          //         // All possible URL fields
          //         thumbnail_url: content.thumbnail_url,
          //           thumbnail: content.thumbnail,
          //             image_url: content.image_url,
          //               url: content.url,
          //                 content_url: content.content_url,
          //                   file_path: content.file_path,
          //                     file_url: content.file_url,
          //                       // Show all keys for debugging
          //                       allKeys: Object.keys(content)
          // });
        });
      }

      setSessionInfo(session);

      // 🔹 Purpose: Prevent access to already-ended sessions (e.g., via browser back button)
      // 🔸 How it works: Check if session status is 'ended', redirect immediately
      if (session.status === 'ended') {
        toast.warning('This session has already ended');
        navigate('/trainer/dashboard');
        return;
      }

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
          // console.warn('[TrainerSession] Session already active:', sessionCheck.message);
          toast.error(sessionCheck.message);
          navigate('/trainer/dashboard');
        }
        return;
      }

      // console.log('[TrainerSession] Authorization successful, initializing WebRTC');
      await initializeWebRTC(session.id);
      setLoading(false);
      // console.log('[TrainerSession] Session initialization complete');
    } catch (error) {
      console.error('[TrainerSession] Error initializing session:', error);
      console.error('[TrainerSession] Error details:', error.response?.data);
      toast.error('Failed to initialize session');
      navigate('/dashboard');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Initialize WebRTCService and WhiteboardService for LEARNER
  // 🔸 How it works: creates primary service instance for Trainer-Learner connection
  // -----------------------------------------------------------
  const initializeWebRTC = async (numericSessionId) => {
    // Prevent duplicate initialization
    if (isInitializingRef.current) {
      // console.log('[TrainerSession] Already initializing, skipping duplicate call');
      return;
    }
    isInitializingRef.current = true;

    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, sessionId, 'trainer');
    try {
      // console.log('[TrainerSession] Initializing whiteboard service');
      wbService.initialize();
      setWhiteboardService(wbService);
      // console.log('[TrainerSession] Whiteboard service initialized');

      // Initialize WhiteboardTools service for managing all tools
      const tbService = new WhiteboardToolsService(wbService);
      setToolsService(tbService);
      // console.log('[TrainerSession] Tools service initialized');
    } catch (error) {
      console.error('[TrainerSession] Error initializing whiteboard:', error);
      toast.error('Failed to initialize whiteboard');
    }

    // Initialize PRIMARY Video Conference Service (for Learner)
    const learnerVideoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'trainer');

    try {
      console.log('[TrainerSession] Initializing LEARNER Video Conference service');

      // Set callback for local stream (trainer's camera/mic)
      learnerVideoService.onLocalStream = (stream) => {
        console.log('[TrainerSession] Local stream received (Learner connection)');
        setLocalStream(stream);
      };

      // Set callback for remote stream (learner's video)
      learnerVideoService.onRemoteStream = (stream) => {
        console.log('[TrainerSession] Remote stream received from learner');
        setRemoteStream(stream);

        // Only show toast once when learner first connects
        if (!learnerConnectedRef.current) {
          learnerConnectedRef.current = true;
          toast.success(`${sessionInfo?.learner_name || 'Learner'} has joined the session`);
        }
      };

      // Set callback for connection state changes
      learnerVideoService.onConnectionStateChange = (state) => {
        console.log('[TrainerSession] LEARNER connection state:', state);
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
      learnerVideoService.onError = (error) => {
        console.error('[TrainerSession] LEARNER video conference error:', error);
        toast.error(`Video error: ${error.message}`);
      };

      // ---------------------------------------------------------
      // ✅ CRITICAL: Hook Observer Events to Learner Connection
      // ---------------------------------------------------------
      learnerVideoService.onObserverJoined = (observerUserData) => {
        console.log('[TrainerSession] 🔔 Observer joined event received!', observerUserData);
        console.log('[TrainerSession] Setting observer data and showing modal...');

        // Store observer data and show modal
        setObserverData(observerUserData);
        setShowObserverModal(true);

        console.log('[TrainerSession] Modal should now be visible');
      };

      learnerVideoService.onObserverLeft = () => {
        console.log('[TrainerSession] 🔕 Observer left event received');
        toast.info('Observer left the session', { autoClose: 2000, position: 'top-center' });

        // Cleanup only the observer connection
        if (observerRTC) {
          observerRTC.close();
          setObserverRTC(null);
          observerInitializedRef.current = false; // Reset flag
        }
      };
      // ---------------------------------------------------------

      // Initialize video conference (gets local media and sets up connection)
      await learnerVideoService.initialize();
      setLearnerRTC(learnerVideoService);

      // Initialize recording service with numeric database ID
      console.log('[TrainerSession] Initializing recording service with numeric session ID:', numericSessionId);
      const recService = new JanusRecordingService(learnerVideoService, numericSessionId);
      setRecordingService(recService);

      // Update media control states
      setMicEnabled(learnerVideoService.isMicrophoneEnabled());
      setCameraEnabled(learnerVideoService.isCameraEnabled());

      console.log('[TrainerSession] LEARNER Video Conference service initialized');
      console.log('[TrainerSession] Recording service initialized');
    } catch (error) {
      console.error('[TrainerSession] LEARNER Video Conference init error:', error);
      toast.error('Failed to initialize video conference');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Initialize SECONDARY connection for Observer
  // 🔸 How it works: Creates separate VideoConferenceService instance for Observer screen sharing
  // -----------------------------------------------------------
  const initializeObserverConnection = async () => {
    // ✅ FIX: Prevent duplicate initialization
    if (observerInitializedRef.current) {
      console.log('[TrainerSession] Observer connection already initializing/active');
      return;
    }
    observerInitializedRef.current = true;

    try {
      console.log('[TrainerSession] Initializing OBSERVER Video Conference service');

      // Create NEW instance specifically for Observer connection
      // Pass targetRole='observer' so all signaling goes only to observer, not learner
      const observerVideoService = new VideoConferenceService(
        WS_BASE_URL,
        sessionId,
        'trainer',
        false, // not isObserver (trainer is sender)
        'observer' // targetRole - routes signaling only to observer
      );

      // We don't need callbacks for observer (they are passive viewers)
      // But we handle errors
      observerVideoService.onError = (error) => {
        console.error('[TrainerSession] OBSERVER video conference error:', error);
        toast.error(`Observer connection error: ${error.message}`);
      };

      observerVideoService.onConnectionStateChange = (state) => {
        console.log('[TrainerSession] OBSERVER connection state:', state);
      };

      // Initialize observer connection (reuses local media from learnerRTC)
      await observerVideoService.initialize();
      setObserverRTC(observerVideoService);

      console.log('[TrainerSession] OBSERVER Video Conference service initialized');

      // Wait for connection to stabilize, then start screen share
      setTimeout(async () => {
        try {
          console.log('[TrainerSession] Starting screen share for observer');
          await observerVideoService.startScreenShare('observer');
          toast.success('Screen sharing started for observer', { autoClose: 2000 });
        } catch (error) {
          if (error.name === 'NotAllowedError') {
            toast.warning('Screen sharing cancelled', { autoClose: 3000 });
          } else {
            console.error('[TrainerSession] Error starting screen share:', error);
            toast.error('Failed to start screen sharing');
          }
        }
      }, 1000);
    } catch (error) {
      console.error('[TrainerSession] OBSERVER Video Conference init error:', error);
      toast.error('Failed to initialize observer connection');
      observerInitializedRef.current = false;
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle observer modal OK button click
  // 🔸 How it works: Close modal and trigger observer connection with screen share
  // -----------------------------------------------------------
  const handleObserverModalOk = async () => {
    setShowObserverModal(false);
    // Initialize the SECONDARY connection for Observer
    await initializeObserverConnection();
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle microphone on/off
  // 🔸 How it works: uses utility function with observer sync and voice input coordination
  // -----------------------------------------------------------
  const handleToggleMic = async () => {
    if (learnerRTC) {
      const newState = utilToggleMicrophone(learnerRTC, setMicEnabled, [observerRTC]);

      // If turning ON video conferencing mic and voice input is ON, turn OFF voice input
      if (newState && listening) {
        await handleVoiceToggle(); // Stop voice input
        // toast.info('Voice input stopped - video conferencing mic enabled');
      }
      // If turning OFF video conferencing mic, don't auto-enable voice input
      else if (!newState && !listening) {
        // toast.info('Video conferencing mic disabled');
      }
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Toggle camera on/off
  // 🔸 How it works: uses utility function
  // -----------------------------------------------------------
  const handleToggleCamera = () => {
    if (learnerRTC) {
      utilToggleCamera(learnerRTC, setCameraEnabled);
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: End session explicitly by trainer
  // 🔸 How it works: uses utility function with notes saving
  // -----------------------------------------------------------
  const handleEndSession = async () => {
    // Save notes before ending session
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Final save of notes
    if (sessionNotes && sessionNotes.trim()) {
      try {
        await sessionNotesService.saveNotes(sessionId, sessionNotes);
      } catch (error) {
        console.error('[TrainerSession] Error saving notes before ending:', error);
      }
    }

    // Use utility function to end session
    await utilEndSession({
      whiteboardService,
      sessionServiceEndFn: (id, notes) => sessionService.endSession(id, notes),
      sessionId,
      notes: sessionNotes || '',
      cleanupFn: cleanup,
      navigate,
      dashboardPath: '/trainer/dashboard',
      roleName: 'trainer'
    });
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
  // 🔸 How it works: uses utility function
  // -----------------------------------------------------------
  const handleFreeze = () => {
    utilToggleFreeze(isFrozen, setIsFrozen, learnerRTC, 'learner');
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Exercise tool handlers
  // 🔸 How it works: manages exercise creation, updates, and learner responses
  // -----------------------------------------------------------
  const handleExerciseUpdate = (exerciseInfo) => {
    // console.log('[TrainerSession] Exercise updated:', exerciseInfo);
    setExerciseData(exerciseInfo);

    // Send exercise to learner via whiteboard service
    if (whiteboardService) {
      whiteboardService.send('exercise_update', {
        question: exerciseInfo.question,
        answer: exerciseInfo.answer || '',
        timestamp: Date.now()
      });
    }
  };

  const handleExerciseAnswerChange = (answerData) => {
    // console.log('[TrainerSession] Learner answer updated:', answerData);
    // Update the answer in exerciseData
    setExerciseData(prev => ({
      ...prev,
      answer: answerData.answer || ''
    }));
  };

  const handleExerciseSubmit = (response) => {
    // console.log('[TrainerSession] Exercise response received:', response);

    // Handle learner's answer submission
    if (response.status === 'submitted') {
      // Send feedback to learner or save the response
      if (whiteboardService) {
        whiteboardService.send('exercise_response', {
          question: response.question,
          answer: response.answer,
          timestamp: Date.now()
        });
      }
    } else if (response.status === 'sent_to_learner') {
      // Send exercise to learner when "Send to Learner" is clicked
      if (whiteboardService) {
        whiteboardService.send('exercise_update', {
          question: response.question,
          answer: '',
          timestamp: Date.now()
        });
      }
    }
  };

  const handleExerciseDelete = () => {
    // console.log('[TrainerSession] Exercise deleted');
    setShowExercise(false);
    setExerciseData({
      question: '',
      answer: ''
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
    // console.log('Session ended by:', payload.ended_by);
    toast.info('Session has been ended');
    cleanup();
    navigate('/trainer/dashboard');
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Cleanup function to close WebRTC and Whiteboard services
  // 🔸 How it works: uses utility function with additional cleanup
  // -----------------------------------------------------------
  const cleanup = () => {
    // Use utility function for common cleanup
    cleanupSessionResources({
      videoService: learnerRTC,
      whiteboardService,
      toolsService,
      recordingService,
      secondaryVideoService: observerRTC,
      isInitializingRef
    });

    // Reset observer initialization flag
    observerInitializedRef.current = false;

    // Clear timers and stopwatches intervals
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

    // console.log('[TrainerSession] YouTube popup created:', newPopup);
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
      // console.log('[TrainerSession] YouTube popup sync sent to learner');
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
      // console.log('[TrainerSession] YouTube popup closed, sync sent to learner');
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
    // console.log('[handleSaveReport] Starting - sessionInfo:', sessionInfo);

    if (!sessionInfo || !sessionInfo.id) {
      // console.error('[handleSaveReport] Session info not available:', sessionInfo);
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

      // console.log('[TrainerSession] Report data being sent:', JSON.stringify(reportData, null, 2));
      // console.log('[TrainerSession] session_id type:', typeof reportData.session_id, 'value:', reportData.session_id);
      // console.log('[TrainerSession] learner_id type:', typeof reportData.learner_id, 'value:', reportData.learner_id);

      await sessionReportService.create(reportData);
      toast.success(`Report saved: ${selectedProgram.goal}`);

      // Reset selections after saving
      setSelectedProgramId(null);
      setSelectedPromptLevel(null);
      setSelectedReinforcementLevel(null);

      // Send reset values to learner
      if (learnerRTC) {
        learnerRTC.sendPromptMeter(0);
        learnerRTC.sendReinforcementMeter(0);
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
        // console.log('[TrainerSession] 💾 Auto-saving session notes...');
        await sessionNotesService.saveNotes(sessionId, newNotes);
        // console.log('[TrainerSession] ✅ Session notes auto-saved successfully');
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
      // console.log('[TrainerSession] Clearing session notes');
      setSessionNotes('');
      // Clear the auto-save timer if one is pending
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      // Immediately save the clear action to backend
      await sessionNotesService.clearNotes(sessionId);
      // console.log('[TrainerSession] ✅ Session notes cleared successfully');
      // toast.info('Session notes cleared');
    } catch (error) {
      console.error('[TrainerSession] ❌ Error clearing notes:', error);
      // toast.error('Failed to clear notes');
    }
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Force save notes on disconnect/reconnect
  // 🔸 How it works: immediately saves current notes bypassing debounce
  // Used for disconnect recovery when connection is restored
  // -----------------------------------------------------------
  const handleForceSaveNotes = async () => {
    try {
      // console.log('[TrainerSession] Force-saving notes (disconnect recovery)');
      await sessionNotesService.forceSaveNotes(sessionId, sessionNotes);
      // console.log('[TrainerSession] ✅ Notes force-saved successfully');
      // toast.info('Notes recovered and saved');
    } catch (error) {
      console.error('[TrainerSession] ❌ Error force-saving notes:', error);
      // toast.error('Failed to recover notes');
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
      if (learnerRTC) {
        learnerRTC.sendPromptMeter(0);
        learnerRTC.sendReinforcementMeter(0);
      }
    } else {
      // If a different program is checked, select the new one and reset meters to 0
      setSelectedProgramId(programId);
      setSelectedPromptLevel(null);
      setSelectedReinforcementLevel(null);
      // Send reset values (0) to learner
      if (learnerRTC) {
        learnerRTC.sendPromptMeter(0);
        learnerRTC.sendReinforcementMeter(0);
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
        // console.log('[TrainerSession] Searching database for:', learningContentSearch);

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

        // console.log('[TrainerSession] Database search results:', filtered.length);
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
  // 🔸 How it works: uses utility function
  // -----------------------------------------------------------
  const toggleLearnerToolAccess = (toolName) => {
    utilToggleToolAccess(toolName, learnerToolAccess, setLearnerToolAccess, whiteboardService, setTool);
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
        audioRef.current.play().catch(err => { /* console.log('Audio play error:', err); */ });
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
  // 🔸 How it works: uses utility function with canvas boundaries
  // -----------------------------------------------------------
  const whiteboardCanvasRef = useRef(null);

  const addBucket = () => {
    // Use conservative canvas dimensions to ensure buckets stay within bounds
    // These are approximate - actual canvas is responsive but we use safe margins
    utilAddBucket(buckets, setBuckets, whiteboardService, bucketColor, 900, 500, whiteboardCanvasRef);
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Clear all pen strokes (drawings) from the whiteboard
  // 🔸 How it works: uses utility function
  // -----------------------------------------------------------
  const eraseAllPen = () => {
    utilEraseAllPen({
      setErasePenTrigger,
      setRedrawCanvasTrigger,
      whiteboardService
    });
  };

  // -----------------------------------------------------------
  // 🔹 Purpose: Spawn floating animations (bubbles, smileys, balloons, stars)
  // 🔸 How it works: uses utility function
  // -----------------------------------------------------------
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

  // Audio context and playPopSound managed by utility
  // getAudioContext() and playPopSound() imported from sessionUtils

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle animation pop from learner
  // 🔸 How it works: uses utility function
  // -----------------------------------------------------------
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

  // -----------------------------------------------------------
  // 🔹 Purpose: Handle clicks on whiteboard tool buttons (timers, emoji, pause, etc.)
  // 🔸 How it works: uses utility function
  // -----------------------------------------------------------
  const handleToolClick = (tool) => {
    utilHandleToolClick({
      tool,
      setFeedbackMessage,
      setWaitingMessage,
      setShowExercise,
      spawnFloatingAnimation,
      toggleLearnerToolAccess,
      whiteboardService,
      REACTION_SVG_ASSETS
    });
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
            webRTC={learnerRTC}
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
            toolAccess={learnerToolAccess}
            toggleToolAccess={toggleLearnerToolAccess}
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
            participantType="learner"
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
                selectedProgramId={selectedProgramId}
                handleProgramCheck={handleProgramCheck}
                webRTC={learnerRTC}
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
      <div className="session-info-bar session-control-buttons" style={{ justifyContent: 'center' }}>
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
            ⏹️ <span className="xs:inline">End</span>
          </button>
        </div>
      </div>
      {/* Fill in the Blanks feature removed */}

      {/* Observer Joined Modal */}
      {showObserverModal && observerData && (
        <div className="app-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="app-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Observer Joined</h2>
            </div>

            {/* Modal Body */}
            <div className="app-modal-content">
              <p className="app-modal-text">
                <strong>{observerData.name}</strong> has joined as an observer. Please share your screen!
              </p>
            </div>

            {/* Modal Footer */}
            <div className="app-modal-footer">
              <button
                onClick={handleObserverModalOk}
                className="app-modal-btn app-modal-btn--primary"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerSession;