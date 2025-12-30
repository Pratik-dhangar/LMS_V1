// ClientSession.jsx
// Client session page for one-on-one video conferencing with coaches
// Simplified version of LearnerSession without prompt meter and voice prompt features

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaBars, FaTimes } from 'react-icons/fa';
import coachSessionService from '../../api/services/coachSessionService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import Whiteboard from '../../components/common/Whiteboard';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import MoveableVideoFeed from '../../components/videoConference/MoveableVideoFeed';
import useMessages from '../../hooks/useMessages';
import useStopwatch from '../../hooks/useStopwatch';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import '../../styles/Pages.css';

const ClientSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
  const { navbarClassName, pageClassName } = useAutoHideNavbar();

  // WebRTC and Whiteboard
  const [webRTC, setWebRTC] = useState(null);
  const [whiteboardService, setWhiteboardService] = useState(null);

  // Stream state (only remote - coach's video)
  const [remoteStream, setRemoteStream] = useState(null);
  const remoteVideoRef = useRef(null);
  const [videoPosition, setVideoPosition] = useState({ x: 20, y: 20 });
  const [videoSize, setVideoSize] = useState({ width: 320, height: 240 });

  // UI and session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [canvasItems, setCanvasItems] = useState([]);

  // Whiteboard state
  const [textMessages, setTextMessages] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [waitingMessage, setWaitingMessage] = useState('');
  const [floatingAnimations, setFloatingAnimations] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [coachJoined, setCoachJoined] = useState(false);

  // Messages
  const { messages, currentMessage, setCurrentMessage, sendMessage, handleKeyPress, addReceivedMessage } = useMessages(webRTC, 'client');

  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        addReceivedMessage(message);
      };
    }
    return () => {
      if (webRTC) {
        webRTC.onMessage = null;
      }
    };
  }, [webRTC, addReceivedMessage]);

  // Tool access permissions from coach
  const [toolAccess, setToolAccess] = useState({
    select: false,
    drag: false,
    keyboard: false
  });

  // Canvas triggers
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [erasePenTrigger, setErasePenTrigger] = useState(0);
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

  // Whiteboard settings
  const [buckets, setBuckets] = useState([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [isFrozen, setIsFrozen] = useState(false);
  const [keyboardMode] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Stopwatch
  const stopwatch = useStopwatch();
  const [syncedElapsedTime, setSyncedElapsedTime] = useState(0);
  const [syncedIsRunning, setSyncedIsRunning] = useState(false);

  // Initialize session
  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.error('[ClientSession] No user data found in localStorage');
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    console.log('[ClientSession] User data:', { id: user.id, role: user.role, name: user.name });
    
    initializeSession();

    return () => {
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

  const initializeSession = async () => {
    try {
      const session = await coachSessionService.getSessionDetails(sessionId);
      console.log('[ClientSession] Session details:', session);
      setSessionInfo(session);

      await coachSessionService.joinSession(sessionId);
      await initializeWebRTC();
      setLoading(false);
    } catch (error) {
      console.error('[ClientSession] Error initializing session:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to join session';
      toast.error(errorMsg);
      navigate('/my-appointments');
    }
  };

  const initializeWebRTC = async () => {
    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, sessionId, 'client');
    try {
      wbService.initialize();
      setWhiteboardService(wbService);

      // Listen for canvas clear events
      wbService.onCanvasClear = () => {
        setClearCanvasTrigger(prev => prev + 1);
      };

      wbService.onPenErase = () => {
        setErasePenTrigger(prev => prev + 1);
      };

      wbService.onToolAccess = (data) => {
        setToolAccess(data);
      };

      wbService.onStopwatchSync = (data) => {
        setSyncedElapsedTime(data.elapsedTime);
        setSyncedIsRunning(data.isRunning);
      };
    } catch {
      // Silent fail
    }

    // Initialize Video Conference Service
    const videoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'client');

    try {
      videoService.onLocalStream = (stream) => {
        console.log('[ClientSession] Local stream initialized');
        // Client doesn't display their own video to minimize distraction
        setConnectionStatus('Waiting for coach...');
      };

      videoService.onRemoteStream = (stream) => {
        console.log('[ClientSession] Received remote stream from coach');
        setRemoteStream(stream);
        setCoachJoined(true);
        setConnectionStatus('Connected');
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
        const mappedStatus = statusMap[state] || state;
        setConnectionStatus(mappedStatus);

        if (state === 'disconnected' || state === 'closed') {
          setCoachJoined(false);
        }
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

  const cleanup = () => {
    if (webRTC?.localStream) {
      webRTC.localStream.getTracks().forEach(track => {
        track.stop();
      });
    }
    if (webRTC) {
      webRTC.close();
    }
    if (whiteboardService) {
      whiteboardService.close();
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
      toast.info('Left session');
      navigate('/my-appointments');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  // Show waiting overlay if coach hasn't joined yet
  if (!loading && !coachJoined && sessionInfo?.status === 'active') {
    return (
      <div className={`learner-session-page ${pageClassName}`}>
        <div className={`session-header ${navbarClassName}`}>
          <div className="session-header-main">
            <div>
              <div className="session-header-title">Client Session</div>
              <div className="session-header-subtitle">
                {sessionInfo?.coach_name ?? 'Coach'} | {sessionInfo?.scheduled_date ? new Date(sessionInfo.scheduled_date).toLocaleDateString() : ''}
              </div>
            </div>
          </div>
          <div className="session-header-controls">
            <button className="btn-session btn-session-end" onClick={() => navigate('/my-appointments')}>
              🏠 Back
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 150px)' }}>
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
            <div className="text-6xl mb-4 animate-bounce">⏳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Waiting for Coach
            </h2>
            <p className="text-gray-600 mb-4">
              Please wait while <strong>{sessionInfo?.coach_name ?? 'your coach'}</strong> joins the session.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Connecting...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`learner-session-page ${pageClassName}`}>
      {/* Session Header */}
      <div className={`session-header ${navbarClassName}`}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">Client Session</div>
            <div className="session-header-subtitle">
              Coach: {sessionInfo?.coach_name ?? 'Coach'}
            </div>
          </div>
        </div>
        <div className="session-header-controls">
          <button className="btn-session btn-session-end" onClick={handleLeaveSession}>
            🚪 Leave Session
          </button>
        </div>
      </div>

      <div className="learner-session-layout">
        {/* Left Sidebar - Coach Video */}
        <div className={`w-full md:w-[380px] lg:w-auto bg-white border-r border-gray-200 p-2 sm:p-4 md:p-5 overflow-y-auto custom-scrollbar transition-transform duration-300 learner-responsive-sidebar-left md:relative ${isSidebarOpen ? 'fixed top-20 left-0 bottom-0 w-[85%] max-w-[450px] z-[999] transform translate-x-0 order-1' : 'max-md:fixed max-md:-translate-x-full max-md:order-1 md:order-1'}`}>
          {/* Coach Video Feed */}
          {remoteStream && (
            <div className="mb-4 md:mb-5">
              <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg">
                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute top-0 left-0 w-full h-full object-cover"
                  />
                  <div className={`absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold transition-opacity duration-300 ${navbarClassName}`}>
                    Coach
                  </div>
                  <div className={`absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs transition-opacity duration-300 ${navbarClassName}`}>
                    {connectionStatus}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Message Box */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-1 sm:p-4 md:p-5 mb-4 md:mb-5">
            <div className="font-semibold text-gray-800 mb-2">💬 Messages</div>
            <div className="overflow-y-auto mb-2" style={{ maxHeight: '120px' }}>
              {messages.length > 0 ? (
                messages.map((msg, idx) => (
                  <div key={idx} className="text-xs sm:text-sm mb-2">
                    <strong className="text-gray-900">{msg.sender}:</strong>
                    <span className="text-gray-700"> {msg.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs sm:text-sm text-gray-500">No messages yet</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="[Type message...]"
                className="flex-1 px-3 py-2 text-xs md:text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
              />
              <button onClick={sendMessage} className="px-4 py-2 md:px-5 md:py-3 bg-blue-500 text-white text-xs md:text-sm rounded hover:bg-blue-600 transition-colors">
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Whiteboard Area */}
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
                textMessages={textMessages}
                setTextMessages={setTextMessages}
                feedbackMessage={feedbackMessage}
                waitingMessage={waitingMessage}
                floatingAnimations={floatingAnimations}
                tool={tool}
                color={color}
                lineWidth={lineWidth}
                buckets={buckets}
                clearCanvasTrigger={clearCanvasTrigger}
                erasePenTrigger={erasePenTrigger}
                redrawCanvasTrigger={redrawCanvasTrigger}
                keyboardPosition={keyboardPosition}
              />
            </div>
          </div>

          {/* Video Controls */}
          <div className="w-full mt-4 mb-3 px-2">
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleToggleMic}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  micEnabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {micEnabled ? '🎤 Mic On' : '🔇 Mic Off'}
              </button>
              <button
                onClick={handleToggleCamera}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  cameraEnabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {cameraEnabled ? '📹 Camera On' : '📷 Camera Off'}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Hamburger Menu */}
        <button
          className="md:hidden fixed top-20 left-4 z-[1000] bg-blue-600 text-white p-3 rounded-full shadow-lg"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
    </div>
  );
};

export default ClientSession;
