// instructorSession.js
// ============================================================================
// 🔹 Purpose: Shared state and utilities for Instructor Session Pages
// 🔸 Pages: TrainerSession (optional), CoachSession (optional)
// 🔹 Role: Common logic for instructors who control and manage sessions
// 
// 📋 MIGRATION STATUS:
// ℹ️ TrainerSession - Currently uses sessionUtils (2044 lines, well-structured)
// ℹ️ CoachSession - Currently uses sessionUtils (1677 lines, well-structured)
// 
// 💡 NOTE:
// These utilities are available for future refactoring. TrainerSession and CoachSession
// are already well-structured with their own state management using sessionUtils.
// Migration is optional and can be done gradually as needed.
// 
// 🎯 USAGE (when ready to migrate):
// import { 
//   useInstructorSessionState,
//   initializeInstructorServices,
//   cleanupInstructorSession,
//   autoSaveSessionNotes
// } from '../../utils/instructorSession';
// 
// const MyInstructorComponent = () => {
//   const state = useInstructorSessionState({ isDualRTC: true }); // for Trainer
//   // const state = useInstructorSessionState({ isDualRTC: false }); // for Coach
//   // Use state.primaryRTC, state.whiteboardService, etc.
// };
// ============================================================================

import { useState, useRef } from 'react';

/**
 * Custom hook: Manage instructor session state
 * Used by: TrainerSession, CoachSession
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.isDualRTC - True for Trainer (learner + observer), false for Coach (client only)
 * @returns {Object} - All state variables and setters
 */
