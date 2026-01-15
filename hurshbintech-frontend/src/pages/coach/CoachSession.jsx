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
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';


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
      src: '/reactions/realistic-balloon.svg',
      alt: 'Realistic Pink Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/realistic-balloon-red.svg',
      alt: 'Realistic Red Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/realistic-balloon-blue.svg',
      alt: 'Realistic Blue Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/realistic-balloon-green.svg',
      alt: 'Realistic Green Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/realistic-balloon-yellow.svg',
      alt: 'Realistic Yellow Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/realistic-balloon-purple.svg',
      alt: 'Realistic Purple Balloon'
    },
    {
      type: 'svg',
      src: '/reactions/realistic-balloon-orange.svg',
      alt: 'Realistic Orange Balloon'
    }
  ],
  star: {
    type: 'svg',
    src: '/reactions/realistic-oil-pastel-star.svg',
    alt: 'Realistic Oil Pastel Star'
  }
};

const CoachSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

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
        whiteboardService.sendStopwatchSync({
          elapsedTime: stopwatch.elapsedTime,
          isRunning: stopwatch.isRunning
        });
        lastSyncTimeRef.current = now;
      }
    }
  }, [whiteboardService, stopwatch.elapsedTime, stopwatch.isRunning]);

  // Unified whiteboard button styles
  const wbBtnBase = 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center';
  const wbBtnActive = 'bg-white border-2 border-blue-500 text-black shadow-lg rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center';
  const wbSmallBtnBase = 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1';
  const wbSmallBtnActive = 'bg-white border-2 border-blue-500 text-black shadow-lg rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1';

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
      const newState = webRTC.toggleMicrophone();
      setMicEnabled(newState);
    }
  };

  const handleToggleCamera = () => {
    if (webRTC) {
      const newState = webRTC.toggleCamera();
      setCameraEnabled(newState);
    }
  };

  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end this session?')) {
      try {
        // Broadcast session end to client/guest before ending
        if (whiteboardService) {
          whiteboardService.send('session_ended', {
            message: 'Coach has ended the session',
            timestamp: Date.now()
          });
        }
        
        await coachSessionService.endSession(sessionId, '');
        cleanup();
        toast.success('Session ended successfully');
        navigate('/coach/dashboard');
      } catch (error) {
        console.error('[CoachSession] Error ending session:', error);
        toast.error('Failed to end session');
      }
    }
  };

  const handleFreeze = () => {
    const newFreezeState = !isFrozen;
    setIsFrozen(newFreezeState);

    if (webRTC) {
      webRTC.sendMessage({
        type: 'freeze',
        frozen: newFreezeState
      });
    }

    toast.info(newFreezeState ? 'Client window frozen' : 'Client window unfrozen');
  };

  const cleanup = () => {
    if (webRTC?.localStream) {
      webRTC.localStream.getTracks().forEach(track => track.stop());
    }
    if (webRTC) {
      webRTC.close();
    }
    if (whiteboardService) {
      whiteboardService.close();
    }
    if (toolsService) {
      toolsService.cleanup();
    }
    isInitializingRef.current = false;
  };

  const toggleClientToolAccess = (toolName) => {
    const updated = { ...clientToolAccess, [toolName]: !clientToolAccess[toolName] };
    setClientToolAccess(updated);

    // Auto-enable select permission when drag is activated
    if (toolName === 'drag' && updated.drag) {
      updated.select = true;
      setClientToolAccess(updated);
    }

    // Send permission update to client/guest via whiteboard service
    if (whiteboardService) {
      whiteboardService.send('tool_access', {
        toolName,
        enabled: updated[toolName],
        allPermissions: updated
      });

      // If drag is being enabled, also send select permission update
      if (toolName === 'drag' && updated.drag) {
        whiteboardService.send('tool_access', {
          toolName: 'select',
          enabled: true,
          allPermissions: updated
        });
      }
    }
    console.log('[CoachSession] Client/Guest tool access updated:', updated);

    if (toolName === 'drag' && updated.drag) {
      setTool('select');
    }
  };

  const triggerClientKeyboard = () => {
    if (whiteboardService) {
      whiteboardService.sendTriggerKeyboard();
      toast.info('Keyboard tool sent to client');
    }
  };

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
      items: [] // Items inside bucket
    };
    setBuckets(prev => [...prev, newBucket]);

    // Send to other participants
    if (whiteboardService) {
      whiteboardService.sendBucketAdded(newBucket);
    }
  };

  const eraseAllPen = () => {
    // Clear local state
    setCanvasItems([]);
    setBuckets([]);
    setTextBoxes([]);

    // Trigger local clear and redraw
    setErasePenTrigger(prev => prev + 1);
    setClearCanvasTrigger(prev => prev + 1);
    setEraseAllActive(true);

    // Send clear command to client
    if (whiteboardService) {
      whiteboardService.send('clear_canvas', {
        timestamp: Date.now()
      });
    }

    setTimeout(() => setEraseAllActive(false), 300);
  };

  const generateSpacedPositions = (count, minPercent = 5, maxPercent = 95) => {
    const positions = [];
    const step = (maxPercent - minPercent) / (count - 1 || 1);
    for (let i = 0; i < count; i++) {
      positions.push(minPercent + i * step);
    }
    return positions;
  };

  const spawnFloatingAnimation = (type, asset) => {
    if (activeFloatingAnimationTypesRef.current.has(type)) {
      toast.warn(`${type.charAt(0).toUpperCase() + type.slice(1)}s are already active!`);
      return;
    }

    activeFloatingAnimationTypesRef.current.add(type);

    const count = 10;
    const leftPositions = generateSpacedPositions(count);

    const newAnimations = leftPositions.map((leftPercent, index) => {
      // For balloons, randomly select from the color array
      const selectedAsset = Array.isArray(asset)
        ? asset[Math.floor(Math.random() * asset.length)]
        : asset;

      return {
        id: `${type}_${Date.now()}_${index}`,
        type,
        ...selectedAsset,
        left: `${leftPercent}%`,
        bottom: '-50px',
        popped: false
      };
    });

    setFloatingAnimations(prev => [...prev, ...newAnimations]);

    if (whiteboardService) {
      whiteboardService.sendFloatingAnimations(newAnimations);
    }

    setTimeout(() => {
      setFloatingAnimations(prev => prev.filter(anim => !newAnimations.find(na => na.id === anim.id)));
      activeFloatingAnimationTypesRef.current.delete(type);
    }, 15000);
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
    setFloatingAnimations(prev =>
      prev.map(anim =>
        anim.id === animationId
          ? { ...anim, popped: true, poppedLeft, poppedTop }
          : anim
      )
    );
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

  const handleToolClick = (toolName) => {
    if (!toolsService) return;

    // Handle reaction animations
    if (toolName === 'smiley') {
      spawnFloatingAnimation('smiley', REACTION_SVG_ASSETS.smiley);
      return;
    }
    if (toolName === 'bubble') {
      spawnFloatingAnimation('bubble', REACTION_SVG_ASSETS.bubble);
      return;
    }
    if (toolName === 'balloon') {
      spawnFloatingAnimation('balloon', REACTION_SVG_ASSETS.balloon);
      return;
    }
    if (toolName === 'star') {
      spawnFloatingAnimation('star', REACTION_SVG_ASSETS.star);
      return;
    }

    // Handle drawing tools
    toolsService.handleToolClick(toolName, tool, setTool);
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
              className="btn-session btn-session-end"
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
        <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)', maxHeight: 'calc(100vh - 8rem)' }}>
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
          <div className="session-message-box border-2 border-gray-300 mt-4 rounded bg-gray-50 w-full flex-shrink-0" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)', maxHeight: '300px', display: 'flex', flexDirection: 'column' }}>
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
                className="bg-blue-500 text-white border-none rounded cursor-pointer hover:bg-blue-600"
                style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem) clamp(0.75rem, 2vw, 1.25rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)' }}
              >
                Send
              </button>
            </div>
          </div>
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
        </div>

        {/* Right Sidebar - Tool Controls */}
        <div className="session-right-sidebar">
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h3 className="text-sm font-bold mb-2">Whiteboard Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTool('pen');
                  setToolActive(true);
                  setEraserActive(false);
                }}
                className={tool === 'pen' ? wbSmallBtnActive : wbSmallBtnBase}
              >
                🖊️ Pen
              </button>
              <button
                onClick={() => {
                  setTool('eraser');
                  setEraserActive(true);
                  setToolActive(true);
                }}
                className={tool === 'eraser' ? wbSmallBtnActive : wbSmallBtnBase}
              >
                🧹 Eraser
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    handleAddTextBox();
                    setShowTextSizeSlider(!showTextSizeSlider);
                  }}
                  className={wbSmallBtnBase}
                >
                  📝 Text
                </button>
                {showTextSizeSlider && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded p-2 shadow-lg z-50" style={{ minWidth: '120px' }}>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Size: {textSize}px</label>
                    <input
                      type="range"
                      min="10"
                      max="48"
                      value={textSize}
                      onChange={(e) => setTextSize(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
              <button onClick={eraseAllPen} className={wbSmallBtnBase}>
                ❌ Clear
              </button>
              <button
                onClick={() => {
                  addBucket();
                }}
                className={wbSmallBtnBase}
              >
                🪣 Bucket
              </button>
            </div>

            {/* Pen Color Picker */}
            <div className="mt-3">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Pen Color:</label>
              {/* Color Palette */}
              <div className="grid grid-cols-5 gap-1 mb-2">
                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB'].map((paletteColor) => (
                  <button
                    key={paletteColor}
                    onClick={() => setColor(paletteColor)}
                    disabled={tool === 'eraser'}
                    className={`w-full h-8 rounded border-2 cursor-pointer transition-all ${color === paletteColor ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'
                      }`}
                    style={{ backgroundColor: paletteColor }}
                    title={paletteColor}
                  />
                ))}
              </div>
              {/* Custom Color Picker */}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={tool === 'eraser'}
                className="w-full h-8 rounded cursor-pointer border border-gray-300"
                title="Choose Custom Color"
              />
            </div>
          </div>

          {/* Client/Guest Tool Access Controls */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-bold mb-2">Client/Guest Tools</h3>
            <div className="grid grid-cols-3 gap-2">
              {/* Select Tool Toggle */}
              <button
                onClick={() => toggleClientToolAccess('select')}
                className={`${clientToolAccess.select ? wbSmallBtnActive : wbSmallBtnBase}`}
                title={clientToolAccess.select ? 'Disable Select for client/guest' : 'Enable Select for client/guest'}
              >
                <span>✋</span>
                <span>Select</span>
              </button>

              {/* Drag Tool Toggle */}
              <button
                onClick={() => toggleClientToolAccess('drag')}
                className={`${clientToolAccess.drag ? wbSmallBtnActive : wbSmallBtnBase}`}
                title={clientToolAccess.drag ? 'Disable Drag for client/guest' : 'Enable Drag for client/guest'}
              >
                <span>↔️</span>
                <span>Drag</span>
              </button>

              {/* Keyboard Tool Toggle */}
              {/* <button
                onClick={() => {
                  // Toggle keyboard access for client/guest
                  toggleClientToolAccess('keyboard');
                  // If enabling, also send an immediate trigger so the keyboard appears right away
                  if (!clientToolAccess.keyboard) {
                    triggerClientKeyboard();
                  }
                }}
                className={`${clientToolAccess.keyboard ? wbSmallBtnActive : wbSmallBtnBase}`}
                title={clientToolAccess.keyboard ? 'Revoke keyboard access' : 'Grant keyboard access'}
              >
                <span>⌨️</span>
                <span>Keyboard</span>
              </button> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachSession;
