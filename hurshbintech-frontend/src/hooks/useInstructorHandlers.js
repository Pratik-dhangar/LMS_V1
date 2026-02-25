// useInstructorHandlers.js
// Custom hook to manage all instructor session handlers
// Used by both TrainerSession and CoachSession

import { useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import sessionNotesService from '../api/services/sessionNotesService';
import {
    toggleMicrophone as utilToggleMicrophone,
    toggleCamera as utilToggleCamera,
    toggleFreeze as utilToggleFreeze,
    toggleToolAccess as utilToggleToolAccess,
    addBucket as utilAddBucket,
    eraseAllPen as utilEraseAllPen,
    handleAnimationPop as utilHandleAnimationPop,
    handleToolClick as utilHandleToolClick,
    endSession as utilEndSession,
    createLearningContentSearchHandler,
    createContentDragPayload,
    spawnFloatingAnimation,
} from '../components/session/InstructorSessionLayout';

/**
 * Custom hook for managing instructor session handlers
 * Consolidates ~20 handler functions into one reusable hook
 * 
 * @param {Object} params - All dependencies needed for handlers
 * @returns {Object} - All handler functions
 */
export const useInstructorHandlers = ({
    role,
    sessionId,
    videoService,
    observerRTC,
    whiteboardService,
    sessionNotes,
    buckets,
    bucketColor,
    whiteboardCanvasRef,
    isFrozen,
    floatingAnimations,
    toolAccess,
    audioRef,
    musicOptions,
    selectedMusic,
    backgroundMusicPlaying,
    musicVolume,
    sessionService,
    navigate,
    cleanup,
    setMicEnabled,
    setCameraEnabled,
    setIsFrozen,
    setSessionNotes,
    setFloatingAnimations,
    setYoutubePopups,
    setExerciseData,
    setToolAccess,
    setBuckets,
    setErasePenTrigger,
    setRedrawCanvasTrigger,
    setTool,
    setActiveIcons,
    setFeedbackMessage,
    setWaitingMessage,
    setShowExercise,
    isWaitActive,
    setIsWaitActive,
    setBackgroundMusicPlaying,
    setSelectedMusic,
    setMusicVolume,
    setLearningContentSearch,
    setDatabaseSearchResults,
    setIsSearching,
    setSelectedProgramId,
    setShowHeader,
}) => {
    // ref for debounced notes autosave timer
    const notesSaveTimerRef = useRef(null);

    // Media controls
    const handleToggleMic = useCallback(() => {
        if (!videoService) return;
        utilToggleMicrophone(videoService, setMicEnabled, observerRTC ? [observerRTC] : []);
    }, [videoService, observerRTC, setMicEnabled]);

    const handleToggleCamera = useCallback(() => {
        if (!videoService) return;
        utilToggleCamera(videoService, setCameraEnabled);
    }, [videoService, setCameraEnabled]);

    const handleFreeze = useCallback(() => {
        const participantType = role === 'trainer' ? 'learner' : 'client';
        utilToggleFreeze(isFrozen, setIsFrozen, videoService, participantType);
    }, [isFrozen, setIsFrozen, videoService, role]);

    // Session management
    const handleEndSession = useCallback(async () => {
        const dashboardPath = `/${role}/dashboard`;
        await utilEndSession({
            whiteboardService,
            sessionServiceEndFn: (id, notes) => sessionService.endSession(id, notes),
            sessionId,
            notes: sessionNotes,
            cleanupFn: cleanup,
            navigate,
            dashboardPath,
            roleName: role,
        });
    }, [whiteboardService, sessionService, sessionId, sessionNotes, cleanup, navigate, role]);

    // Whiteboard tools
    const handleToolClick = useCallback((toolName) => {
        const REACTION_SVG_ASSETS = {
            smiley: { type: 'svg', src: '/reactions/realistic-pastel-smile.svg', alt: 'Smile' },
            bubble: { type: 'svg', src: '/reactions/realistic-bubble.svg', alt: 'Bubble' },
            balloon: [
                { type: 'svg', src: '/reactions/02_pastel_mint.svg', alt: 'Balloon' },
                { type: 'svg', src: '/reactions/03_pastel_brown.svg', alt: 'Balloon' },
                { type: 'svg', src: '/reactions/04_pastel_lavender.svg', alt: 'Balloon' },
                { type: 'svg', src: '/reactions/05_pastel_peach.svg', alt: 'Balloon' },
                { type: 'svg', src: '/reactions/06_pastel_coral.svg', alt: 'Balloon' },
                { type: 'svg', src: '/reactions/07_pastel_teal.svg', alt: 'Balloon' },
                { type: 'svg', src: '/reactions/08_pastel_yellow.svg', alt: 'Balloon' },
            ],
            star: { type: 'svg', src: '/reactions/realistic-oil-pastel-star.svg', alt: 'Star' },
        };

        // Create or reuse a ref for active floating animation types to prevent duplicates
        if (!handleToolClick._activeFloatingRef) handleToolClick._activeFloatingRef = new Set();

        const spawnWrapper = (type, asset) => {
            try {
                return spawnFloatingAnimation({
                    type,
                    asset,
                    activeFloatingAnimationTypesRef: handleToolClick._activeFloatingRef,
                    setFloatingAnimations,
                    whiteboardService,
                    count: 10
                });
            } catch (err) {
                console.error('[useInstructorHandlers] spawnWrapper error:', err);
                return [];
            }
        };

        utilHandleToolClick({
            tool: toolName,
            setActiveIcons,
            setFeedbackMessage,
            setWaitingMessage,
            setShowExercise,
            spawnFloatingAnimation: spawnWrapper,
            toggleLearnerToolAccess: toggleToolAccess,
            whiteboardService,
            REACTION_SVG_ASSETS,
            isWaitActive,
            setIsWaitActive,
        });
    }, [setActiveIcons, setFeedbackMessage, setWaitingMessage, setShowExercise, whiteboardService, toolAccess, isWaitActive, setIsWaitActive]);

    const handleAnimationPop = useCallback((animationId, poppedLeft, poppedTop) => {
        utilHandleAnimationPop({
            animationId,
            poppedLeft,
            poppedTop,
            floatingAnimations,
            setFloatingAnimations,
            whiteboardService,
        });
    }, [floatingAnimations, setFloatingAnimations, whiteboardService]);

    const toggleToolAccess = useCallback((toolName) => {
        utilToggleToolAccess(toolName, toolAccess, setToolAccess, whiteboardService, setTool);
    }, [toolAccess, setToolAccess, whiteboardService, setTool]);

    const addBucket = useCallback(() => {
        // Use actual canvas dimensions if available, fallback to defaults
        const canvas = whiteboardCanvasRef?.current;
        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = canvas ? canvas.width / dpr : 1200;
        const canvasHeight = canvas ? canvas.height / dpr : 600;
        utilAddBucket(buckets, setBuckets, whiteboardService, bucketColor, canvasWidth, canvasHeight, whiteboardCanvasRef);
    }, [buckets, setBuckets, whiteboardService, bucketColor, whiteboardCanvasRef]);

    const eraseAllPen = useCallback(() => {
        utilEraseAllPen({ whiteboardService, setErasePenTrigger, setRedrawCanvasTrigger });
    }, [whiteboardService, setErasePenTrigger, setRedrawCanvasTrigger]);

    // Notes
    const handleNotesChange = useCallback((newNotes) => {
        setSessionNotes(newNotes);

        // Debounced autosave: update session notes on the server after user stops typing
        try {
            if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
            notesSaveTimerRef.current = setTimeout(async () => {
                try {
                    if (sessionNotesService && sessionId) {
                        await sessionNotesService.saveNotes(sessionId, newNotes);
                        // optional: toast.success('Notes saved');
                    }
                } catch (err) {
                    console.error('[useInstructorHandlers] Failed to autosave notes:', err);
                    // If user is not authorized to update session notes on server, persist locally as a fallback
                    const status = err?.response?.status;
                    if (status === 403) {
                        try {
                            const key = `local_session_notes_${sessionId}`;
                            localStorage.setItem(key, newNotes);
                            toast.warn('Notes saved locally — server rejected save (permission).');
                        } catch (storeErr) {
                            console.error('[useInstructorHandlers] Failed to save notes locally:', storeErr);
                        }
                    }
                }
            }, 1500);
        } catch (err) {
            console.error('[useInstructorHandlers] notes autosave error:', err);
        }
    }, [setSessionNotes]);

    const handleClearNotes = useCallback(() => {
        setSessionNotes('');
    }, [setSessionNotes]);

    // Music
    const toggleBackgroundMusic = useCallback((musicId) => {
        console.log('[useInstructorHandlers] 🎵 ===== BACKGROUND MUSIC TOGGLE =====');
        console.log('[useInstructorHandlers] 🎵 Current state - playing:', backgroundMusicPlaying, 'selected:', selectedMusic);

        if (selectedMusic === musicId && backgroundMusicPlaying) {
            // STOP MUSIC
            console.log('[useInstructorHandlers] 🎵 [STOP] Stopping music ID:', musicId);
            audioRef.current?.pause();
            setBackgroundMusicPlaying(false);
            setSelectedMusic(null);

            // Broadcast STOP to all attendees
            if (whiteboardService) {
                const stopMessage = {
                    playing: false,
                    musicId: null
                };
                console.log('[useInstructorHandlers] 📡 [STOP] Broadcasting to attendees:', stopMessage);
                whiteboardService.send('background_music', stopMessage);
                console.log('[useInstructorHandlers] ✅ [STOP] Message sent to attendees');
            }
        } else {
            // PLAY MUSIC
            const music = musicOptions.find(m => m.id === musicId);
            if (music && audioRef.current) {
                console.log('[useInstructorHandlers] 🎵 [PLAY] Starting music:', music.name, '(ID:', musicId + ')');

                audioRef.current.src = music.url;
                audioRef.current.volume = musicVolume;
                audioRef.current.loop = true;
                audioRef.current.play();
                setBackgroundMusicPlaying(true);
                setSelectedMusic(musicId);

                // Broadcast PLAY to all attendees
                if (whiteboardService) {
                    const playMessage = {
                        playing: true,
                        musicId: music.id,
                        musicUrl: music.url,
                        musicName: music.name,
                        volume: musicVolume
                    };
                    console.log('[useInstructorHandlers] 📡 [PLAY] Broadcasting to attendees:', playMessage);
                    whiteboardService.send('background_music', playMessage);
                    console.log('[useInstructorHandlers] ✅ [PLAY] Message sent to attendees');
                }
            }
        }
        console.log('[useInstructorHandlers] 🎵 ===== TOGGLE COMPLETE =====');
    }, [selectedMusic, backgroundMusicPlaying, musicOptions, musicVolume, audioRef, whiteboardService, setBackgroundMusicPlaying, setSelectedMusic]);

    const handleMusicVolumeChange = useCallback((e) => {
        const volume = parseFloat(e.target.value);
        console.log('[useInstructorHandlers] 🔊 [VOLUME] Changing volume to:', volume);

        setMusicVolume(volume);
        if (audioRef.current) {
            audioRef.current.volume = volume;
            console.log('[useInstructorHandlers] 🔊 [VOLUME] Instructor audio updated to:', volume);
        }

        // Broadcast volume change to attendees (only if music is playing)
        if (whiteboardService && backgroundMusicPlaying) {
            const volumeMessage = {
                musicId: selectedMusic,
                volume: volume
            };
            console.log('[useInstructorHandlers] 📡 [VOLUME] Broadcasting to attendees:', volumeMessage);
            whiteboardService.send('background_music_volume', volumeMessage);
            console.log('[useInstructorHandlers] ✅ [VOLUME] Message sent to attendees');
        } else if (!backgroundMusicPlaying) {
            console.log('[useInstructorHandlers] 🔊 [VOLUME] Music not playing, volume broadcast skipped');
        }
    }, [audioRef, whiteboardService, backgroundMusicPlaying, selectedMusic, setMusicVolume]);

    // Learning content
    const handleLearningContentSearch = useCallback(
        createLearningContentSearchHandler(
            setLearningContentSearch,
            setDatabaseSearchResults,
            setIsSearching
        ),
        [setLearningContentSearch, setDatabaseSearchResults, setIsSearching]
    );

    const onDragStartContent = useCallback((e, content) => {
        const dragPayload = createContentDragPayload(content);
        e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    // YouTube
    const handleYoutubeDropped = useCallback((videoData) => {
        const newPopup = {
            id: Date.now(),
            videoId: videoData.videoId,
            title: videoData.title,
            position: videoData.position,
        };
        setYoutubePopups(prev => [...prev, newPopup]);
        if (whiteboardService) {
            whiteboardService.send('youtube_popup_created', {
                popupId: newPopup.id,
                videoId: newPopup.videoId,
                title: newPopup.title,
                position: newPopup.position,
                timestamp: Date.now(),
            });
        }
    }, [whiteboardService, setYoutubePopups]);

    const handleCloseYoutubePopup = useCallback((popupId) => {
        setYoutubePopups(prev => prev.filter(p => p.id !== popupId));
        if (whiteboardService) {
            whiteboardService.send('youtube_popup_closed', { popupId, timestamp: Date.now() });
        }
    }, [whiteboardService, setYoutubePopups]);

    // Exercise
    const handleExerciseSubmit = useCallback((exerciseData) => {
        if (whiteboardService) {
            // send standardized exercise update message expected by attendees
            whiteboardService.send('exercise_update', { ...exerciseData, timestamp: Date.now() });
            const participantName = role === 'trainer' ? 'learner' : 'client';
            toast.success(`Exercise sent to ${participantName}`);
        }
    }, [whiteboardService, role]);

    const handleExerciseUpdate = useCallback((exerciseData) => {
        if (whiteboardService) {
            // use the same event name attendees listen for
            whiteboardService.send('exercise_update', { ...exerciseData, timestamp: Date.now() });
        }
    }, [whiteboardService]);

    const handleExerciseDelete = useCallback(() => {
        if (whiteboardService) {
            // notify attendees that exercise is closed
            whiteboardService.send('exercise_closed', { timestamp: Date.now() });
            setExerciseData({ question: '', answer: '' });
            toast.info('Exercise deleted');
        }
    }, [whiteboardService, setExerciseData]);

    const handleExerciseAnswerChange = useCallback((answer) => {
        setExerciseData(prev => ({ ...prev, answer }));
    }, [setExerciseData]);

    // Program
    const handleProgramCheck = useCallback((programId) => {
        setSelectedProgramId(programId);
    }, [setSelectedProgramId]);

    // UI
    const handleHeaderClick = useCallback(() => {
        if (window.innerWidth < 1024) {
            setShowHeader(true);
        }
    }, [setShowHeader]);

    return {
        handleToggleMic,
        handleToggleCamera,
        handleFreeze,
        handleEndSession,
        handleToolClick,
        handleAnimationPop,
        toggleToolAccess,
        addBucket,
        eraseAllPen,
        handleNotesChange,
        handleClearNotes,
        toggleBackgroundMusic,
        handleMusicVolumeChange,
        handleLearningContentSearch,
        onDragStartContent,
        handleYoutubeDropped,
        handleCloseYoutubePopup,
        handleExerciseSubmit,
        handleExerciseUpdate,
        handleExerciseDelete,
        handleExerciseAnswerChange,
        handleProgramCheck,
        handleHeaderClick,
    };
};

export default useInstructorHandlers;
