// GuestSession.jsx
// Guest session page for non-authenticated users
// Based on ClientSession.jsx but uses token-based authentication instead of user auth

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Whiteboard from '../../components/common/Whiteboard';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useMessages from '../../hooks/useMessages';
import { useMediaControl } from '../../context/MediaControlContext';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import '../../styles/Pages.css';

const GuestSession = () => {
  const { token } = useParams(); // Guest session token from URL
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

  // Service instances
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);
  const [toolsService, setToolsService] = useState(null);
  const isInitializingRef = useRef(false);

  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const remoteVideoRef = useRef(null);

  // Mic/video controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [guestInfo, setGuestInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [coachJoined, setCoachJoined] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  // Messages
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress,
    addReceivedMessage
  } = useMessages(webRTC, 'guest');

  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        addReceivedMessage({
          sender: message.sender === 'guest' ? 'You' : 'Coach',
          text: message.text,
          timestamp: message.timestamp
        });
      };
    }
    return () => {
      if (webRTC) {
        webRTC.onMessage = null;
      }
    };
  }, [webRTC, addReceivedMessage]);

  // Whiteboard state
  const [canvasItems, setCanvasItems] = useState([]);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [textMessages, setTextMessages] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [waitingMessage, setWaitingMessage] = useState('');
  const [floatingAnimations, setFloatingAnimations] = useState([]);

  // UI state
  const [isFrozen, setIsFrozen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const headerTimeoutRef = useRef(null);
  const [erasePenTrigger, setErasePenTrigger] = useState(0);
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

  // Drawing tools
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [buckets, setBuckets] = useState([]);

  // Tool access control from coach
  const [toolAccess, setToolAccess] = useState({
    select: false,
    drag: false,
    keyboard: false
  });

  // Stopwatch (synced from coach)
  const [stopwatchElapsedTime, setStopwatchElapsedTime] = useState(0);
  const [stopwatchIsRunning, setStopwatchIsRunning] = useState(false);
  const mediaControl = useMediaControl();

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Component mount - authenticate guest and initialize session
  useEffect(() => {
    console.log('[GuestSession] Component mounted, token:', token);
    
    if (!token) {
      toast.error('Invalid session link');
      setAuthError('No session token provided');
      setLoading(false);
      return;
    }

    // Authenticate guest with token
    authenticateGuestSession();

    return () => {
      console.log('[GuestSession] Component unmounting, cleaning up');
      cleanup();
    };
  }, [token]);

  // Authenticate guest session with backend
  const authenticateGuestSession = async () => {
    try {
      console.log('[GuestSession] Authenticating with token...');
      const response = await axios.post(`${API_BASE_URL}/guest-sessions/auth`, {
        token: token
      });

      const sessionData = response.data;
      console.log('[GuestSession] Authentication successful:', sessionData);

      setSessionInfo(sessionData);
      setGuestInfo({
        name: sessionData.guest_name,
        email: sessionData.guest_email
      });

      // Initialize WebRTC and Whiteboard with the session_id
      await initializeWebRTC(sessionData.session_id);
      setLoading(false);
    } catch (error) {
      console.error('[GuestSession] Authentication failed:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to authenticate session';
      setAuthError(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  // Connect remote stream to video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('[GuestSession] Connecting remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Countdown timer
  useEffect(() => {
    if (!sessionInfo || !sessionInfo.scheduled_date) return;

    const scheduledDateTime = new Date(sessionInfo.scheduled_date).getTime();
    const durationMs = (sessionInfo.duration || 60) * 60 * 1000;
    const endTime = scheduledDateTime + durationMs;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeLeft('00:00');
        clearInterval(intervalId);
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sessionInfo]);

  // Auto-hide header after 5 seconds on mobile/tablet
  useEffect(() => {
    if (showHeader) {
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
      headerTimeoutRef.current = setTimeout(() => {
        if (window.innerWidth < 1024) {
          setShowHeader(false);
        }
      }, 5000);
    }

    return () => {
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
    };
  }, [showHeader]);

  const handleHeaderClick = () => {
    setShowHeader(true);
  };

  const initializeWebRTC = async (numericSessionId) => {
    if (isInitializingRef.current) {
      console.log('[GuestSession] Already initializing, skipping duplicate call');
      return;
    }
    isInitializingRef.current = true;

    // Initialize Whiteboard - use 'client' role for compatibility
    const wbService = new WhiteboardService(WS_BASE_URL, numericSessionId, 'client');
    try {
      wbService.initialize();
      setWhiteboardService(wbService);

      // Listen for coach messages
      wbService.onToolAccess = (access) => {
        setToolAccess(access);
      };

      wbService.onTriggerKeyboard = () => {
        console.log('[GuestSession] Keyboard tool triggered by coach');
        setKeyboardMode(true);
      };

      wbService.onBucketAdded = (data) => {
        console.log('[GuestSession] Bucket added:', data);
        setBuckets(prev => {
          const exists = prev.find(bucket => bucket.id === data.id);
          if (!exists) {
            return [...prev, data];
          }
          return prev;
        });
      };

      wbService.onBucketUpdate = (data) => {
        console.log('[GuestSession] Bucket updated:', data);
        if (data.removed) {
          setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
        } else {
          setBuckets(prev => prev.map(bucket =>
            bucket.id === data.id ? { ...bucket, ...data } : bucket
          ));
        }
      };

      wbService.onFloatingAnimations = (data) => {
        console.log('[GuestSession] Floating animations received:', data);
        setFloatingAnimations(prev => [...prev, ...data.animations]);

        setTimeout(() => {
          setFloatingAnimations(prev =>
            prev.filter(a => !data.animations.find(na => na.id === a.id))
          );
        }, 13000);
      };

      wbService.onErasePen = () => {
        console.log('[GuestSession] Received erase pen event');
        setErasePenTrigger(prev => prev + 1);
        setRedrawCanvasTrigger(prev => prev + 1);
      };

      wbService.onClearCanvas = () => {
        console.log('[GuestSession] Received clear canvas event');
        setCanvasItems([]);
        setBuckets([]);
        setErasePenTrigger(prev => prev + 1);
        setRedrawCanvasTrigger(prev => prev + 1);
      };

      wbService.onStopwatchSync = (data) => {
        setStopwatchElapsedTime(data.elapsedTime);
        setStopwatchIsRunning(data.isRunning);
      };

      const tbService = new WhiteboardToolsService(wbService);
      setToolsService(tbService);
    } catch (error) {
      console.error('[GuestSession] Error initializing whiteboard:', error);
      toast.error('Failed to initialize whiteboard');
    }

    // Initialize Video Conference Service - use 'client' role
    const videoService = new VideoConferenceService(WS_BASE_URL, numericSessionId, 'client');

    try {
      videoService.onLocalStream = (stream) => {
        console.log('[GuestSession] Local stream initialized');
        setLocalStream(stream);
        setConnectionStatus('Waiting for coach...');
      };

      videoService.onRemoteStream = (stream) => {
        console.log('[GuestSession] Received remote stream from coach');
        setRemoteStream(stream);
        setConnectionStatus('Connected');
        setCoachJoined(true);
      };

      videoService.onConnectionStateChange = (state) => {
        console.log('[GuestSession] Connection state changed to:', state);
        const statusMap = {
          'new': 'connecting',
          'connecting': 'connecting',
          'connected': 'connected',
          'disconnected': 'disconnected',
          'failed': 'failed',
          'closed': 'disconnected'
        };
        setConnectionStatus(statusMap[state] || state);

        if (state === 'connected') {
          setCoachJoined(true);
        } else if (state === 'disconnected' || state === 'closed') {
          setCoachJoined(false);
          toast.info('Coach has left the session');
        }
      };

      videoService.onMessage = (message) => {
        if (message.type === 'freeze') {
          setIsFrozen(message.frozen);
          toast.info(message.frozen ? 'Screen frozen by coach' : 'Screen unfrozen');
        }
      };

      videoService.onError = (error) => {
        console.error('[GuestSession] Video conference error:', error);
        toast.error(`Video error: ${error.message}`);
      };

      await videoService.initialize();
      setWebRTC(videoService);
    } catch (error) {
      console.error('[GuestSession] Video Conference init error:', error);
      toast.error('Failed to initialize video connection: ' + error.message);
    }
  };

  const handleToggleMic = () => {
    if (webRTC) {
      const newState = webRTC.toggleMicrophone();
      setMicEnabled(newState);
    }
  };

  const handleToggleCamera = () => {
    if (webRTC) {
      const newState = webRTC.toggleCamera();
      setCameraEnabled(newState);
    }
  };

  const handleLeaveSession = () => {
    if (window.confirm('Are you sure you want to leave this session?')) {
      cleanup();
      toast.success('You have left the session');
      // Redirect to a thank you page or home
      window.location.href = '/';
    }
  };

  const cleanup = () => {
    if (webRTC?.localStream) {
      webRTC.localStream.getTracks().forEach(track => track.stop());
    }
    if (webRTC) {
      webRTC.close();
    }
    if (whiteboardService) {
      whiteboardService.close();
    }
    if (toolsService) {
      toolsService.cleanup();
    }
    isInitializingRef.current = false;
  };

  const handleAnimationPop = (animationId, poppedLeft, poppedTop) => {
    setFloatingAnimations(prev => 
      prev.map(anim => 
        anim.id === animationId
          ? { ...anim, popped: true, poppedLeft, poppedTop }
          : anim
      )
    );
  };

  // Show error screen if authentication failed
  if (authError) {
    return (
      <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Session Access Error</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>{authError}</p>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Verifying session access...</p>
      </div>
    );
  }

  // Show waiting overlay if coach hasn't joined yet
  if (!loading && !coachJoined && sessionInfo?.status === 'scheduled') {
    return (
      <div className={`learner-session-page ${pageClassName}`}>
        <div className={`session-header ${navbarClassName}`}>
          <div className="session-header-main">
            <div>
              <div className="session-header-title">HurshBin Guest Session</div>
              <div className="session-header-subtitle">
                Welcome, {guestInfo?.name || 'Guest'}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 6.25rem)',
          padding: '2rem'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2.5rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 1.5rem',
              borderRadius: '50%',
              backgroundColor: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem'
            }}>
              ⏳
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
              Waiting for Coach
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Your session is ready and you're connected!
            </p>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Please wait while <strong>{sessionInfo?.coach_name ?? 'your coach'}</strong> joins the session.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
              <div style={{ width: '0.5rem', height: '0.5rem', backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
              <span>Connecting...</span>
            </div>
            {sessionInfo && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#eff6ff',
                borderRadius: '0.5rem'
              }}>
                <p style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: '600' }}>
                  Session Details:
                </p>
                {sessionInfo?.duration && (
                  <p style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                    ⏱️ Duration: {sessionInfo.duration} minutes
                  </p>
                )}
                <p style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                  📅 Scheduled: {sessionInfo.scheduled_time}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`learner-session-page ${pageClassName}`}>
      {/* Navigation / Header */}
      <div className={`session-header ${!showHeader ? 'hidden' : ''} ${navbarClassName}`} onClick={handleHeaderClick}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">HurshBin Guest Session</div>
            <div className="session-header-subtitle">
              Session with {sessionInfo?.coach_name ?? 'Coach'} — Guest: {guestInfo?.name || 'Guest'}
            </div>
          </div>

          <div className="session-header-controls">
            <div className="session-header-info">
              Status: <strong>{connectionStatus}</strong>
            </div>
            <div className="session-header-info">
              Time Left: <strong>{timeLeft ?? '--:--'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="session-main-layout" style={{ minHeight: 'calc(100vh - 6.25rem)' }}>
        {/* Center Area */}
        <div className="session-center-area-fullwidth">
          {/* Whiteboard */}
          <div className="session-whiteboard-container">
            {/* Remote Video (Coach) - Large display */}
            {remoteStream && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                width: '320px',
                height: '240px',
                zIndex: 100,
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                backgroundColor: '#000'
              }}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '8px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {sessionInfo?.coach_name || 'Coach'}
                </div>
              </div>
            )}

            <div className="w-full h-full">
              <Whiteboard
                whiteboardService={whiteboardService}
                isTrainer={false}
                canvasItems={canvasItems}
                setCanvasItems={setCanvasItems}
                keyboardMode={keyboardMode}
                keyboardText={keyboardText}
                setKeyboardText={setKeyboardText}
                keyboardPosition={keyboardPosition}
                setKeyboardPosition={setKeyboardPosition}
                learnerSelectedItemIds={selectedItemIds}
                textMessages={textMessages}
                setTextMessages={setTextMessages}
                feedbackMessage={feedbackMessage}
                waitingMessage={waitingMessage}
                floatingAnimations={floatingAnimations}
                onAnimationPop={handleAnimationPop}
                tool={tool}
                setTool={setTool}
                color={color}
                setColor={setColor}
                lineWidth={lineWidth}
                setLineWidth={setLineWidth}
                buckets={buckets}
                setBuckets={setBuckets}
                erasePenTrigger={erasePenTrigger}
                redrawCanvasTrigger={redrawCanvasTrigger}
                stopwatchFormattedTime={stopwatchIsRunning ? formatTime(stopwatchElapsedTime) : null}
                stopwatchIsRunning={stopwatchIsRunning}
                toolAccess={toolAccess}
                isFrozen={isFrozen}
              />
            </div>
          </div>

          {/* Video Controls */}
          <div className="w-full mt-4 mb-3">
            <div className="flex items-center justify-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
              <button
                onClick={handleToggleMic}
                className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{
                  padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)',
                  fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)',
                  gap: 'clamp(0.25rem, 0.8vw, 0.5rem)'
                }}
                title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
              >
                <span>{micEnabled ? '🎤' : '🔇'}</span>
              </button>
              <button
                onClick={handleToggleCamera}
                className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{
                  padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)',
                  fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)',
                  gap: 'clamp(0.25rem, 0.8vw, 0.5rem)'
                }}
                title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
              >
                <span>{cameraEnabled ? '📹' : '📷'}</span>
              </button>
              <button
                onClick={handleLeaveSession}
                className="bg-red-600 hover:bg-red-700 media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md"
                style={{
                  padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)',
                  fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)',
                  gap: 'clamp(0.25rem, 0.8vw, 0.5rem)'
                }}
              >
                🚪 Leave Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestSession;
