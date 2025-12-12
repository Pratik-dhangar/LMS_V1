import { useState, useRef, useEffect } from 'react';

export default function useVoiceInput({ lang = 'en-US', onMuteMic = null } = {}) {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('Press mic to start listening...');
    const [_isSpeechSupported, setIsSpeechSupported] = useState(true);

    const recognitionRef = useRef(null);
    const transcriptRef = useRef('');
    const listeningRef = useRef(false);
    const restartTimeoutRef = useRef(null);
    const silenceTimeoutRef = useRef(null);
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 5;
    const BASE_RETRY_MS = 1000; // base backoff
    const SILENCE_THRESHOLD = 3000; // 3 seconds of silence to auto-stop

    // Initialize SpeechRecognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported');
            setIsSpeechSupported(false);
            setTranscript('Speech Recognition not supported in this browser.');
            return;
        }

        setIsSpeechSupported(true);
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.language = lang;

        recog.onstart = () => {
            console.log('[useVoiceInput] Speech recognition started');
            // reset retry count on successful start
            retryCountRef.current = 0;
            transcriptRef.current = '';
            setTranscript('🎤 Listening...');
        };

        recog.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update ref and state
            if (finalTranscript) {
                transcriptRef.current += finalTranscript;
                // successful recognition reset retry count
                retryCountRef.current = 0;
                if (restartTimeoutRef.current) {
                    clearTimeout(restartTimeoutRef.current);
                    restartTimeoutRef.current = null;
                }

                // Reset silence timeout when speech is detected
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                }
                silenceTimeoutRef.current = setTimeout(() => {
                    if (listeningRef.current) {
                        console.log('[useVoiceInput] Silence detected (3+ seconds) - auto-stopping');
                        recog.stop();
                        silenceTimeoutRef.current = null;
                    }
                }, SILENCE_THRESHOLD);
            }

            const displayText = transcriptRef.current + interimTranscript;
            setTranscript(displayText || '🎤 Listening...');
            console.log('[useVoiceInput] Transcript:', displayText);
        };

        recog.onerror = (event) => {
            console.error('[useVoiceInput] Speech recognition error:', event.error);

            if (event.error === 'no-speech') {
                console.log('[useVoiceInput] No speech detected, stopping.');
                setTranscript('No speech detected. Please try again.');
                recog.stop();
            } else if (event.error === 'network') {
                console.log('[useVoiceInput] Network error - using offline speech recognition');
                // Don't stop immediately, just log the error
                // Chrome's speech recognition can work offline in some cases

                // If offline, notify user
                if (!navigator.onLine) {
                    setTranscript('Network offline. Speech recognition may not work properly.');
                    recog.stop();
                    return;
                }

                // For online network errors, continue without stopping
                console.log('[useVoiceInput] Network error encountered but will continue');
                setTranscript(transcriptRef.current || '🎤 Listening... (network issue detected)');

            } else if (event.error === 'not-allowed') {
                console.log('[useVoiceInput] Microphone access denied.');
                setTranscript('❌ Microphone access denied. Please allow microphone access in your browser settings.');
                setListening(false);
                listeningRef.current = false;
            } else if (event.error === 'aborted') {
                console.log('[useVoiceInput] Speech recognition aborted');
                // User intentionally stopped, don't show error
            } else {
                console.log('[useVoiceInput] Other error:', event.error);
                setTranscript(`Speech recognition error: ${event.error}. Please try again.`);
            }
        };

        recog.onend = () => {
            console.log('[useVoiceInput] Speech recognition ended, listening state:', listeningRef.current);

            // If user is still expecting voice input, attempt auto-restart
            if (listeningRef.current && !restartTimeoutRef.current) {
                // If offline, do not restart
                if (!navigator.onLine) {
                    setTranscript('Network offline. Please check your internet connection.');
                    setListening(false);
                    listeningRef.current = false;
                    return;
                }

                // Auto-restart without backoff for normal operation
                restartTimeoutRef.current = setTimeout(() => {
                    try {
                        console.log('[useVoiceInput] Auto-restarting recognition after end');
                        recog.start();
                        restartTimeoutRef.current = null;
                    } catch (e) {
                        console.error('[useVoiceInput] Error auto-restarting recognition:', e);
                        restartTimeoutRef.current = null;
                        if (e.name !== 'InvalidStateError') {
                            setListening(false);
                            listeningRef.current = false;
                        }
                    }
                }, 300); // Small delay to avoid rapid restarts
            }
        };

        recognitionRef.current = recog;

        return () => {
            try {
                if (restartTimeoutRef.current) {
                    clearTimeout(restartTimeoutRef.current);
                    restartTimeoutRef.current = null;
                }
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                    silenceTimeoutRef.current = null;
                }
                if (recognitionRef.current) {
                    recognitionRef.current.abort();
                    recognitionRef.current = null;
                }
            } catch (e) {
                console.error('[useVoiceInput] Cleanup error:', e);
            }
        };
    }, [lang]);

    const toggleListening = async () => {
        const recog = recognitionRef.current;
        if (!recog) {
            console.error('[useVoiceInput] SpeechRecognition not initialized');
            return;
        }

        try {
            if (listening) {
                // Stop listening
                console.log('[useVoiceInput] Stopping speech recognition');
                listeningRef.current = false;

                // Clear any pending timeouts
                if (restartTimeoutRef.current) {
                    clearTimeout(restartTimeoutRef.current);
                    restartTimeoutRef.current = null;
                }
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                    silenceTimeoutRef.current = null;
                }

                recog.stop();
                setListening(false);

                // Trigger mute callback if provided
                if (onMuteMic && transcriptRef.current.trim()) {
                    console.log('[useVoiceInput] Calling onMuteMic callback with transcript:', transcriptRef.current);
                    onMuteMic(transcriptRef.current);
                }
            } else {
                // Start listening
                console.log('[useVoiceInput] Starting speech recognition');
                transcriptRef.current = '';
                setListening(true);
                listeningRef.current = true;
                setTranscript('🎤 Listening...');

                // Reset silence timeout
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                }

                try {
                    recog.start();
                } catch (e) {
                    // Handle already-running error
                    if (e.name === 'InvalidStateError') {
                        console.log('[useVoiceInput] Recognition already running');
                    } else {
                        console.error('[useVoiceInput] Error starting recognition:', e);
                        setListening(false);
                        listeningRef.current = false;
                        setTranscript('Error starting voice input.');
                    }
                }
            }
        } catch (error) {
            console.error('[useVoiceInput] Error in toggleListening:', error);
            setTranscript('Error with voice input.');
            setListening(false);
            listeningRef.current = false;
        }
    };

    return { listening, transcript, toggleListening, transcriptRef };
}
