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
  const [_finalTranscript, setFinalTranscript] = useState('');
  const finalTranscriptRef = useRef('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null;

    if (!SpeechRecognition) {
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

      if (final) {
        setFinalTranscript(_prev => {
          const nextFinal = _prev + final;
          finalTranscriptRef.current = nextFinal;
          // Update visible transcript to final results
          setTranscript(nextFinal);
          return nextFinal;
        });
      }

      // Update interim display (finalTranscript + interim)
      if (interim) {
        setTranscript(() => {
          // Use the latest finalTranscriptRef for stable base
          return (finalTranscriptRef.current || '') + interim;
        });
      }
    };

    recognition.onerror = (event) => {
      setListening(false);

      // Chrome auto-stop fix (network / no-speech errors)
      if (event.error === "no-speech" || event.error === "network") {
        restartTimeout = setTimeout(() => {
          if (listening) recognition.start();
        }, 400);
      }
    };

    recognition.onstart = () => {
    };

    recognition.onend = () => {

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
      setListening(true);
      return true;
    } catch (err) {
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
