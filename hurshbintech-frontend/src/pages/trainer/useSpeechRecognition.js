import { useEffect, useRef, useState } from 'react';

const useSpeechRecognition = (options = {}) => {
  const {
    continuous = true,
    interimResults = true,
    lang = "en-IN",
    maxAlternatives = 1
  } = options;

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const finalTranscriptRef = useRef('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported");
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;
    recognition.lang = lang;

    let restartTimeout = null;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) final += text + " ";
        else interim += text;
      }

      console.log('[useSpeechRecognition] onresult event, final:', final, 'interim:', interim);

      if (final) {
        setFinalTranscript(prev => {
          const nextFinal = prev + final;
          finalTranscriptRef.current = nextFinal;
          // Update visible transcript to final results
          setTranscript(nextFinal);
          return nextFinal;
        });
      }

      // Update interim display (finalTranscript + interim)
      if (interim) {
        setTranscript((prev) => {
          // Use the latest finalTranscriptRef for stable base
          return (finalTranscriptRef.current || '') + interim;
        });
      }
    };

    recognition.onerror = (event) => {
      console.error("STT Error:", event.error);
      setListening(false);
      console.log('[useSpeechRecognition] recognition.onerror', event);

      // Chrome auto-stop fix (network / no-speech errors)
      if (event.error === "no-speech" || event.error === "network") {
        restartTimeout = setTimeout(() => {
          if (listening) recognition.start();
        }, 400);
      }
    };

    recognition.onstart = () => {
      console.log('[useSpeechRecognition] Recognition started');
    };

    recognition.onend = () => {
      console.log("Recognition ended");

      if (listening) {
        // Auto restart to prevent Chrome 60-sec stop
        restartTimeout = setTimeout(() => {
          recognition.start();
        }, 300);
      }
    };

    return () => {
      recognition.stop();
      clearTimeout(restartTimeout);
    };
  }, [continuous, interimResults, lang, maxAlternatives, listening]);

  const startListening = () => {
    if (!recognitionRef.current) return false;

    setTranscript('');
    try {
      recognitionRef.current.start();
      console.log("STT Started");
      setListening(true);
      return true;
    } catch (err) {
      console.log("Restarting STT...", err);
      recognitionRef.current.stop();
      setTimeout(() => recognitionRef.current.start(), 300);
      setListening(true);
      return true;
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return false;

    recognitionRef.current.stop();
    setListening(false);
    return true;
  };

  const resetTranscript = () => {
    setTranscript('');
    setFinalTranscript('');
    finalTranscriptRef.current = '';
  };

  return {
    listening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
};

export default useSpeechRecognition;
