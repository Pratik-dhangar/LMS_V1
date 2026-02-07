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
import { playPopSound } from './sessionUtils';

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
        stopwatchIsRunning, setStopwatchIsRunning
    };
};

// ============================================================================
// WHITEBOARD EVENT LISTENERS
// ============================================================================

/**
 * Setup all whiteboard event listeners for attendee
 */
export const setupAttendeeWhiteboardListeners = (wbService, state) => {
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
        setRedrawCanvasTrigger
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

    // Bucket management
    wbService.onBucketAdded = (data) => {
        console.log('[AttendeeSession] Bucket added:', data);
        setBuckets(prev => {
            const exists = prev.find(bucket => bucket.id === data.id);
            return exists ? prev : [...prev, data];
        });
    };

    wbService.onBucketUpdate = (data) => {
        console.log('[AttendeeSession] Bucket updated:', data);
        if (data.removed) {
            setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
        } else {
            setBuckets(prev => prev.map(bucket =>
                bucket.id === data.id ? { ...bucket, ...data } : bucket
            ));
        }
    };

    // Floating animations
    wbService.onFloatingAnimations = (data) => {
        console.log('[AttendeeSession] Floating animations received:', data);
        setFloatingAnimations(prev => [...prev, ...data.animations]);

        setTimeout(() => {
            setFloatingAnimations(prevAnims =>
                prevAnims.filter(anim => !data.animations.find(newAnim => newAnim.id === anim.id))
            );
        }, 15000);
    };

    wbService.onAnimationPopped = (data) => {
        console.log('[AttendeeSession] Animation popped:', data);
    };

    // Pen erase
    wbService.onErasePen = () => {
        setErasePenTrigger(prev => prev + 1);
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
    const { setLocalStream, setRemoteStream, setConnectionStatus, setInstructorJoined } = state;

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
            playPopSound(animation.type);
        }

        setFloatingAnimations(prev =>
            prev.map(anim =>
                anim.id === animationId
                    ? { ...anim, popped: true, poppedLeft, poppedTop }
                    : anim
            )
        );

        if (whiteboardService) {
            whiteboardService.send('animation_popped', {
                animationId,
                poppedLeft,
                poppedTop,
                timestamp: Date.now()
            });
        }
    };
};
