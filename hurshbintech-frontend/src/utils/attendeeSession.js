// attendeeSession.js
// ============================================================================
// 🔹 Purpose: Shared utilities for Attendee Session Pages
// 🔸 Pages: ClientSession ✅, GuestSession ✅, LearnerSession (future)
// 🔹 Role: Attendees receive instructions, have limited tools, sync from instructor
// 
// 📋 MIGRATION STATUS:
// ✅ ClientSession - Successfully migrated
// ✅ GuestSession - Successfully migrated
// ⏳ LearnerSession - Complex page (2104 lines), can be migrated in future refactoring
// 
// 🎯 USAGE:
// import { 
//   useAttendeeSessionState,
//   initializeAttendeeServices,
//   cleanupAttendeeSession,
//   formatTime
// } from '../../utils/attendeeSession';
// 
// const MyAttendeeComponent = () => {
//   const state = useAttendeeSessionState();
//   // Use state.webRTC, state.whiteboardService, etc.
// };
// ============================================================================

import { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import VideoConferenceService from '../api/services/videoConferenceService';
import WhiteboardService from '../api/services/whiteboardService';
import WhiteboardToolsService from '../api/services/WhiteboardToolsService';
import { playPopSound } from '../components/session/InstructorSessionLayout';

// ============================================================================
// CONSTANTS
// ============================================================================

export const getWSBaseURL = () => {
    return import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
};

// ============================================================================
// STATE MANAGEMENT HOOK
// ============================================================================

/**
 * Hook to initialize all attendee session state variables
 * Used by: LearnerSession, ClientSession, GuestSession
 */
export const useAttendeeSessionState = () => {
    // Service instances
    const [webRTC, setWebRTC] = useState(null);
    const [whiteboardService, setWhiteboardService] = useState(null);
    const [toolsService, setToolsService] = useState(null);
    const isInitializingRef = useRef(false);

    // Media streams
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const remoteVideoRef = useRef(null);

    // Media controls
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);

    // Session state
    const [sessionInfo, setSessionInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [instructorJoined, setInstructorJoined] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);

    // Whiteboard state
    const [canvasItems, setCanvasItems] = useState([]);
    const [keyboardMode, setKeyboardMode] = useState(false);
    const [keyboardText, setKeyboardText] = useState('');
    const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
    const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]);
    const [textMessages, setTextMessages] = useState([]);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [waitingMessage, setWaitingMessage] = useState('');
    const [floatingAnimations, setFloatingAnimations] = useState([]);

    // UI state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isFrozen, setIsFrozen] = useState(false);
    const [showHeader, setShowHeader] = useState(true);
    const headerTimeoutRef = useRef(null);
    const [erasePenTrigger, setErasePenTrigger] = useState(0);
    const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

    // Drawing tools
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    const [buckets, setBuckets] = useState([]);
    const [textBoxes, setTextBoxes] = useState([]);
    const [activeTextBoxId, setActiveTextBoxId] = useState(null);

    // Tool access control (from instructor)
    const [toolAccess, setToolAccess] = useState({
        select: false,
        drag: false,
        keyboard: false
    });

    // Stopwatch (synced from instructor)
    const [stopwatchElapsedTime, setStopwatchElapsedTime] = useState(0);
    const [stopwatchIsRunning, setStopwatchIsRunning] = useState(false);

    // Background Music (synced from instructor)
    const [backgroundMusicPlaying, setBackgroundMusicPlaying] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [musicVolume, setMusicVolume] = useState(0.5);
    const audioRef = useRef(null);

    // Meter states (synced from instructor)
    const [promptMeter, setPromptMeter] = useState(null);
    const [reinforcementMeter, setReinforcementMeter] = useState(null);
    const [bucketColor, setBucketColor] = useState('#6D5A3F'); // Default bucket color (Brown)

    // Prompt text (synced from instructor)
    const [promptText, setPromptText] = useState('[Prompts from instructor will appear here]');

    // Comments (synced from instructor)
    const [trainerComments, setTrainerComments] = useState([]);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);

    return {
        webRTC, setWebRTC,
        whiteboardService, setWhiteboardService,
        toolsService, setToolsService,
        isInitializingRef,
        localStream, setLocalStream,
        remoteStream, setRemoteStream,
        remoteVideoRef,
        micEnabled, setMicEnabled,
        cameraEnabled, setCameraEnabled,
        sessionInfo, setSessionInfo,
        loading, setLoading,
        connectionStatus, setConnectionStatus,
        instructorJoined, setInstructorJoined,
        timeLeft, setTimeLeft,
        canvasItems, setCanvasItems,
        keyboardMode, setKeyboardMode,
        keyboardText, setKeyboardText,
        keyboardPosition, setKeyboardPosition,
        remoteSelectedItemIds, setRemoteSelectedItemIds,
        textMessages, setTextMessages,
        feedbackMessage, setFeedbackMessage,
        waitingMessage, setWaitingMessage,
        floatingAnimations, setFloatingAnimations,
        isSidebarOpen, setIsSidebarOpen,
        isFrozen, setIsFrozen,
        showHeader, setShowHeader,
        headerTimeoutRef,
        erasePenTrigger, setErasePenTrigger,
        redrawCanvasTrigger, setRedrawCanvasTrigger,
        tool, setTool,
        color, setColor,
        lineWidth, setLineWidth,
        buckets, setBuckets,
        textBoxes, setTextBoxes,
        activeTextBoxId, setActiveTextBoxId,
        toolAccess, setToolAccess,
        stopwatchElapsedTime, setStopwatchElapsedTime,
        stopwatchIsRunning, setStopwatchIsRunning,
        backgroundMusicPlaying, setBackgroundMusicPlaying,
        selectedMusic, setSelectedMusic,
        musicVolume, setMusicVolume,
        audioRef,
        promptMeter, setPromptMeter,
        reinforcementMeter, setReinforcementMeter,
        bucketColor, setBucketColor,
        promptText, setPromptText,
        trainerComments, setTrainerComments,
        isCommentsOpen, setIsCommentsOpen
    };
};