export const useInstructorSessionState = (options = {}) => {
    const { isDualRTC = false } = options;

    // Service instances
    const [primaryRTC, setPrimaryRTC] = useState(null); // learnerRTC for Trainer, webRTC for Coach
    const [observerRTC, setObserverRTC] = useState(null); // Only for Trainer (dual RTC)
    const [whiteboardService, setWhiteboardService] = useState(null);
    const [toolsService, setToolsService] = useState(null);
    const [recordingService, setRecordingService] = useState(null); // JanusRecordingService

    // Initialization guards
    const isInitializingRef = useRef(false);
    const observerInitializedRef = useRef(false);
    const activeFloatingAnimationTypesRef = useRef(new Set());

    // Media streams
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const remoteVideoRef = useRef(null);
    const participantConnectedRef = useRef(false); // learner/client connected

    // Video position and size (for moveable video feed)
    const [videoPosition, setVideoPosition] = useState({ x: 20, y: 20 });
    const [videoSize, setVideoSize] = useState({ width: 320, height: 240 });

    // Media controls
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);

    // Session metadata
    const [sessionInfo, setSessionInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [timeLeft, setTimeLeft] = useState(null);
    const [timeExpired, setTimeExpired] = useState(false);

    // Session notes (auto-save functionality)
    const [sessionNotes, setSessionNotes] = useState('');
    const autoSaveTimerRef = useRef(null);
    const restrictionAlertShownRef = useRef(false);

    // Feedback and waiting messages (displayed on whiteboard)
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [waitingMessage, setWaitingMessage] = useState('');
    const [floatingAnimations, setFloatingAnimations] = useState([]);

    // Background music
    const [backgroundMusicPlaying, setBackgroundMusicPlaying] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [musicVolume, setMusicVolume] = useState(0.5);
    const audioRef = useRef(null);

    // Learning content/programs
    const [learningContentSearch, setLearningContentSearch] = useState('');
    const [databaseSearchResults, setDatabaseSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [defaultContent, setDefaultContent] = useState([]);
    const [additionalContentSearch, setAdditionalContentSearch] = useState('');
    const [additionalContentResults, setAdditionalContentResults] = useState([]);

    // Learning goals (Coach specific, but shared state)
    const [learningGoalsSearch, setLearningGoalsSearch] = useState('');
    const [allLearningGoals, setAllLearningGoals] = useState([]);
    const [filteredLearningGoals, setFilteredLearningGoals] = useState([]);
    const [selectedGoalId, setSelectedGoalId] = useState(null);

    // Prompt/Reinforcement meters
    const [selectedPromptLevel, setSelectedPromptLevel] = useState(null);
    const [selectedReinforcementLevel, setSelectedReinforcementLevel] = useState(null);
    const [selectedProgramId, setSelectedProgramId] = useState(null);

    // Observer modal (Trainer only)
    const [showObserverModal, setShowObserverModal] = useState(false);
    const [observerData, setObserverData] = useState(null);

    // Whiteboard state
    const [canvasItems, setCanvasItems] = useState([]);
    const [activeTool, setActiveTool] = useState(null);
    const [keyboardMode, setKeyboardMode] = useState(false);
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

    // Canvas clearing triggers
    const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
    const [erasePenTrigger, setErasePenTrigger] = useState(0);
    const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

    // Drawing tools
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    const [buckets, setBuckets] = useState([]);
    const [bucketColor, setBucketColor] = useState('#6D5A3F');
    const [toolActive, setToolActive] = useState(false);
    const [eraserActive, setEraserActive] = useState(false);
    const [eraseAllActive, setEraseAllActive] = useState(false);

    // YouTube popups
    const [youtubePopups, setYoutubePopups] = useState([]);

    // Text tool state
    const [textBoxes, setTextBoxes] = useState([]);
    const [activeTextBoxId, setActiveTextBoxId] = useState(null);
    const [textSize, setTextSize] = useState(16);
    const [showTextSizeSlider, setShowTextSizeSlider] = useState(false);

    // Tool access control for participant
    const [participantToolAccess, setParticipantToolAccess] = useState({
        select: false,
        drag: false,
        keyboard: false
    });

    // Exercise state
    const [showExercise, setShowExercise] = useState(false);

    // Stopwatch
    const [showStopwatch, setShowStopwatch] = useState(false);
    const lastSyncTimeRef = useRef(0);
    const mediaWasVisibleRef = useRef(false);

    // Timers and stopwatches on whiteboard
    const timersRef = useRef(new Map());
    const stopwatchesRef = useRef(new Map());

    // Drawer states (mobile/tablet)
    const [drawerOpen, setDrawerOpen] = useState({
        video: true,
        program: false,
        content: false
    });

    // Messages (Coach specific, but shared state)
    const [textMessages, setTextMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');

    return {
        // Services
        primaryRTC, setPrimaryRTC,
        observerRTC, setObserverRTC,
        whiteboardService, setWhiteboardService,
        toolsService, setToolsService,
        recordingService, setRecordingService,

        // Refs
        isInitializingRef,
        observerInitializedRef,
        activeFloatingAnimationTypesRef,
        remoteVideoRef,
        participantConnectedRef,
        autoSaveTimerRef,
        restrictionAlertShownRef,
        audioRef,
        headerTimeoutRef,
        lastSyncTimeRef,
        mediaWasVisibleRef,
        timersRef,
        stopwatchesRef,

        // Media
        localStream, setLocalStream,
        remoteStream, setRemoteStream,
        videoPosition, setVideoPosition,
        videoSize, setVideoSize,
        micEnabled, setMicEnabled,
        cameraEnabled, setCameraEnabled,

        // Session
        sessionInfo, setSessionInfo,
        loading, setLoading,
        connectionStatus, setConnectionStatus,
        timeLeft, setTimeLeft,
        timeExpired, setTimeExpired,
        sessionNotes, setSessionNotes,

        // Messages
        feedbackMessage, setFeedbackMessage,
        waitingMessage, setWaitingMessage,
        floatingAnimations, setFloatingAnimations,
        textMessages, setTextMessages,
        currentMessage, setCurrentMessage,

        // Background music
        backgroundMusicPlaying, setBackgroundMusicPlaying,
        selectedMusic, setSelectedMusic,
        musicVolume, setMusicVolume,

        // Learning content
        learningContentSearch, setLearningContentSearch,
        databaseSearchResults, setDatabaseSearchResults,
        isSearching, setIsSearching,
        defaultContent, setDefaultContent,
        additionalContentSearch, setAdditionalContentSearch,
        additionalContentResults, setAdditionalContentResults,

        // Learning goals
        learningGoalsSearch, setLearningGoalsSearch,
        allLearningGoals, setAllLearningGoals,
        filteredLearningGoals, setFilteredLearningGoals,
        selectedGoalId, setSelectedGoalId,

        // Meters
        selectedPromptLevel, setSelectedPromptLevel,
        selectedReinforcementLevel, setSelectedReinforcementLevel,
        selectedProgramId, setSelectedProgramId,

        // Observer (Trainer only)
        showObserverModal, setShowObserverModal,
        observerData, setObserverData,

        // Whiteboard
        canvasItems, setCanvasItems,
        activeTool, setActiveTool,
        keyboardMode, setKeyboardMode,
        keyboardText, setKeyboardText,
        keyboardPosition, setKeyboardPosition,
        remoteSelectedItemIds, setRemoteSelectedItemIds,

        // UI
        isLeftSidebarOpen, setIsLeftSidebarOpen,
        isRightSidebarOpen, setIsRightSidebarOpen,
        activeIcons, setActiveIcons,
        showInfoBar, setShowInfoBar,
        isFrozen, setIsFrozen,
        showHeader, setShowHeader,
        drawerOpen, setDrawerOpen,

        // Canvas triggers
        clearCanvasTrigger, setClearCanvasTrigger,
        erasePenTrigger, setErasePenTrigger,
        redrawCanvasTrigger, setRedrawCanvasTrigger,

        // Drawing tools
        tool, setTool,
        color, setColor,
        lineWidth, setLineWidth,
        buckets, setBuckets,
        bucketColor, setBucketColor,
        toolActive, setToolActive,
        eraserActive, setEraserActive,
        eraseAllActive, setEraseAllActive,

        // YouTube
        youtubePopups, setYoutubePopups,

        // Text tool
        textBoxes, setTextBoxes,
        activeTextBoxId, setActiveTextBoxId,
        textSize, setTextSize,
        showTextSizeSlider, setShowTextSizeSlider,

        // Tool access
        participantToolAccess, setParticipantToolAccess,

        // Exercise
        showExercise, setShowExercise,

        // Stopwatch
        showStopwatch, setShowStopwatch,

        // Config
        isDualRTC
    };
};

/**
 * Initialize instructor whiteboard listeners
 * Handles incoming whiteboard events from participant
 * 
 * @param {Object} whiteboardService - WhiteboardService instance
 * @param {Object} state - State object from useInstructorSessionState
 * @param {Object} callbacks - Event handler callbacks
 */
export const setupInstructorWhiteboardListeners = (whiteboardService, state, callbacks = {}) => {
    if (!whiteboardService) return;

    const {
        setRemoteStream,
        setConnectionStatus,
        setCanvasItems,
        setRemoteSelectedItemIds,
        setKeyboardText,
        setKeyboardPosition,
        setSessionNotes,
        participantConnectedRef,
        remoteVideoRef
    } = state;

    const {
        onParticipantJoined,
        onOffer,
        onAnswer,
        onIceCandidate,
        onCanvasUpdate,
        onItemsSelected,
        onKeyboardUpdate,
        onSessionNotesUpdate,
        onCustomEvent
    } = callbacks;

    // Participant joined
    whiteboardService.on('participant_joined', (data) => {
        console.log('[Instructor] Participant joined:', data);
        participantConnectedRef.current = true;
        setConnectionStatus('Participant Connected');
        if (onParticipantJoined) onParticipantJoined(data);
    });

    // WebRTC signaling
    whiteboardService.on('offer', (data) => {
        console.log('[Instructor] Received offer from participant');
        if (onOffer) onOffer(data);
    });

    whiteboardService.on('answer', (data) => {
        console.log('[Instructor] Received answer from participant');
        if (onAnswer) onAnswer(data);
    });

    whiteboardService.on('ice-candidate', (data) => {
        console.log('[Instructor] Received ICE candidate from participant');
        if (onIceCandidate) onIceCandidate(data);
    });

    // Participant's remote stream
    whiteboardService.on('participant_stream', (stream) => {
        console.log('[Instructor] Received participant video stream');
        setRemoteStream(stream);
        if (remoteVideoRef && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
        }
    });

    // Canvas updates from participant
    whiteboardService.on('canvas_update', (data) => {
        if (data && data.items) {
            setCanvasItems(data.items);
            if (onCanvasUpdate) onCanvasUpdate(data);
        }
    });

    // Participant item selection
    whiteboardService.on('items_selected', (data) => {
        if (data && Array.isArray(data.itemIds)) {
            setRemoteSelectedItemIds(data.itemIds);
            if (onItemsSelected) onItemsSelected(data);
        }
    });

    // Keyboard updates from participant
    whiteboardService.on('keyboard_update', (data) => {
        if (data) {
            setKeyboardText(data.text || '');
            if (data.position) {
                setKeyboardPosition(data.position);
            }
            if (onKeyboardUpdate) onKeyboardUpdate(data);
        }
    });

    // Session notes update from participant
    whiteboardService.on('session_notes_update', (data) => {
        if (data && data.notes) {
            setSessionNotes(data.notes);
            if (onSessionNotesUpdate) onSessionNotesUpdate(data);
        }
    });

    // Custom events
    if (onCustomEvent) {
        whiteboardService.onAny((eventType, data) => {
            onCustomEvent(eventType, data);
        });
    }
};

/**
 * Initialize instructor video conference service
 * Sets up WebRTC for instructor (with optional dual RTC for Trainer)
 * 
 * @param {string} sessionId - Session ID
 * @param {string} WS_BASE_URL - WebSocket base URL
 * @param {Object} state - State from useInstructorSessionState
 * @param {Object} callbacks - Event callbacks
 */
export const initializeInstructorVideoService = async (sessionId, WS_BASE_URL, state, callbacks = {}) => {
    const {
        primaryRTC,
        setPrimaryRTC,
        observerRTC,
        setObserverRTC,
        setLocalStream,
        setRemoteStream,
        setConnectionStatus,
        isInitializingRef,
        observerInitializedRef,
        remoteVideoRef,
        isDualRTC
    } = state;

    const {
        onLocalStream,
        onRemoteStream,
        onConnectionStateChange,
        onObserverJoined
    } = callbacks;

    // Primary RTC (learner for Trainer, client for Coach)
    if (!primaryRTC && !isInitializingRef.current) {
        isInitializingRef.current = true;

        try {
            console.log('[Instructor] Initializing primary VideoConference...');
            const roomName = `session_${sessionId}`;
            const rtcService = new VideoConferenceService(WS_BASE_URL, roomName, sessionId, 'instructor');

            rtcService.onLocalStream = (stream) => {
                console.log('[Instructor] Local stream ready:', stream);
                setLocalStream(stream);
                if (onLocalStream) onLocalStream(stream);
            };

            rtcService.onRemoteStream = (stream) => {
                console.log('[Instructor] Remote stream ready:', stream);
                setRemoteStream(stream);
                if (remoteVideoRef && remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                }
                if (onRemoteStream) onRemoteStream(stream);
            };

            rtcService.onConnectionStateChange = (state) => {
                console.log('[Instructor] Primary RTC connection state:', state);
                setConnectionStatus(`Connection: ${state}`);
                if (onConnectionStateChange) onConnectionStateChange(state);
            };

            await rtcService.initialize();
            setPrimaryRTC(rtcService);
            console.log('[Instructor] ✅ Primary VideoConference initialized');
        } catch (error) {
            console.error('[Instructor] ❌ Primary VideoConference initialization failed:', error);
            setConnectionStatus('Connection Failed');
        } finally {
            isInitializingRef.current = false;
        }
    }

    // Observer RTC (Trainer only - dual RTC mode)
    if (isDualRTC && !observerRTC && !observerInitializedRef.current) {
        observerInitializedRef.current = true;

        try {
            console.log('[Trainer] Initializing observer VideoConference...');
            const observerRoomName = `session_${sessionId}_observer`;
            const observerRTCService = new VideoConferenceService(WS_BASE_URL, observerRoomName, sessionId, 'trainer');

            observerRTCService.onConnectionStateChange = (state) => {
                console.log('[Trainer] Observer RTC connection state:', state);
            };

            observerRTCService.onRemoteStream = (stream) => {
                console.log('[Trainer] Observer stream ready');
                if (onObserverJoined) onObserverJoined(stream);
            };

            await observerRTCService.initialize();
            setObserverRTC(observerRTCService);
            console.log('[Trainer] ✅ Observer VideoConference initialized');
        } catch (error) {
            console.error('[Trainer] ❌ Observer VideoConference initialization failed:', error);
        }
    }
};

/**
 * Initialize both whiteboard and video services
 * Convenience wrapper for instructor session initialization
 * 
 * @param {string} sessionId - Session ID
 * @param {string} WS_BASE_URL - WebSocket base URL
 * @param {Object} state - State from useInstructorSessionState
 * @param {Object} callbacks - Event callbacks
 */
export const initializeInstructorServices = async (sessionId, WS_BASE_URL, state, callbacks = {}) => {
    const { whiteboardService, setWhiteboardService, setToolsService } = state;

    // Initialize whiteboard first
    if (!whiteboardService) {
        try {
            const WhiteboardService = (await import('../api/services/whiteboardService')).default;
            const WhiteboardToolsService = (await import('../api/services/WhiteboardToolsService')).default;

            const wbService = new WhiteboardService(WS_BASE_URL, sessionId, 'instructor');
            const toolsInstance = new WhiteboardToolsService();

            await wbService.connect();
            setWhiteboardService(wbService);
            setToolsService(toolsInstance);

            console.log('[Instructor] ✅ Whiteboard and Tools services initialized');

            // Setup listeners
            setupInstructorWhiteboardListeners(wbService, state, callbacks);
        } catch (error) {
            console.error('[Instructor] ❌ Whiteboard initialization failed:', error);
        }
    }

    // Initialize video services
    await initializeInstructorVideoService(sessionId, WS_BASE_URL, state, callbacks);
};

/**
 * Auto-save session notes with debouncing
 * Saves notes to backend every 2 seconds
 * 
 * @param {string} sessionId - Session ID
 * @param {string} notes - Current notes text
 * @param {Object} autoSaveTimerRef - useRef for timer
 * @param {Function} sessionNotesService - Session notes API service
 */
export const autoSaveSessionNotes = (sessionId, notes, autoSaveTimerRef, sessionNotesService) => {
    if (!sessionId || !sessionNotesService) return;

    // Ensure notes is a string (prevent circular structure errors)
    const notesText = typeof notes === 'string' ? notes : '';

    // Clear existing timer
    if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for 2 seconds
    autoSaveTimerRef.current = setTimeout(async () => {
        try {
            await sessionNotesService.saveNotes(sessionId, notesText);
            console.log('[Instructor] ✅ Session notes auto-saved');
        } catch (error) {
            console.error('[Instructor] ❌ Auto-save session notes failed:', error);
        }
    }, 2000);
};

/**
 * Cleanup instructor session resources
 * Called on component unmount or session end
 * 
 * @param {Object} state - State from useInstructorSessionState
 */
export const cleanupInstructorSession = (state) => {
    const {
        primaryRTC,
        observerRTC,
        whiteboardService,
        toolsService,
        localStream,
        remoteStream,
        autoSaveTimerRef,
        audioRef
    } = state;

    console.log('[Instructor] Cleaning up session resources...');

    // Stop media streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }

    // Close RTC connections
    if (primaryRTC) {
        primaryRTC.close();
    }
    if (observerRTC) {
        observerRTC.close();
    }

    // Close whiteboard connection
    if (whiteboardService) {
        whiteboardService.disconnect();
    }

    // Cleanup tools
    if (toolsService) {
        toolsService.cleanup();
    }

    // Stop background music
    if (audioRef && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
    }

    // Clear auto-save timer
    if (autoSaveTimerRef && autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
    }

    console.log('[Instructor] ✅ Cleanup complete');
};

/**
 * Format time remaining in session
 * Converts seconds to MM:SS format
 * 
 * @param {number} seconds - Seconds remaining
 * @returns {string} - Formatted time string
 */
export const formatTimeRemaining = (seconds) => {
    if (seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Toggle participant tool access
 * Grant or revoke tools for participant
 * 
 * @param {Object} whiteboardService - WhiteboardService instance
 * @param {string} toolName - Tool name ('select', 'drag', 'keyboard')
 * @param {boolean} enabled - Enable or disable
 * @param {Function} setParticipantToolAccess - State setter
 */
export const toggleParticipantToolAccess = (whiteboardService, toolName, enabled, setParticipantToolAccess) => {
    if (!whiteboardService) return;

    setParticipantToolAccess(prev => ({
        ...prev,
        [toolName]: enabled
    }));

    whiteboardService.send('tool_access_update', {
        toolName,
        enabled
    });

    console.log(`[Instructor] Participant tool access: ${toolName} = ${enabled}`);
};

/**
 * Send floating animation to participant
 * Used for reactions, feedback, celebrations
 * 
 * @param {Object} whiteboardService - WhiteboardService instance
 * @param {string} animationType - Animation type ('bubble', 'smiley', 'balloon', 'star')
 * @param {Object} activeTypesRef - useRef tracking active animations
 */
export const sendFloatingAnimation = (whiteboardService, animationType, activeTypesRef) => {
    if (!whiteboardService || activeTypesRef.current.has(animationType)) return;

    activeTypesRef.current.add(animationType);

    whiteboardService.send('floating_animation', {
        type: animationType,
        timestamp: Date.now()
    });

    console.log(`[Instructor] Sent floating animation: ${animationType}`);

    setTimeout(() => {
        activeTypesRef.current.delete(animationType);
    }, 5000);
};

/**
 * Setup listener for participant animation pop events
 * Used by: CoachSession, TrainerSession
 * Handles sound playback and animation state updates when participant pops an animation
 * 
 * @param {Object} whiteboardService - Whiteboard service instance
 * @param {Array} floatingAnimations - Current floating animations
 * @param {Function} setFloatingAnimations - State setter for floating animations
 * @param {Function} playPopSound - Function to play pop sound
 */
export const setupParticipantAnimationPopListener = (whiteboardService, floatingAnimations, setFloatingAnimations, playPopSound) => {
    if (!whiteboardService) return;

    whiteboardService.onAnimationPopped = (data) => {
        console.log('[InstructorSession] Animation popped by participant:', data);

        // Play sound on instructor side
        if (data.animationType) {
            playPopSound(data.animationType);
        }

        // Update floating animations state to show as popped
        setFloatingAnimations(prev =>
            prev.map(anim =>
                anim.id === data.animationId
                    ? { ...anim, popped: true, poppedLeft: data.poppedLeft, poppedTop: data.poppedTop }
                    : anim
            )
        );
    };
};

/**
 * Music options configuration
 * Shared across Trainer and Coach sessions
 */
export const MUSIC_OPTIONS = [
    { id: 0, name: '🎵 Music 1', url: '/music/background-music-1.mp3' },
    { id: 1, name: '🎶 Music 2', url: '/music/background-music-2.mp3' },
    { id: 2, name: '🎼 Music 3', url: '/music/background-music-3.mp3' }
];

/**
 * Setup comment listener for instructor/coach to receive comments from attendees
 * Used by: CoachSession, TrainerSession
 * Listens for incoming comments from clients/guests/learners
 * 
 * @param {Object} whiteboardService - Whiteboard service instance
 * @param {Function} setAttendeeComments - State setter for attendee comments
 */
export const setupInstructorCommentListener = (whiteboardService, setAttendeeComments) => {
    if (!whiteboardService) {
        // Return cleanup function even when whiteboardService is not available
        return () => { };
    }

    const commentCallback = (data) => {
        console.log('[InstructorSession] 💬 Comment received:', { sender: data.type, text: data.text?.substring(0, 30) });

        const normalized = {
            text: data.text || data.message || '',
            sender: data.type || data.sender || 'attendee',
            timestamp: data.timestamp || new Date().toISOString()
        };

        // Add to comments array
        setAttendeeComments(prev => {
            const comments = Array.isArray(prev) ? prev : [];
            return [...comments, normalized];
        });
    };

    whiteboardService.onCommentUpdate = commentCallback;

    // Return cleanup function
    return () => {
        if (whiteboardService) {
            whiteboardService.onCommentUpdate = null;
        }
    };
};
