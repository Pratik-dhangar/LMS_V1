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
import MessageList from '../../components/common/MessageList';
import useMessages from '../../hooks/useMessages';
import { useMediaControl } from '../../context/MediaControlContext';
import { FaBars, FaTimes } from 'react-icons/fa';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';


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
    <div className={`learner-session-page ${pageClassName}`}>
      {/* Navigation / Header - Auto-hide on mobile after 5 seconds */}
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

      {/* Sidebar Toggles (Mobile Only) */}
      <div className="session-sidebar-toggles">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="sidebar-toggle-button"
          aria-label="Toggle Sidebar"
        >
          {isSidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        </button>
      </div>

      {/* Overlay backdrop for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Container - Responsive 3-column layout */}
      <div className="flex flex-col gap-3 sm:gap-5 md:gap-6 my-3 sm:my-5 md:my-6 mx-2 sm:mx-4 md:mx-6 items-start learner-responsive-layout" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <div className={`w-full md:w-[380px] lg:w-auto bg-white border-r border-gray-200 p-2 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar transition-transform duration-300 learner-responsive-sidebar-left md:relative ${isSidebarOpen ? 'fixed top-20 left-0 bottom-0 w-[85%] max-w-[450px] z-[999] transform translate-x-0 order-1' : 'max-md:fixed max-md:-translate-x-full max-md:order-1 md:order-1'}`}>
          {/* Coach Video Feed */}
          <div className="mb-4 md:mb-5">
            <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg">
              <div className="relative" style={{ paddingBottom: '56.25%' }}>
                {remoteStream ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="absolute top-0 left-0 w-full h-full object-cover"
                    />
                    <div className={`absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold transition-opacity duration-300 ${navbarClassName}`}>
                      Coach
                    </div>
                    <div className={`absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs transition-opacity duration-300 ${navbarClassName}`}>
                      {connectionStatus}
                    </div>
                  </>
                ) : (
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800">
                    <div className="text-center">
                      <div className="session-loader mb-2"></div>
                      <span className="text-sm text-gray-400">Connecting to coach...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 sm:p-4 md:p-5">
            <h3 className="font-semibold text-xs sm:text-sm md:text-base text-gray-700 mb-2">Messages</h3>
            <div className="bg-white border border-gray-300 rounded p-2 max-h-[120px] sm:max-h-[150px] md:max-h-[200px] overflow-y-auto mb-2">
              {messages.length > 0 ? (
                messages.map((msg, idx) => (
                  <div key={idx} className="mb-2 p-2 bg-gray-50 rounded text-xs md:text-sm">
                    <strong className="text-gray-800">{msg.sender === 'You' ? 'Coach' : msg.sender}:</strong>
                    <span className="text-gray-700"> {msg.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs sm:text-sm md:text-base font-semibold text-gray-600">{sessionInfo?.coach_name ?? 'Coach'}:</p>
                  <p className="text-xs sm:text-xs md:text-sm text-gray-500">Welcome to the session!</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <div className="flex-1 flex items-center border border-gray-300 rounded focus-within:border-[#DB9D32] min-w-0">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="[Type message...]"
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs md:text-sm focus:outline-none min-w-0"
                />
                <button
                  onClick={sendMessage}
                  className="flex-shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 bg-[#DB9D32] text-white text-xs md:text-sm rounded-r hover:bg-[#9C4D0B] transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Whiteboard Area - Scrollable Container */}
        <div className="w-full learner-responsive-main-area learner-responsive-whiteboard-section mx-auto overflow-y-auto">
          <div className="session-whiteboard-container">
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
          {/* Video Controls */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mt-4 mb-4 flex-wrap" style={{ paddingBottom: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
            <button
              onClick={handleToggleMic}
              className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                } media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
              style={{
                padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)',
                fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)',
                gap: 'clamp(0.25rem, 0.8vw, 0.5rem)'
              }}
              title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
            >
              <span>{micEnabled ? '🎤 Mic On' : '🔇 Mic Off'}</span>
            </button>
            <button
              onClick={handleToggleCamera}
              className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                } media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
              style={{
                padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)',
                fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)',
                gap: 'clamp(0.25rem, 0.8vw, 0.5rem)'
              }}
              title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              <span>{cameraEnabled ? '📹 Video On' : '📷 Video Off'}</span>
            </button>
            <button
              onClick={handleLeaveSession}
              className="bg-gray-600 hover:bg-gray-700 media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md"
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
  );
};

export default GuestSession;