// ============================================================================
// WHITEBOARD EVENT LISTENERS
// ============================================================================

/**
 * Setup all whiteboard event listeners for attendee
 */
export const setupAttendeeWhiteboardListeners = (wbService, state) => {
    console.log('[AttendeeSession] 🔧 Setting up whiteboard listeners');
    console.log('[AttendeeSession] 🔧 wbService exists?', !!wbService);
    console.log('[AttendeeSession] 🔧 audioRef from state:', state.audioRef);

    const {
        setToolAccess,
        setRemoteSelectedItemIds,
        setKeyboardMode,
        setBuckets,
        setFloatingAnimations,
        setErasePenTrigger,
        setTextBoxes,
        setCanvasItems,
        setIsFrozen,
        setStopwatchElapsedTime,
        setStopwatchIsRunning,
        setFeedbackMessage,
        setWaitingMessage,
        setRedrawCanvasTrigger,
        setBackgroundMusicPlaying,
        setSelectedMusic,
        setMusicVolume,
        audioRef,
        setPromptMeter,
        setReinforcementMeter,
        setBucketColor,
        setTrainerComments,
        setIsCommentsOpen
    } = state;

    // Tool access from instructor
    wbService.onToolAccess = (data) => {
        console.log('[AttendeeSession] Tool access received:', data);
        if (data.allPermissions) {
            setToolAccess(data.allPermissions);
        } else {
            setToolAccess(data);
        }
    };

    // Remote item selection
    wbService.onItemSelected = (data) => {
        console.log('[AttendeeSession] Remote user selected items:', data);
        if (data.itemIds && Array.isArray(data.itemIds)) {
            setRemoteSelectedItemIds(data.itemIds);
        }
    };

    // Keyboard tool trigger
    wbService.onTriggerKeyboard = () => {
        console.log('[AttendeeSession] Keyboard tool triggered');
        setKeyboardMode(true);
    };

    // Note: onBucketAdded and onBucketUpdate are handled by Whiteboard component directly (Whiteboard.jsx)
    // Whiteboard.jsx's useEffect sets comprehensive handlers that:
    // 1. Denormalize coordinates from 0-1 range to local canvas pixels
    // 2. Reposition child items when bucket moves (offset-based)
    // 3. Use String() for type-safe ID comparisons
    // Do NOT set wbService.onBucketAdded or wbService.onBucketUpdate here — it would overwrite the working handlers.

    // Floating animations
    wbService.onFloatingAnimations = (data) => {
        console.log('[AttendeeSession] Floating animations received:', data);
        setFloatingAnimations(prev => [...prev, ...data.animations]);

        // Auto-remove after 13 seconds
        setTimeout(() => {
            setFloatingAnimations(prevAnims =>
                prevAnims.filter(anim => !data.animations.find(newAnim => newAnim.id === anim.id))
            );
        }, 15000);
    };

    wbService.onAnimationPopped = (data) => {
        console.log('[AttendeeSession] Animation popped by remote user:', data);
        // Play pop sound on the receiving end
        playPopSound(data.animationType);

        // Update animation state to show it as popped
        setFloatingAnimations(prev =>
            prev.map(anim =>
                anim.id === data.animationId
                    ? { ...anim, popped: true, poppedLeft: data.poppedLeft, poppedTop: data.poppedTop }
                    : anim
            )
        );
    };

    // Pen erase
    wbService.onErasePen = () => {
        console.log('[AttendeeSession] 🗑️ Erase pen received from coach');
        console.log('[AttendeeSession] Setting erasePenTrigger...');
        setErasePenTrigger(prev => {
            console.log('[AttendeeSession] erasePenTrigger updated from', prev, 'to', prev + 1);
            return prev + 1;
        });
        console.log('[AttendeeSession] Setting redrawCanvasTrigger...');
        setRedrawCanvasTrigger(prev => {
            console.log('[AttendeeSession] redrawCanvasTrigger updated from', prev, 'to', prev + 1);
            return prev + 1;
        });
    };

    // Text box handlers
    wbService.onTextBoxAdded = (textBox) => {
        console.log('[AttendeeSession] Text box added:', textBox);
        setTextBoxes(prev => [...prev, textBox]);
    };

    wbService.onTextBoxUpdate = (update) => {
        console.log('[AttendeeSession] Text box updated:', update);
        setTextBoxes(prev => prev.map(box =>
            box.id === update.id ? { ...box, ...update } : box
        ));
    };

    wbService.onTextBoxRemoved = (data) => {
        console.log('[AttendeeSession] Text box removed:', data);
        setTextBoxes(prev => prev.filter(box => box.id !== data.id));
    };

    // Clear canvas
    wbService.onClearCanvas = () => {
        console.log('[AttendeeSession] Clear canvas command received');
        setCanvasItems([]);
        setBuckets([]);
        setTextBoxes([]);
        setErasePenTrigger(prev => prev + 1);
        setRedrawCanvasTrigger(prev => prev + 1);
    };

    // Freeze state
    wbService.onFreeze = (frozen) => {
        setIsFrozen(frozen);
    };

    // Stopwatch sync
    wbService.onStopwatchSync = (data) => {
        setStopwatchElapsedTime(data.elapsedTime);
        setStopwatchIsRunning(data.isRunning);
    };

    // Feedback and waiting messages
    wbService.onFeedbackMessage = (data) => {
        setFeedbackMessage(data.text || '');
        if (data.text) {
            setTimeout(() => setFeedbackMessage(''), 3000);
        }
    };

    wbService.onWaitingMessage = (data) => {
        setWaitingMessage(data.text || '');
        if (data.text) {
            setTimeout(() => setWaitingMessage(''), 5000);
        }
    };

    // Background Music (synced from instructor) - Attendee ALWAYS follows instructor
    wbService.onBackgroundMusic = (data) => {
        console.log('[AttendeeSession] 🎵 ===== BACKGROUND MUSIC SYNC START =====');
        console.log('[AttendeeSession] 🎵 Instructor command:', data);

        if (data.playing && data.musicUrl) {
            // PLAY - Follow instructor immediately
            console.log('[AttendeeSession] 🎵 [PLAY] Playing:', data.musicUrl);
            setSelectedMusic(data.musicId);
            setBackgroundMusicPlaying(true);
            setMusicVolume(data.volume || 0.5);

            if (!audioRef.current) {
                console.error('[AttendeeSession] ❌ [PLAY] audioRef is NULL!');
                return;
            }

            audioRef.current.src = data.musicUrl;
            audioRef.current.volume = data.volume || 0.5;
            audioRef.current.loop = true;
            audioRef.current.currentTime = 0;

            audioRef.current.play()
                .then(() => {
                    console.log('[AttendeeSession] ✅ [PLAY] Audio NOW playing on attendee');
                })
                .catch(err => {
                    console.error('[AttendeeSession] ❌ [PLAY] Error:', err.message);
                });
        } else if (!data.playing) {
            // STOP - Follow instructor immediately
            console.log('[AttendeeSession] 🎵 [STOP] Stopping music');
            setBackgroundMusicPlaying(false);
            setSelectedMusic(null);

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                console.log('[AttendeeSession] ✅ [STOP] Audio NOW stopped on attendee');
            }
        } else {
            console.warn('[AttendeeSession] ⚠️ Invalid data:', data);
        }
        console.log('[AttendeeSession] 🎵 ===== BACKGROUND MUSIC SYNC COMPLETE =====');
    };

    // Background Music Volume Sync - Follow instructor immediately
    wbService.onBackgroundMusicVolume = (data) => {
        console.log('[AttendeeSession] 🔊 [VOLUME SYNC] Instructor volume:', data.volume);

        setMusicVolume(data.volume);

        if (audioRef.current) {
            audioRef.current.volume = data.volume;
            console.log('[AttendeeSession] ✅ [VOLUME SYNC] Attendee volume NOW:', audioRef.current.volume);
        } else {
            console.warn('[AttendeeSession] ⚠️ [VOLUME SYNC] audioRef not available');
        }
    };

    // Prompt Meter Sync (from instructor)
    wbService.onPromptMeterUpdate = (data) => {
        console.log('[AttendeeSession] Prompt meter update:', data);
        setPromptMeter(data.value !== undefined ? data.value : data);
    };

    // Reinforcement Meter Sync (from instructor)
    wbService.onReinforcementMeterUpdate = (data) => {
        console.log('[AttendeeSession] Reinforcement meter update:', data);
        setReinforcementMeter(data.value !== undefined ? data.value : data);
    };

    // Bucket Color Sync (from instructor)
    wbService.onBucketColorChange = (data) => {
        console.log('[AttendeeSession] Bucket color update:', data);
        setBucketColor(data.color || '#6D5A3F');
    };

    // Comments from instructor
    wbService.onCommentUpdate = (data) => {
        console.log('[AttendeeSession] Comment received:', data);
        const normalized = {
            text: data.text || data.message || '',
            type: data.type || 'instructor',
            timestamp: data.timestamp || new Date().toISOString()
        };
        setTrainerComments(prev => [...prev, normalized]);
    };

    // Comments panel toggle from instructor
    wbService.onCommentsToggle = (data) => {
        console.log('[AttendeeSession] Comments panel toggled:', data);
        setIsCommentsOpen(data.visible || false);
    };

    console.log('[AttendeeSession] ✅ All whiteboard listeners setup complete');
    console.log('[AttendeeSession] ✅ Registered callbacks:', {
        onBackgroundMusic: !!wbService.onBackgroundMusic,
        onBackgroundMusicVolume: !!wbService.onBackgroundMusicVolume,
        onToolAccess: !!wbService.onToolAccess,
        // onBucketAdded handled by Whiteboard.jsx
        onAnimationPopped: !!wbService.onAnimationPopped,
        onPromptMeterUpdate: !!wbService.onPromptMeterUpdate
    });
};

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

