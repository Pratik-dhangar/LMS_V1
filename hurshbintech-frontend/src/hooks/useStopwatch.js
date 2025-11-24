import { useState, useRef, useCallback } from 'react';

/**
 * Countdown timer hook - counts down from a set time to 0
 */
const useStopwatch = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [initialTime, setInitialTime] = useState(0); // Store the initial time for countdown
    const [isCountdown, setIsCountdown] = useState(false); // Flag to indicate countdown mode
    const intervalRef = useRef(null);
    const startTimeRef = useRef(null);

    const start = useCallback(() => {
        if (isRunning) return;

        if (isCountdown) {
            // Countdown mode: start from elapsedTime (remaining time) and count down
            startTimeRef.current = Date.now();
            setIsRunning(true);

            intervalRef.current = setInterval(() => {
                const elapsedMs = Date.now() - startTimeRef.current;
                const remainingMs = Math.max(0, elapsedTime - elapsedMs);
                setElapsedTime(remainingMs);

                // Stop when countdown reaches 0
                if (remainingMs <= 0) {
                    clearInterval(intervalRef.current);
                    setIsRunning(false);
                    setElapsedTime(0);
                }
            }, 100);
        } else {
            // Normal stopwatch mode: count up
            startTimeRef.current = Date.now() - elapsedTime;
            setIsRunning(true);

            intervalRef.current = setInterval(() => {
                setElapsedTime(Date.now() - startTimeRef.current);
            }, 100);
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
    }, []);

    const setTime = useCallback((hours = 0, minutes = 0, seconds = 0) => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        setElapsedTime(totalMs);
        setInitialTime(totalMs);
        setIsCountdown(true); // Enable countdown mode
    }, []);

    const formatTime = (ms) => {
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
    };

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
