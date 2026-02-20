// useInstructorEffects.js
// Custom hook to manage all instructor session side effects
// Used by both TrainerSession and CoachSession

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionNotesService from '../api/services/sessionNotesService';
import learningContentService from '../api/services/learningContentService';
import {
    validateUserSession,
    initializeInstructorSession,
    setupInstructorWhiteboardCallbacks,
    calculateTimeRemaining,
    playPopSound,
    searchLearningContentDatabase,
    searchLearningGoalsDatabase,
} from '../components/session/InstructorSessionLayout';
import learningGoalsService from '../api/services/learningGoalsService';
import { markSessionActive } from '../utils/sessionActivityTracker';
import { autoSaveSessionNotes } from '../utils/instructorSession';

/**
 * Custom hook for managing instructor session effects
 * Consolidates ~7 useEffect blocks into one reusable hook
 * 
 * @param {Object} params - All dependencies needed for effects
 */
export const useInstructorEffects = ({
    role,
    sessionId,
    sessionInfo,
    sessionNotes,
    whiteboardService,
    remoteStream,
    remoteVideoRef,
    stopwatch,
    lastSyncTimeRef,
    mediaWasVisibleRef,
    mediaControl,
    learningContentSearch,
    learningGoalsSearch,
    restrictionAlertShownRef,
    floatingAnimations,
    sessionService,
    setSessionInfo,
    setLoading,
    setSessionNotes,
    setTimeLeft,
    setRemoteSelectedItemIds,
    setFloatingAnimations,
    setExerciseData,
    setBuckets,
    setErasePenTrigger,
    setRedrawCanvasTrigger,
    setShowStopwatch,
    setDatabaseSearchResults,
    setIsSearching,
    setFilteredLearningGoals,
    setDatabaseGoalsSearchResults,
    setIsSearchingGoals,
    initializeWebRTC,
    cleanup,
    handleEndSession,
}) => {
    const navigate = useNavigate();
    const sessionEndedRef = useRef(false);

    // 1. Validate user session on mount
    useEffect(() => {
        const user = validateUserSession({ requiredRole: role, navigate });
        if (!user) return;

        // Initialize session
        const initSession = async (userId) => {
            await initializeInstructorSession({
                sessionId,
                userId,
                role,
                sessionService,
                navigate,
                restrictionAlertShownRef,
                markSessionActive,
                setSessionInfo,
                setLoading,
                initializeWebRTC,
            });
        };

        initSession(user.id);
        return () => cleanup();
    }, [sessionId, role]);

    // 2. Load session notes
    useEffect(() => {
        const loadSessionNotes = async () => {
            if (!sessionId) return;
            try {
                const notesData = await sessionNotesService.getNotes(sessionId);
                if (notesData?.notes) setSessionNotes(notesData.notes);
            } catch (error) {
                setSessionNotes('');
            }
        };
        const timer = setTimeout(loadSessionNotes, 500);
        return () => clearTimeout(timer);
    }, [sessionId, setSessionNotes]);

    // 3. Auto-save session notes
    useEffect(() => {
        if (!sessionId || !sessionNotes) return;
        const timer = setTimeout(() => {
            autoSaveSessionNotes(sessionId, sessionNotes, sessionNotesService);
        }, 1000);
        return () => clearTimeout(timer);
    }, [sessionNotes, sessionId]);

    // 4. Time remaining calculator with auto-end when time expires
    useEffect(() => {
        if (!sessionInfo) return;
        const interval = setInterval(() => {
            const remaining = calculateTimeRemaining(sessionInfo);
            setTimeLeft(remaining);

            // Auto-end session when time reaches 00:00
            if (remaining === '00:00' && !sessionEndedRef.current && sessionInfo.status === 'active') {
                sessionEndedRef.current = true;
                clearInterval(interval);
                toast.info('Session time has ended. Ending session automatically...');

                // Auto-end: call the end session API + notify attendee + cleanup + redirect
                const autoEndSession = async () => {
                    try {
                        const { endSession: utilEndSession } = await import('../components/session/InstructorSessionLayout');
                        const dashboardPath = `/${role}/dashboard`;
                        // Send session_ended via whiteboard and call API
                        if (whiteboardService) {
                            whiteboardService.send('session_ended', {
                                message: 'Session time has expired',
                                timestamp: Date.now()
                            });
                        }
                        // Call the backend end session API
                        if (sessionService && sessionId) {
                            try {
                                await sessionService.endSession(sessionId, '');
                            } catch (err) {
                                console.error('[useInstructorEffects] Error calling end session API:', err);
                            }
                        }
                        // Cleanup resources
                        if (cleanup) cleanup();
                        // Navigate to dashboard
                        navigate(dashboardPath);
                    } catch (error) {
                        console.error('[useInstructorEffects] Error auto-ending session:', error);
                        // Force navigate even if end API fails
                        navigate(`/${role}/dashboard`);
                    }
                };

                autoEndSession();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [sessionInfo, setTimeLeft, role, whiteboardService, sessionService, sessionId, cleanup, navigate]);

    // 5. Attach remote video stream
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, remoteVideoRef]);

    // 6. Setup whiteboard callbacks
    useEffect(() => {
        if (!whiteboardService) return;
        const cleanupCallbacks = setupInstructorWhiteboardCallbacks({
            whiteboardService,
            setRemoteSelectedItemIds,
            floatingAnimations,
            setFloatingAnimations,
            playPopSound,
            setExerciseData,
            setBuckets,
            setErasePenTrigger,
            setRedrawCanvasTrigger,
        });
        return cleanupCallbacks;
    }, [whiteboardService, floatingAnimations, setRemoteSelectedItemIds, setFloatingAnimations, setExerciseData, setBuckets, setErasePenTrigger, setRedrawCanvasTrigger]);

    // 7. Auto-show stopwatch when content ends
    useEffect(() => {
        if (mediaWasVisibleRef.current && !mediaControl.currentMedia.isVisible) {
            setShowStopwatch(true);
        }
        mediaWasVisibleRef.current = mediaControl.currentMedia.isVisible;
    }, [mediaControl.currentMedia.isVisible, mediaWasVisibleRef, setShowStopwatch]);

    // 8a. Send immediate sync when stopwatch finishes (not running anymore)
    useEffect(() => {
        if (!whiteboardService || stopwatch.isRunning) return;

        // Send final sync message immediately when timer stops
        whiteboardService.send('stopwatch_sync', {
            elapsedTime: stopwatch.elapsedTime,
            isRunning: false,
        });
    }, [whiteboardService, stopwatch.isRunning]);

    // 8b. Sync stopwatch to participant (throttled updates while running)
    useEffect(() => {
        if (!whiteboardService || !stopwatch.isRunning) return;

        const now = Date.now();
        if (now - lastSyncTimeRef.current > 100) {
            whiteboardService.send('stopwatch_sync', {
                elapsedTime: stopwatch.elapsedTime,
                isRunning: stopwatch.isRunning,
            });
            lastSyncTimeRef.current = now;
        }
    }, [whiteboardService, stopwatch.elapsedTime, stopwatch.isRunning, lastSyncTimeRef]);

    // 9. Learning content search
    useEffect(() => {
        if (!learningContentSearch.trim()) {
            setDatabaseSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timeoutId = setTimeout(async () => {
            const userData = localStorage.getItem('user_data');
            const user = userData ? JSON.parse(userData) : null;
            await searchLearningContentDatabase({
                searchTerm: learningContentSearch,
                userRole: user?.role,
                learningContentService,
                setDatabaseSearchResults,
                setIsSearching,
                logPrefix: `[${role === 'trainer' ? 'TrainerSession' : 'CoachSession'}]`,
            });
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [learningContentSearch, role, setDatabaseSearchResults, setIsSearching]);

    // 9b. Learning goals database search (Coach only)
    useEffect(() => {
        // Only run for Coach role when searching
        if (role !== 'coach' || !learningGoalsSearch.trim()) {
            setDatabaseGoalsSearchResults([]);
            setIsSearchingGoals(false);
            return;
        }

        const timeoutId = setTimeout(async () => {
            await searchLearningGoalsDatabase({
                searchTerm: learningGoalsSearch,
                learningGoalsService,
                setDatabaseSearchResults: setDatabaseGoalsSearchResults,
                setIsSearching: setIsSearchingGoals,
                logPrefix: '[CoachSession]',
            });
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [learningGoalsSearch, role, setDatabaseGoalsSearchResults, setIsSearchingGoals]);

    // 10. Filter learning goals from session info + Apply search filter
    useEffect(() => {
        if (!sessionInfo?.learning_goals) {
            console.log('[useInstructorEffects] No learning_goals in sessionInfo');
            setFilteredLearningGoals([]);
            return;
        }

        console.log('[useInstructorEffects] Session learning_goals:', {
            total: sessionInfo.learning_goals.length,
            sample: sessionInfo.learning_goals[0],
            searchTerm: learningGoalsSearch || '(none)'
        });

        let filteredGoals = sessionInfo.learning_goals;

        // Apply search filter if learningGoalsSearch is provided and not empty
        if (learningGoalsSearch && learningGoalsSearch.trim()) {
            const searchTerm = learningGoalsSearch.toLowerCase().trim();
            console.log('[useInstructorEffects] 🔍 Filtering learning goals with:', searchTerm);

            filteredGoals = sessionInfo.learning_goals.filter(goal => {
                // Check multiple possible field names for the goal text
                const goalText = goal.goal || goal.name || goal.title || '';
                const match = goalText.toLowerCase().includes(searchTerm);

                console.log(`[useInstructorEffects] "${goalText}" ${match ? '✅ MATCH' : '❌ no match'}`);

                return match;
            });

            console.log('[useInstructorEffects] ✅ Filtered results:', filteredGoals.length, 'out of', sessionInfo.learning_goals.length);
        } else {
            console.log('[useInstructorEffects] No search term - showing all', filteredGoals.length, 'goals');
        }

        setFilteredLearningGoals(filteredGoals);
    }, [sessionInfo, learningGoalsSearch, setFilteredLearningGoals]);
};

export default useInstructorEffects;
