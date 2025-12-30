// CoachSession.jsx
// Coach session page for one-on-one video conferencing with clients
// Simplified version of TrainerSession without reinforcement meter, voice input, session notes, and session reports

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import learningContentService from '../../api/services/learningContentService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Whiteboard from '../../components/common/Whiteboard';
import MessageList from '../../components/common/MessageList';
import StopwatchDisplay from '../../components/common/StopwatchDisplay';
import useMessages from '../../hooks/useMessages';
import useStopwatch from '../../hooks/useStopwatch';
import { useMediaControl } from '../../context/MediaControlContext';
import MoveableVideoFeed from '../../components/videoConference/MoveableVideoFeed';
import { FaBars, FaTimes } from 'react-icons/fa';
import Emoji from '../../components/common/Emoji';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import '../../styles/Pages.css';

const CoachSession = () => {
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
  const [videoPosition, setVideoPosition] = useState({ x: 20, y: 20 });
  const [videoSize, setVideoSize] = useState({ width: 320, height: 240 });

  // Mic/video controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  // Messages
  const {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress,
    addReceivedMessage
  } = useMessages(webRTC, 'coach');

  useEffect(() => {
    if (webRTC) {
      webRTC.onMessage = (message) => {
        addReceivedMessage({
          sender: message.sender === 'coach' ? 'You' : message.sender,
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

  const [textMessages, setTextMessages] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [waitingMessage, setWaitingMessage] = useState('');
  const [floatingAnimations, setFloatingAnimations] = useState([]);

  // Learning content
  const [learningContentSearch, setLearningContentSearch] = useState('');
  const [databaseSearchResults, setDatabaseSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Whiteboard state
  const [canvasItems, setCanvasItems] = useState([]);
  const [keyboardMode] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });

  // UI state
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [erasePenTrigger, setErasePenTrigger] = useState(0);
  const [redrawCanvasTrigger, setRedrawCanvasTrigger] = useState(0);

  // Drawing tools
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [buckets, setBuckets] = useState([]);
  const [toolActive, setToolActive] = useState(false);

  // Stopwatch
  const stopwatch = useStopwatch();
  const [showStopwatch, setShowStopwatch] = useState(false);
  const mediaControl = useMediaControl();

  // Initialize session
  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.error('[CoachSession] No user data found in localStorage');
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    console.log('[CoachSession] User data:', { id: user.id, role: user.role, name: user.name });
    
    if (user.role !== 'coach') {
      toast.error('Unauthorized access - coaches only');
      navigate('/');
      return;
    }

    initializeSession(user.id);

    return () => {
      cleanup();
    };
  }, [sessionId]);

  // Connect remote stream to video element
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('[CoachSession] Connecting remote stream to video element');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const initializeSession = async (userId) => {
    try {
      const session = await coachSessionService.getSessionDetails(sessionId);
      console.log('[CoachSession] Session details:', session);
      setSessionInfo(session);

      // Note: The backend validates that the user's coach_profile.id matches session.coach_id
      // So we don't need to check it here - if the request succeeds, they're authorized

      await initializeWebRTC(session.session_id);
      setLoading(false);
    } catch (error) {
      console.error('[CoachSession] Error initializing session:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to initialize session';
      toast.error(errorMsg);
      navigate('/coach/dashboard');
    }
  };

  const initializeWebRTC = async (numericSessionId) => {
    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, numericSessionId, 'coach');
    try {
      wbService.initialize();
      setWhiteboardService(wbService);

      const tbService = new WhiteboardToolsService(wbService);
      setToolsService(tbService);
    } catch (error) {
      console.error('[CoachSession] Error initializing whiteboard:', error);
      toast.error('Failed to initialize whiteboard');
    }

    // Initialize Video Conference Service
    const videoService = new VideoConferenceService(WS_BASE_URL, numericSessionId, 'coach');

    try {
      videoService.onLocalStream = (stream) => {
        console.log('[CoachSession] Local stream initialized');
        setLocalStream(stream);
        setConnectionStatus('Waiting for client...');
      };

      videoService.onRemoteStream = (stream) => {
        console.log('[CoachSession] Received remote stream from client');
        setRemoteStream(stream);
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
        setConnectionStatus(statusMap[state] || state);
      };

      videoService.onError = (error) => {
        console.error('[CoachSession] Video conference error:', error);
        toast.error(`Video error: ${error.message}`);
      };

      await videoService.initialize();
      setWebRTC(videoService);
    } catch (error) {
      console.error('[CoachSession] Video Conference init error:', error);
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
    if (toolsService) {
      toolsService.cleanup();
    }
  };

  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end this session?')) {
      try {
        await coachSessionService.endSession(sessionId);
        cleanup();
        toast.success('Session ended successfully');
        navigate('/coach/dashboard');
      } catch (error) {
        console.error('[CoachSession] Error ending session:', error);
        toast.error('Failed to end session');
      }
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

  const handleToolClick = (toolName) => {
    if (toolsService) {
      toolsService.handleToolClick(toolName, tool, setTool);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  return (
    <div className={`session-page ${pageClassName}`}>
      {/* Session Header */}
      <div className={`session-header ${navbarClassName}`}>
        <div className="session-header-main">
          <div>
            <div className="session-header-title">Coach Session</div>
            <div className="session-header-subtitle">
              {sessionInfo?.client_name || 'Client'} | {sessionInfo?.scheduled_date ? new Date(sessionInfo.scheduled_date).toLocaleDateString() : ''}
            </div>
          </div>
        </div>
        <div className="session-header-controls">
          <button className="btn-session btn-session-end" onClick={handleEndSession}>
            🔴 End Session
          </button>
        </div>
      </div>

      <div className="session-main-container">
        {/* Left Sidebar - Learning Content */}
        <div className={`session-sidebar session-sidebar-left ${isLeftSidebarOpen ? 'open' : ''}`}>
          <div className="session-sidebar-header">
            <h3 className="session-sidebar-title">Learning Content</h3>
            <button className="session-sidebar-close" onClick={() => setIsLeftSidebarOpen(false)}>
              <FaTimes />
            </button>
          </div>
          <div className="session-sidebar-content">
            <p className="text-sm text-gray-600 mb-3">Search and add learning materials to the whiteboard</p>
            {/* Add learning content search UI here */}
          </div>
        </div>

        {/* Center Area - Whiteboard */}
        <div className="session-center-area">
          <div className="session-whiteboard-container">
            {/* Moveable Video Feed Overlay */}
            {remoteStream && (
              <MoveableVideoFeed
                videoStream={remoteStream}
                label="Client"
                position={videoPosition}
                size={videoSize}
                onPositionChange={setVideoPosition}
                onSizeChange={setVideoSize}
                isDraggable={true}
                isResizable={true}
                connectionStatus={connectionStatus}
                zIndex={100}
              />
            )}

            {/* Whiteboard */}
            <div className="w-full h-full">
              <Whiteboard
                whiteboardService={whiteboardService}
                isTrainer={true}
                canvasItems={canvasItems}
                setCanvasItems={setCanvasItems}
                keyboardMode={keyboardMode}
                keyboardText={keyboardText}
                setKeyboardText={setKeyboardText}
                keyboardPosition={keyboardPosition}
                setKeyboardPosition={setKeyboardPosition}
                textMessages={textMessages}
                setTextMessages={setTextMessages}
                feedbackMessage={feedbackMessage}
                waitingMessage={waitingMessage}
                floatingAnimations={floatingAnimations}
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
                stopwatchFormattedTime={stopwatch.isRunning ? stopwatch.formattedTime : null}
                stopwatchIsRunning={stopwatch.isRunning}
                toolActive={toolActive}
              />
            </div>
          </div>

          {/* Video Controls - Below Whiteboard */}
          <div className="w-full mt-4 mb-3">
            <div className="flex items-center justify-center gap-4">
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

          {/* Message Box */}
          <div className="w-full mt-2">
            <div className="session-message-box border-2 border-gray-300 rounded bg-gray-50 p-3">
              <div className="font-semibold text-slate-800 mb-2">💬 Message Box</div>
              <div className="overflow-y-auto mb-2" style={{ maxHeight: '150px' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message-bubble ${msg.sender === 'coach' ? 'message-bubble-sent' : 'message-bubble-received'}`}>
                    <strong>{msg.sender}:</strong> {msg.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-400"
                />
                <button onClick={sendMessage} className="btn-primary px-4 py-2">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Hamburger Menu */}
        <div className="session-mobile-menu">
          <button onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} className="session-menu-btn">
            <FaBars /> Content
          </button>
          <button onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} className="session-menu-btn">
            <FaBars /> Tools
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachSession;