/**
 * Initialize WebRTC and Whiteboard services for attendee
 */
export const initializeAttendeeServices = async (WS_BASE_URL, sessionId, role, state) => {
    const { isInitializingRef, setWhiteboardService, setToolsService, setWebRTC } = state;

    if (isInitializingRef.current) {
        console.log('[AttendeeSession] Already initializing, skipping');
        return;
    }
    isInitializingRef.current = true;

    try {
        // Initialize Whiteboard
        const wbService = new WhiteboardService(WS_BASE_URL, sessionId, role);
        wbService.initialize();
        setWhiteboardService(wbService);
        setupAttendeeWhiteboardListeners(wbService, state);

        const tbService = new WhiteboardToolsService(wbService);
        setToolsService(tbService);

        // Initialize Video Conference
        const videoService = await setupAttendeeVideoService(WS_BASE_URL, sessionId, role, state);
        setWebRTC(videoService);
    } catch (error) {
        console.error('[AttendeeSession] Initialization error:', error);
        toast.error('Failed to initialize session');
        isInitializingRef.current = false;
        throw error;
    }
};

/**
 * Setup Video Conference Service for attendee
 */
const setupAttendeeVideoService = async (WS_BASE_URL, sessionId, role, state) => {
    const { setLocalStream, setRemoteStream, setConnectionStatus, setInstructorJoined, setPromptText, setPromptMeter, setReinforcementMeter } = state;

    const videoService = new VideoConferenceService(WS_BASE_URL, sessionId, role);

    videoService.onLocalStream = (stream) => {
        console.log('[AttendeeSession] Local stream initialized');
        setLocalStream(stream);
        setConnectionStatus('Waiting for instructor...');
    };

    videoService.onRemoteStream = (stream) => {
        console.log('[AttendeeSession] Received remote stream');
        setRemoteStream(stream);
        setConnectionStatus('Connected');
        setInstructorJoined(true);
    };

    videoService.onConnectionStateChange = (state) => {
        console.log('[AttendeeSession] Connection state:', state);
        const statusMap = {
            'new': 'connecting',
            'connecting': 'connecting',
            'connected': 'connected',
            'disconnected': 'disconnected',
            'failed': 'failed',
            'closed': 'disconnected'
        };
        setConnectionStatus(statusMap[state] || state);

        if (state === 'disconnected' || state === 'closed') {
            setInstructorJoined(false);
        }
    };

    videoService.onError = (error) => {
        console.error('[AttendeeSession] Video error:', error);
        toast.error(`Video error: ${error.message}`);
    };

    // Prompt text from instructor (for all attendee types)
    videoService.onPromptText = (data) => {
        console.log('[AttendeeSession] Prompt text received:', data);
        setPromptText(data.text || data);
    };

    // Prompt meter updates from instructor
    videoService.onPromptMeterUpdate = (value) => {
        console.log('[AttendeeSession] Prompt meter update:', value);
        setPromptMeter(value);
    };

    // Reinforcement meter updates from instructor
    videoService.onReinforcementMeterUpdate = (value) => {
        console.log('[AttendeeSession] Reinforcement meter update:', value);
        setReinforcementMeter(value);
    };

    await videoService.initialize();
    return videoService;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format milliseconds to MM:SS
 */
export const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
        display: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
};

