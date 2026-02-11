// useInstructorSessionState.js
// Custom hook to manage all instructor session state variables
// Used by both TrainerSession and CoachSession

import { useState, useRef } from 'react';

/**
 * Custom hook for managing instructor session state
 * Consolidates ~35 state variables and refs into one reusable hook
 * 
 * @param {string} role - 'trainer' or 'coach'
 * @returns {Object} - All state variables and setters
 */
export const useInstructorSessionState = (role = 'trainer') => {
    // Refs
    const audioRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const whiteboardCanvasRef = useRef(null);
    const timersRef = useRef(new Map());
    const stopwatchesRef = useRef(new Map());
    const lastSyncTimeRef = useRef(0);
    const mediaWasVisibleRef = useRef(false);
    const headerTimeoutRef = useRef(null);
    const activeFloatingAnimationTypesRef = useRef(new Set());
    const isInitializingRef = useRef(false);
    const restrictionAlertShownRef = useRef(false);
    const connectedRef = useRef(false); // learnerConnectedRef or clientConnectedRef

    // Core services
    const [videoService, setVideoService] = useState(null); // learnerRTC or clientRTC
    const [whiteboardService, setWhiteboardService] = useState(null);
    const [toolsService, setToolsService] = useState(null);

    // Media streams
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);

    // Session info
    const [sessionInfo, setSessionInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [timeLeft, setTimeLeft] = useState(null);

    // Messages and feedback
    const [sessionNotes, setSessionNotes] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [waitingMessage, setWaitingMessage] = useState('');

    // Canvas and whiteboard
    const [floatingAnimations, setFloatingAnimations] = useState([]);
    const [canvasItems, setCanvasItems] = useState([]);
    const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]);
    const [buckets, setBuckets] = useState([]);
    const [bucketColor, setBucketColor] = useState('#8B6F47');
    const [youtubePopups, setYoutubePopups] = useState([]);

    // Drawing tools
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    const [toolActive, setToolActive] = useState(false);
    const [eraserActive, setEraserActive] = useState(false);
    const [eraseAllActive, setEraseAllActive] = useState(false);

    // Triggers
    const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
    const [erasePenTrigger, setErasePenTrigger] = useState(0);
    const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

    // Tool access
    const [toolAccess, setToolAccess] = useState({ select: false, drag: false });

    // UI controls
    const [showExercise, setShowExercise] = useState(false);
    const [exerciseData, setExerciseData] = useState({ question: '', answer: '' });
    const [showStopwatch, setShowStopwatch] = useState(false);
    const [activeIcons, setActiveIcons] = useState({});
    const [showInfoBar, setShowInfoBar] = useState(true);
    const [showHeader, setShowHeader] = useState(true);
    const [isFrozen, setIsFrozen] = useState(false);

    // Music
    const [backgroundMusicPlaying, setBackgroundMusicPlaying] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState(null);
    const [musicVolume, setMusicVolume] = useState(0.5);

    // Learning content
    const [learningContentSearch, setLearningContentSearch] = useState('');
    const [databaseSearchResults, setDatabaseSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Learning program (trainer) or goals (coach)
    const [filteredLearningGoals, setFilteredLearningGoals] = useState([]);
    const [learningGoalsSearch, setLearningGoalsSearch] = useState('');
    const [databaseGoalsSearchResults, setDatabaseGoalsSearchResults] = useState([]);
    const [isSearchingGoals, setIsSearchingGoals] = useState(false);
    const [selectedPromptLevel, setSelectedPromptLevel] = useState(null);
    const [selectedReinforcementLevel, setSelectedReinforcementLevel] = useState(null);
    const [selectedProgramId, setSelectedProgramId] = useState(null);

    // Role-specific state
    // Trainer-specific
    const [observerRTC, setObserverRTC] = useState(null);
    const [recordingService, setRecordingService] = useState(null);
    const [showObserverModal, setShowObserverModal] = useState(false);
    const [observerData, setObserverData] = useState(null);
    const observerInitializedRef = useRef(false);

    // Coach-specific
    const [learningGoals, setLearningGoals] = useState([]);

    return {
        // Refs
        audioRef,
        remoteVideoRef,
        whiteboardCanvasRef,
        timersRef,
        stopwatchesRef,
        lastSyncTimeRef,
        mediaWasVisibleRef,
        headerTimeoutRef,
        activeFloatingAnimationTypesRef,
        isInitializingRef,
        restrictionAlertShownRef,
        connectedRef,
        observerInitializedRef,

        // Services
        videoService,
        setVideoService,
        whiteboardService,
        setWhiteboardService,
        toolsService,
        setToolsService,
        recordingService,
        setRecordingService,
        observerRTC,
        setObserverRTC,

        // Media
        localStream,
        setLocalStream,
        remoteStream,
        setRemoteStream,
        micEnabled,
        setMicEnabled,
        cameraEnabled,
        setCameraEnabled,

        // Session
        sessionInfo,
        setSessionInfo,
        loading,
        setLoading,
        connectionStatus,
        setConnectionStatus,
        timeLeft,
        setTimeLeft,

        // Messages
        sessionNotes,
        setSessionNotes,
        feedbackMessage,
        setFeedbackMessage,
        waitingMessage,
        setWaitingMessage,

        // Canvas
        floatingAnimations,
        setFloatingAnimations,
        canvasItems,
        setCanvasItems,
        remoteSelectedItemIds,
        setRemoteSelectedItemIds,
        buckets,
        setBuckets,
        bucketColor,
        setBucketColor,
        youtubePopups,
        setYoutubePopups,

        // Tools
        tool,
        setTool,
        color,
        setColor,
        lineWidth,
        setLineWidth,
        toolActive,
        setToolActive,
        eraserActive,
        setEraserActive,
        eraseAllActive,
        setEraseAllActive,
        toolAccess,
        setToolAccess,

        // Triggers
        clearCanvasTrigger,
        setClearCanvasTrigger,
        erasePenTrigger,
        setErasePenTrigger,
        redrawCanvasTrigger,
        setRedrawCanvasTrigger,

        // UI
        showExercise,
        setShowExercise,
        exerciseData,
        setExerciseData,
        showStopwatch,
        setShowStopwatch,
        activeIcons,
        setActiveIcons,
        showInfoBar,
        setShowInfoBar,
        showHeader,
        setShowHeader,
        isFrozen,
        setIsFrozen,
        showObserverModal,
        setShowObserverModal,
        observerData,
        setObserverData,

        // Music
        backgroundMusicPlaying,
        setBackgroundMusicPlaying,
        selectedMusic,
        setSelectedMusic,
        musicVolume,
        setMusicVolume,

        // Learning content
        learningContentSearch,
        setLearningContentSearch,
        databaseSearchResults,
        setDatabaseSearchResults,
        isSearching,
        setIsSearching,

        // Learning program/goals
        filteredLearningGoals,
        setFilteredLearningGoals,
        learningGoalsSearch,
        setLearningGoalsSearch,
        databaseGoalsSearchResults,
        setDatabaseGoalsSearchResults,
        isSearchingGoals,
        setIsSearchingGoals,
        selectedPromptLevel,
        setSelectedPromptLevel,
        selectedReinforcementLevel,
        setSelectedReinforcementLevel,
        selectedProgramId,
        setSelectedProgramId,
        learningGoals,
        setLearningGoals,
    };
};

export default useInstructorSessionState;
