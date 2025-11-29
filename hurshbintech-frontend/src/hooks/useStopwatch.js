import { useState, useRef, useCallback, useEffect } from 'react';
import { playTickSound, playCelebrationSound } from '../utils/stopwatchSounds';

/**
 * Countdown timer hook - counts down from a set time to 0
 * Includes sound effects: tick at 10 seconds, celebration at 0
 */
const useStopwatch = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [initialTime, setInitialTime] = useState(0);
    const [isCountdown, setIsCountdown] = useState(false);

    const intervalRef = useRef(null);
    const startTimeRef = useRef(null);
    const lastTickSecondRef = useRef(null);
    const hasPlayedCelebrationRef = useRef(false);

    const start = useCallback(() => {
        if (isRunning) return;

        // Reset sound flags
        hasPlayedCelebrationRef.current = false;
        lastTickSecondRef.current = null;

        if (isCountdown) {
            // Countdown mode
            const startElapsed = elapsedTime;
            startTimeRef.current = Date.now();
            setIsRunning(true);

            intervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current;
                const remaining = Math.max(0, startElapsed - elapsed);
                const remainingSeconds = Math.floor(remaining / 1000);

                setElapsedTime(remaining);

                // Play tick at 10, 9, 8... 1 seconds
                if (remainingSeconds <= 10 && remainingSeconds >= 1) {
                    if (lastTickSecondRef.current !== remainingSeconds) {
                        lastTickSecondRef.current = remainingSeconds;
                        playTickSound();
                    }
                }

                // Timer finished
                if (remaining <= 0) {
                    clearInterval(intervalRef.current);
                    setIsRunning(false);

                    // Play celebration
                    if (!hasPlayedCelebrationRef.current) {
                        hasPlayedCelebrationRef.current = true;
                        playCelebrationSound();
                    }
                }
            }, 50);
        } else {
            // Normal stopwatch (count up)
            startTimeRef.current = Date.now() - elapsedTime;
            setIsRunning(true);

            intervalRef.current = setInterval(() => {
                setElapsedTime(Date.now() - startTimeRef.current);
            }, 50);
        }
    }, [isRunning, elapsedTime, isCountdown]);

    const pause = useCallback(() => {
        if (!isRunning) return;
        clearInterval(intervalRef.current);
        setIsRunning(false);
    }, [isRunning]);

    const resume = useCallback(() => {
        start();
    }, [start]);

    const reset = useCallback(() => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        setElapsedTime(0);
        setInitialTime(0);
        setIsCountdown(false);
        lastTickSecondRef.current = null;
        hasPlayedCelebrationRef.current = false;
    }, []);

    const setTime = useCallback((hours = 0, minutes = 0, seconds = 0) => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        setElapsedTime(totalMs);
        setInitialTime(totalMs);
        setIsCountdown(true);
        lastTickSecondRef.current = null;
        hasPlayedCelebrationRef.current = false;
    }, []);

    const formatTime = useCallback((ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
            display: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
            hours: String(hours).padStart(2, '0'),
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0')
        };
    }, []);

    const formattedTime = formatTime(elapsedTime);

    return {
        isRunning,
        elapsedTime,
        formattedTime,
        start,
        pause,
        resume,
        reset,
        setTime,
        formatTime
    };
};

export default useStopwatch;