/**
 * Cleanup all session resources
 */
export const cleanupAttendeeSession = (webRTC, whiteboardService, toolsService, isInitializingRef) => {
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
    if (isInitializingRef) {
        isInitializingRef.current = false;
    }
};

/**
 * Toggle microphone
 */
export const toggleMicrophone = (webRTC, setMicEnabled) => {
    if (webRTC) {
        const newState = webRTC.toggleMicrophone();
        setMicEnabled(newState);
    }
};

/**
 * Toggle camera
 */
export const toggleCamera = (webRTC, setCameraEnabled) => {
    if (webRTC) {
        const newState = webRTC.toggleCamera();
        setCameraEnabled(newState);
    }
};

/**
 * Send leave notification
 */
export const sendLeaveNotification = (webRTC) => {
    if (webRTC && webRTC.isConnected) {
        try {
            webRTC.sendMessage({
                type: 'attendee_leaving',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('[AttendeeSession] Error sending leave notification:', error);
        }
    }
};

/**
 * Handle animation pop with sound
 */
export const createAnimationPopHandler = (floatingAnimations, setFloatingAnimations, whiteboardService) => {
    return (animationId, poppedLeft, poppedTop) => {
        const animation = floatingAnimations.find(a => a.id === animationId);
        if (animation) {
            // Play sound locally
            playPopSound(animation.type);

            // Broadcast pop event to all participants with animation type
            if (whiteboardService) {
                whiteboardService.send('animation_popped', {
                    animationId,
                    animationType: animation.type,
                    poppedLeft,
                    poppedTop,
                    timestamp: Date.now()
                });
            }
        }

        // Update local state
        setFloatingAnimations(prev =>
            prev.map(anim =>
                anim.id === animationId
                    ? { ...anim, popped: true, poppedLeft, poppedTop }
                    : anim
            )
        );
    };
};

/**
 * Create comment send handler (shared utility for all attendee types)
 * Sends comments through whiteboardService with proper debouncing
 */
export const createCommentSendHandler = (whiteboardService, sessionType = 'client') => {
    const debounceTimerRef = { current: null };

    const sendComment = (message) => {
        if (!message.trim() || !whiteboardService) return;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            whiteboardService.send('comment_update', {
                text: message.trim(),
                type: sessionType,
                timestamp: new Date().toISOString(),
                sender: sessionType
            });
            debounceTimerRef.current = null;
        }, 300); // 300ms debounce
    };

    const flushComment = (message) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (message.trim() && whiteboardService) {
            whiteboardService.send('comment_update', {
                text: message.trim(),
                type: sessionType,
                timestamp: new Date().toISOString(),
                sender: sessionType
            });
        }
    };

    const cleanup = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
    };

    return { sendComment, flushComment, cleanup, debounceTimerRef };
};

/**
 * Setup comment listeners (shared utility for all attendee types)
 * Handles incoming comments and toggle events from instructor
 */
export const setupAttendeeCommentListeners = (whiteboardService, setTrainerComments, setIsCommentsOpen) => {
    if (!whiteboardService) return;

    // Listen for incoming comments from instructor/coach
    whiteboardService.onCommentUpdate = (data) => {
        console.log('[AttendeeSession] Comment received:', data);
        const normalized = {
            text: data.text || data.message || '',
            type: data.type || data.sender || 'instructor',
            timestamp: data.timestamp || new Date().toISOString()
        };

        // Add to comments array (support both string and array)
        setTrainerComments(prev => {
            const comments = Array.isArray(prev) ? prev : [];
            return [...comments, normalized];
        });
    };

    // Listen for comments panel toggle from instructor
    whiteboardService.onCommentsToggle = (data) => {
        console.log('[AttendeeSession] Comments panel toggled:', data);
        setIsCommentsOpen(data.visible || false);
    };

    // Return cleanup function
    return () => {
        if (whiteboardService) {
            whiteboardService.onCommentUpdate = null;
            whiteboardService.onCommentsToggle = null;
        }
    };
};

