// ClientSession.jsx
// Client session page - Mirrors LearnerSession.jsx
// Simplified version without prompt meter and voice prompt features

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Whiteboard from '../../components/common/Whiteboard';
import MessageList from '../../components/common/MessageList';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useMessages from '../../hooks/useMessages';
import { useMediaControl } from '../../context/MediaControlContext';
import { FaBars, FaTimes } from 'react-icons/fa';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import '../../styles/Pages.css';

const ClientSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { navbarClassName, pageClassName } = useAutoHideNavbar();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // Service instances
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);
  const [toolsService, setToolsService] = useState(null);

  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const remoteVideoRef = useRef(null);

  // Mic/video controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [coachJoined, setCoachJoined] = useState(false);

  // Messages
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress,
    addReceivedMessage
  } = useMessages(webRTC, 'client');

  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        addReceivedMessage({
          sender: message.sender === 'client' ? 'You' : 'Coach',
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

  // Learning content from coach
  const [textMessages, setTextMessages] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [waitingMessage, setWaitingMessage] = useState('');
  const [floatingAnimations, setFloatingAnimations] = useState([]);

  // Whiteboard state
  const [canvasItems, setCanvasItems] = useState([]);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const headerTimeoutRef = useRef(null);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
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
  const mediaWasVisibleRef = useRef(false);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Component mount - initialize session
  useEffect(() => {
    console.log('[ClientSession] Component mounted, sessionId:', sessionId);
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.error('[ClientSession] No user data found in localStorage');
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    console.log('[ClientSession] User data:', { id: user.id, role: user.role, name: user.name });

    initializeSession(user.id);

    return () => {
      console.log('[ClientSession] Component unmounting, cleaning up');
      cleanup();
    };
  }, [sessionId]);

  // Connect remote stream to video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('[ClientSession] Connecting remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

  const initializeSession = async (userId) => {
    try {
      const session = await coachSessionService.getSessionDetails(sessionId);
      console.log('[ClientSession] Session details:', session);
      setSessionInfo(session);

      await initializeWebRTC(session.session_id);
      setLoading(false);
    } catch (error) {
      console.error('[ClientSession] Error initializing session:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to initialize session';
      toast.error(errorMsg);
      navigate('/my-appointments');
    }
  };

  const initializeWebRTC = async (numericSessionId) => {
    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, numericSessionId, 'client');
    try {
      wbService.initialize();
      setWhiteboardService(wbService);

      // Listen for coach messages
      wbService.onToolAccess = (access) => {
        setToolAccess(access);
      };

      wbService.onTriggerKeyboard = () => {
        setKeyboardMode(true);
        setKeyboardText('');
        setKeyboardPosition({ x: 100, y: 100 });
        toast.info('Keyboard tool activated by coach');
      };

      wbService.onBucketAdded = (bucket) => {
        setBuckets(prev => [...prev, bucket]);
      };

      wbService.onStopwatchSync = (data) => {
        setStopwatchElapsedTime(data.elapsedTime);
        setStopwatchIsRunning(data.isRunning);
      };

      wbService.onFloatingAnimations = (animations) => {
        setFloatingAnimations(prev => [...prev, ...animations]);

        setTimeout(() => {
          setFloatingAnimations(prevAnims =>
            prevAnims.filter(anim => !animations.find(newAnim => newAnim.id === anim.id))
          );
        }, 15000);
      };

      wbService.onErasePen = () => {
        setErasePenTrigger(prev => prev + 1);
      };

      wbService.onFreeze = (frozen) => {
        setIsFrozen(frozen);
      };

      const tbService = new WhiteboardToolsService(wbService);
      setToolsService(tbService);
    } catch (error) {
      console.error('[ClientSession] Error initializing whiteboard:', error);
      toast.error('Failed to initialize whiteboard');
    }

    // Initialize Video Conference Service
    const videoService = new VideoConferenceService(WS_BASE_URL, numericSessionId, 'client');

    try {
      videoService.onLocalStream = (stream) => {
        console.log('[ClientSession] Local stream initialized');
        setLocalStream(stream);
        setConnectionStatus('Waiting for coach...');
      };

      videoService.onRemoteStream = (stream) => {
        console.log('[ClientSession] Received remote stream from coach');
        setRemoteStream(stream);
        setConnectionStatus('Connected');
        setCoachJoined(true);
      };

      videoService.onConnectionStateChange = (state) => {
        const statusMap = {
          'new': 'connecting',
          'connecting': 'connecting',
          'connected': 'connected',
          'disconnected': 'disconnected',
          'failed': 'failed',
          'closed': 'disconnected'
        };
        setConnectionStatus(statusMap[state] || state);
      };

      videoService.onError = (error) => {
        console.error('[ClientSession] Video conference error:', error);
        toast.error(`Video error: ${error.message}`);
      };

      await videoService.initialize();
      setWebRTC(videoService);
    } catch (error) {
      console.error('[ClientSession] Video Conference init error:', error);
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
  };

  const handleLeaveSession = () => {
    cleanup();
    navigate('/my-appointments');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleToolClick = (toolName) => {
    if (toolsService) {
      toolsService.handleToolClick(toolName, tool, setTool);
    }
  };

  const handleItemSelection = (itemIds) => {
    setSelectedItemIds(itemIds);
    if (whiteboardService) {
      whiteboardService.sendItemSelected(itemIds);
    }
  };

  const audioContextRef = useRef(null);
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playPopSound = (animationType) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      switch (animationType) {
        case 'bubble':
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.1);
          break;
        case 'balloon':
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.15);
          break;
        case 'smiley':
          osc.frequency.setValueAtTime(700, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.05);
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.08);
          break;
        case 'star':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.12);
          break;
        default:
          osc.frequency.setValueAtTime(500, ctx.currentTime);
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.1);
      }
    } catch (error) {
      console.error('[ClientSession] Error playing pop sound:', error);
    }
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  return (
    <div className={`learner-session-layout ${pageClassName}`}>
      {/* Header */}
      <div className={`session-header ${!showHeader ? 'hidden' : ''} ${navbarClassName}`} onClick={handleHeaderClick}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">HurshBin Client</div>
            <div className="session-header-subtitle">
              {sessionInfo?.title ?? 'Coach Session'}
            </div>
          </div>

          <div className="session-header-controls">
            <div className="session-header-info">
              Status: <strong>{connectionStatus}</strong>
            </div>
            <button
              onClick={() => window.open('/my-appointments', '_blank', 'noopener,noreferrer')}
              className="btn-session btn-session-primary"
            >
              🏠 Appointments
            </button>
          </div>
        </div>
      </div>

      {/* Waiting overlay */}
      {!coachJoined && (
        <div className="waiting-overlay">
          <div className="waiting-content">
            <div className="session-loader mb-4"></div>
            <h2 className="text-2xl font-bold text-white">Waiting for Coach...</h2>
            <p className="text-white mt-2">Please wait while your coach joins the session</p>
          </div>
        </div>
      )}

      <div className="learner-session-content">
        {/* Left Sidebar - Coach Video + Messages */}
        <div className={`learner-session-left-sidebar ${isSidebarOpen ? 'learner-session-left-sidebar-open' : ''}`}>
          <div className="learner-session-sidebar-content">
            {/* Coach Video */}
            <div className="learner-session-video-container">
              {remoteStream ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="learner-session-video"
                  />
                  <div className="learner-session-video-label">Coach</div>
                </>
              ) : (
                <div className="learner-session-video-placeholder">
                  <div className="text-center">
                    <div className="session-loader mb-2"></div>
                    <span className="text-sm text-gray-400">Waiting for coach...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Message Box */}
            <div className="learner-session-message-box">
              <div className="learner-session-message-header">💬 Messages</div>
              <div className="learner-session-message-list">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`learner-session-message ${
                      msg.sender === 'You' ? 'learner-session-message-sent' : 'learner-session-message-received'
                    }`}
                  >
                    <strong>{msg.sender}:</strong> {msg.text}
                  </div>
                ))}
              </div>
              <div className="learner-session-message-input-container">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type message..."
                  className="learner-session-message-input"
                />
                <button onClick={sendMessage} className="learner-session-message-send-btn">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center Area - Whiteboard */}
        <div className="learner-session-center-area">
          {/* Hamburger toggle for mobile */}
          <button
            className="learner-session-hamburger"
            onClick={toggleSidebar}
          >
            {isSidebarOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
          </button>

          {/* Stopwatch */}
          {stopwatchIsRunning && (
            <div className="learner-session-stopwatch">
              ⏱️ {formatTime(stopwatchElapsedTime)}
            </div>
          )}

          {/* Whiteboard */}
          <div className="learner-session-whiteboard-container">
            {isFrozen && (
              <div className="freeze-overlay">
                <div className="freeze-message">❄️ Session Paused by Coach</div>
              </div>
            )}

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
              onItemSelection={handleItemSelection}
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
              clearCanvasTrigger={clearCanvasTrigger}
              erasePenTrigger={erasePenTrigger}
              redrawCanvasTrigger={redrawCanvasTrigger}
              toolAccess={toolAccess}
            />
          </div>

          {/* Video Controls */}
          <div className="learner-session-video-controls">
            <button
              onClick={handleToggleMic}
              className={`${
                micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              } media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
              style={{
                padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)',
                fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)',
                gap: 'clamp(0.25rem, 0.8vw, 0.5rem)'
              }}
            >
              <span>{micEnabled ? '🎤' : '🔇'}</span>
            </button>
            <button
              onClick={handleToggleCamera}
              className={`${
                cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              } media-control text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
              style={{
                padding: 'clamp(0.375rem, 1.2vw, 0.625rem) clamp(0.625rem, 1.8vw, 1rem)',
                fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)',
                gap: 'clamp(0.25rem, 0.8vw, 0.5rem)'
              }}
            >
              <span>{cameraEnabled ? '📹' : '📷'}</span>
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
              🚪 Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientSession;
