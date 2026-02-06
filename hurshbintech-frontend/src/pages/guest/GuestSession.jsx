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
import { useMediaControl } from '../../context/MediaControlContext';
import { FaBars, FaTimes } from 'react-icons/fa';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { playPopSound } from '../../utils/sessionUtils';


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

  // Listen for session end from coach
  useEffect(() => {
    if (!whiteboardService) return;

    whiteboardService.onSessionEnded = (data) => {
      console.log('[GuestSession] Session ended by coach:', data);
      toast.info('Session has been ended by the coach');

      // Clean up and redirect after a short delay
      setTimeout(() => {
        if (webRTC?.localStream) {
          webRTC.localStream.getTracks().forEach(track => track.stop());
        }
        if (webRTC) {
          webRTC.close();
        }
        if (whiteboardService) {
          whiteboardService.close();
        }
        navigate('/');
      }, 2000);
    };

    return () => {
      if (whiteboardService) {
        whiteboardService.onSessionEnded = null;
      }
    };
  }, [whiteboardService, webRTC, navigate]);

  // Whiteboard state
  const [canvasItems, setCanvasItems] = useState([]);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [remoteSelectedItemIds, setRemoteSelectedItemIds] = useState([]);
  const [textMessages, setTextMessages] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [waitingMessage, setWaitingMessage] = useState('');
  const [floatingAnimations, setFloatingAnimations] = useState([]);

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
  const [textBoxes, setTextBoxes] = useState([]);
  const [activeTextBoxId, setActiveTextBoxId] = useState(null);

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
    return {
      display: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
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
    if (!sessionInfo || !sessionInfo.started_at || !sessionInfo.duration) return;

    const startTime = new Date(sessionInfo.started_at).getTime();
    const durationMs = sessionInfo.duration * 60 * 1000;
    const endTime = startTime + durationMs;

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
      wbService.onToolAccess = (data) => {
        console.log('[GuestSession] Tool access received from coach:', data);
        // Handle the allPermissions object sent by coach
        if (data.allPermissions) {
          setToolAccess(data.allPermissions);
          // Clear selection when drag permission is disabled
          if (data.toolName === 'drag' && !data.enabled) {
            setSelectedItems([]);
          }
        } else {
          // Fallback for old format
          setToolAccess(data);
        }
      };

      // Listen for item selections from any remote user (coach or other participants)
      wbService.onItemSelected = (data) => {
        console.log('[GuestSession] Remote user selected items:', data);
        if (data.itemIds && Array.isArray(data.itemIds)) {
          setRemoteSelectedItemIds(data.itemIds);
        }
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
          setFloatingAnimations(prevAnims =>
            prevAnims.filter(anim => !data.animations.find(newAnim => newAnim.id === anim.id))
          );
        }, 15000);
      };

      wbService.onAnimationPopped = (data) => {
        console.log('[GuestSession] Animation popped by coach:', data);
        handleAnimationPop(data.animationId, data.poppedLeft, data.poppedTop);
      };

      wbService.onErasePen = () => {
        setErasePenTrigger(prev => prev + 1);
      };

      // Text box handlers - receive updates from coach
      wbService.onTextBoxAdded = (textBox) => {
        console.log('[GuestSession] Text box added:', textBox);
        setTextBoxes(prev => [...prev, textBox]);
      };

      wbService.onTextBoxUpdate = (update) => {
        console.log('[GuestSession] Text box updated:', update);
        setTextBoxes(prev => prev.map(box =>
          box.id === update.id ? { ...box, ...update } : box
        ));
      };

      wbService.onTextBoxRemoved = (data) => {
        console.log('[GuestSession] Text box removed:', data);
        setTextBoxes(prev => prev.filter(box => box.id !== data.id));
      };

      wbService.onClearCanvas = () => {
        console.log('[GuestSession] Received clear canvas command from coach');
        setCanvasItems([]);
        setBuckets([]);
        setTextBoxes([]);
        setErasePenTrigger(prev => prev + 1);
        setRedrawCanvasTrigger(prev => prev + 1);
      };

      wbService.onFreeze = (frozen) => {
        setIsFrozen(frozen);
      };

      wbService.onStopwatchSync = (data) => {
        setStopwatchElapsedTime(data.elapsedTime);
        setStopwatchIsRunning(data.isRunning);
      };

      wbService.onFeedbackMessage = (data) => {
        setFeedbackMessage(data.text || '');
        if (data.text) {
          setTimeout(() => {
            setFeedbackMessage('');
          }, 3000);
        }
      };

      wbService.onWaitingMessage = (data) => {
        setWaitingMessage(data.text || '');
        if (data.text) {
          setTimeout(() => {
            setWaitingMessage('');
          }, 5000);
        }
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
        console.log('[GuestSession] Connection state:', state);
        const statusMap = {
          'new': 'connecting',
          'connecting': 'connecting',
          'connected': 'connected',
          'disconnected': 'disconnected',
          'failed': 'failed',
          'closed': 'disconnected'
        };
        const mappedStatus = statusMap[state] || state;
        setConnectionStatus(mappedStatus);

        // If disconnected or failed, coach might have left
        if (state === 'disconnected' || state === 'closed') {
          setCoachJoined(false);
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
    // Notify coach before leaving
    if (webRTC && webRTC.isConnected) {
      try {
        webRTC.sendMessage({
          type: 'client_leaving',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[GuestSession] Error sending leave notification:', error);
      }
    }

    cleanup();
    // Redirect to a thank you page or home
    window.location.href = '/';
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
    // Find the animation to get its type for sound effect
    const animation = floatingAnimations.find(a => a.id === animationId);
    if (animation) {
      playPopSound(animation.type);
    }

    setFloatingAnimations(prev =>
      prev.map(anim =>
        anim.id === animationId
          ? { ...anim, popped: true, poppedLeft, poppedTop }
          : anim
      )
    );

    // Broadcast pop event to all participants
    if (whiteboardService) {
      whiteboardService.send('animation_popped', {
        animationId,
        poppedLeft,
        poppedTop,
        timestamp: Date.now()
      });
    }
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
              backgroundColor: '#DB9D32',
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

  // Show waiting overlay if coach hasn't joined yet and session is not yet started
  // Only show waiting screen if session status is 'scheduled', not 'in_progress'
  if (!loading && !coachJoined && sessionInfo?.status === 'scheduled') {
    return (
      <div className={`learner-session-page ${pageClassName}`}>
        {/* Navigation / Header - Auto-hide on mobile after 5 seconds */}
        <div className={`session-header ${navbarClassName}`}>
          <div className="session-header-main">
            <div>
              <div className="session-header-title">HurshBin Guest Session</div>
              <div className="session-header-subtitle">
                Welcome, {guestInfo?.name || 'Guest'}
              </div>
            </div>
            <div className="session-header-controls">
              <button
                className="btn-session btn-session-end"
                onClick={() => window.location.href = '/'}
              >
                🏠 Back to Home
              </button>
            </div>
          </div>
        </div>

        {/* Waiting Overlay */}
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 150px)' }}>
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
            <div className="text-6xl mb-4 animate-bounce">⏳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Waiting for Coach
            </h2>
            <p className="text-gray-600 mb-4">
              Your session is ready and you're connected!
            </p>
            <p className="text-gray-600 mb-6">
              Please wait while <strong>{sessionInfo?.coach_name ?? 'your coach'}</strong> joins the session.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-[#DB9D32] rounded-full animate-pulse"></div>
              <span>Connecting...</span>
            </div>
            {sessionInfo && (
              <div className="mt-6 p-4 bg-[#fef3e2] rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Session Details:</strong>
                </p>
                {sessionInfo?.duration && (
                  <p className="text-xs text-gray-600 mt-1">
                    ⏱️ Duration: {sessionInfo.duration} minutes
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`learner-session-page ${pageClassName}`} style={{
      width: '100%',
      height: '100vh',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* Learner Session Full-Width Layout */
        .learner-session-page {
          width: 100% !important;
          height: 100vh !important;
          display: flex !important;
          flex-direction: column !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          position: relative !important;
          overflow: hidden !important;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: 100% !important;
          width: 100% !important;
          overflow-x: hidden !important;
        }

        /* Session Header - Fixed at top */
        .session-header {
          flex-shrink: 0;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Main Container - Takes remaining height */
        .learner-main-container {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important;
          width: 100% !important;
          height: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 0 100px 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }

        /* Whiteboard Wrapper - Takes all remaining space */
        .learner-whiteboard-wrapper {
          flex: 1 !important;
          width: 100% !important;
          height: 100% !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          margin: 0 !important;
          padding: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }

        .session-whiteboard-container {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        /* Ensure inner divs fill the space */
        .learner-whiteboard-wrapper > div {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          flex: 1 !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        .learner-whiteboard-wrapper .w-full {
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        .learner-whiteboard-wrapper canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }

        /* Hide sidebar toggles in full-width learner mode */
        .session-sidebar-toggles {
          display: none !important;
        }

        /* Mobile: Use dynamic viewport height (100dvh for modern browsers, 100vh fallback) */
        @media (max-width: 768px) {
          .learner-session-page {
            height: 100vh !important;
          }
        }

        /* Desktop: Use regular viewport height */
        @media (min-width: 769px) {
          .learner-session-page {
            height: 100vh !important;
            min-height: 100vh !important;
          }
        }
      `}</style>
      {/* Navigation / Header */}
      <div className={`session-header ${navbarClassName}`}>
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

      {/* Main Container - Flexbox column layout */}
      <div className="learner-main-container">
        {/* Whiteboard - Fills remaining space */}
        <div className="learner-whiteboard-wrapper">
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="session-whiteboard-container">
              {/* Fixed Video Feed Overlay - Coach's Video (Top Right Corner) */}
              {remoteStream && (
                <div style={{
                  position: 'fixed',
                  top: '88px',
                  right: '2px',
                  width: 'clamp(120px, 15vw, 250px)',
                  height: 'clamp(90px, 12vw, 180px)',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  border: '2px solid #374151',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Video Stream */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                      flex: 1,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      backgroundColor: '#1a1a1a'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    Coach
                  </div>
                </div>
              )}

              {/* Whiteboard component */}
              <div className="w-full h-full">
                <Whiteboard
                  whiteboardService={whiteboardService}
                  isTrainer={false}
                  canvasItems={canvasItems}
                  setCanvasItems={setCanvasItems}
                  isFrozen={false}
                  isPaused={false}
                  toolAccess={toolAccess}
                  remoteSelectedItemIds={remoteSelectedItemIds}
                  textMessages={textMessages}
                  setTextMessages={setTextMessages}
                  feedbackMessage={feedbackMessage}
                  waitingMessage={waitingMessage}
                  floatingAnimations={floatingAnimations}
                  onAnimationPop={handleAnimationPop}
                  erasePenTrigger={erasePenTrigger}
                  redrawCanvasTrigger={redrawCanvasTrigger}
                  buckets={buckets}
                  setBuckets={setBuckets}
                  textBoxes={textBoxes}
                  activeTextBoxId={activeTextBoxId}
                  setActiveTextBoxId={setActiveTextBoxId}
                  tool={tool}
                  setTool={setTool}
                  color={color}
                  setColor={setColor}
                  lineWidth={lineWidth}
                  setLineWidth={setLineWidth}
                  keyboardMode={keyboardMode}
                  keyboardText={keyboardText}
                  setKeyboardText={setKeyboardText}
                  keyboardPosition={keyboardPosition}
                  setKeyboardPosition={setKeyboardPosition}
                  stopwatchFormattedTime={stopwatchElapsedTime > 0 ? formatTime(stopwatchElapsedTime) : null}
                  stopwatchIsRunning={stopwatchIsRunning}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Controls - Bottom Center - Outside main container */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '12px',
        zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '12px 16px',
        borderRadius: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button
          onClick={handleToggleMic}
          className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            gap: '6px',
            border: 'none',
            cursor: 'pointer'
          }}
          title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
        >
          <span>{micEnabled ? '🎤 Mic On' : '🔇 Mic Off'}</span>
        </button>
        <button
          onClick={handleToggleCamera}
          className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            gap: '6px',
            border: 'none',
            cursor: 'pointer'
          }}
          title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          <span>{cameraEnabled ? '📹 Video On' : '📷 Video Off'}</span>
        </button>
        <button
          onClick={handleLeaveSession}
          className="bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center transition-all duration-200 shadow-md"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            gap: '6px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          🚪 Leave Session
        </button>
      </div>
    </div>
  );
};

export default GuestSession;
