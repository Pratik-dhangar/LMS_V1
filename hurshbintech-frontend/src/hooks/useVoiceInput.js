import { useState, useRef, useEffect } from 'react';

export default function useVoiceInput({ lang = 'en-US' } = {}) {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('Press mic to start listening...');
    const [_isSpeechSupported, setIsSpeechSupported] = useState(true);

    const recognitionRef = useRef(null);
    const transcriptRef = useRef('');
    const listeningRef = useRef(false);
    const restartTimeoutRef = useRef(null);
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 5;
    const BASE_RETRY_MS = 1000; // base backoff

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
                console.log('[useVoiceInput] Network error');
                recog.stop();

                // If offline, notify user and do not retry
                if (!navigator.onLine) {
                    setTranscript('Network offline. Please check your internet connection.');
                    return;
                }

                // Retry with exponential backoff, up to MAX_RETRIES
                if (listeningRef.current && retryCountRef.current < MAX_RETRIES) {
                    const backoff = BASE_RETRY_MS * Math.pow(2, retryCountRef.current);
                    console.log(`[useVoiceInput] Retrying recognition in ${backoff}ms (attempt ${retryCountRef.current + 1})`);
                    setTranscript(`Network error. Retrying in ${Math.round(backoff / 1000)}s...`);
                    restartTimeoutRef.current = setTimeout(() => {
                        try {
                            retryCountRef.current += 1;
                            recog.start();
                        } catch (e) {
                            console.error('[useVoiceInput] Error restarting after network error:', e);
                        }
                    }, backoff);
                } else {
                    console.warn('[useVoiceInput] Network error - max retries reached or not listening');
                    setTranscript('Network error. Please check your connection and try again.');
                }
            } else if (event.error === 'not-allowed') {
                console.log('[useVoiceInput] Microphone access denied.');
                setTranscript('❌ Microphone access denied.');
                setListening(false);
                listeningRef.current = false;
            } else {
                console.log('[useVoiceInput] Other error:', event.error);
                setTranscript(`Speech recognition error: ${event.error}`);
            }
        };

        recog.onend = () => {
            console.log('[useVoiceInput] Speech recognition ended, listening state:', listeningRef.current);

            // If user is still expecting voice input, attempt auto-restart but respect retry/backoff
            if (listeningRef.current && !restartTimeoutRef.current) {
                // If offline, do not restart
                if (!navigator.onLine) {
                    setTranscript('Network offline. Please check your internet connection.');
                    return;
                }

                if (retryCountRef.current >= MAX_RETRIES) {
                    console.warn('[useVoiceInput] Max retries reached - not auto-restarting');
                    setTranscript('Speech recognition repeatedly failed. Please check network and try again.');
                    return;
                }

                const backoff = BASE_RETRY_MS * Math.pow(2, retryCountRef.current);
                restartTimeoutRef.current = setTimeout(() => {
                    try {
                        console.log('[useVoiceInput] Auto-restarting recognition after end');
                        retryCountRef.current += 1;
                        recog.start();
                        restartTimeoutRef.current = null;
                    } catch (e) {
                        console.error('[useVoiceInput] Error auto-restarting recognition:', e);
                        restartTimeoutRef.current = null;
                    }
                }, backoff);
            }
        };

        recognitionRef.current = recog;

        return () => {
            try {
                if (restartTimeoutRef.current) {
                    clearTimeout(restartTimeoutRef.current);
                    restartTimeoutRef.current = null;
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

                // Clear any pending restart timeout
                if (restartTimeoutRef.current) {
                    clearTimeout(restartTimeoutRef.current);
                    restartTimeoutRef.current = null;
                }

                recog.stop();
                setListening(false);
            } else {
                // Start listening
                console.log('[useVoiceInput] Starting speech recognition');
                transcriptRef.current = '';
                setListening(true);
                listeningRef.current = true;
                setTranscript('🎤 Listening...');

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

    return { listening, transcript, toggleListening };
}
