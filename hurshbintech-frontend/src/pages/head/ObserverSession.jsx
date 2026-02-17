// ObserverSession.jsx
// -------------------------------------------------------------
// 🔹 Purpose: Observer view for Head user to watch trainer's screen
// 🔸 How it works: Connects as "observer" role via WebRTC, receives trainer's screen share
// in full-screen mode. Does not send own media.
// -------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import VideoConferenceService from '../../api/services/videoConferenceService';
import { useAuth } from '../../context/AuthContext';

const ObserverSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  // ✅ FIX: Use Ref to hold service instance for robust cleanup (prevents stale closure)
  const webRTCRef = useRef(null);
  const screenVideoRef = useRef(null);
  const containerRef = useRef(null);

  // UI State
  const [trainerScreen, setTrainerScreen] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // -----------------------------------------------------------
  // Initialize WebRTC as Observer (passive receiver - no camera/mic)
  // -----------------------------------------------------------
  useEffect(() => {
    let isMounted = true; // Track if component is still mounted

    const initialize = async () => {
      try {
        console.log('[ObserverSession] Initializing observer for session:', sessionId);

        // 1. Initialize Video Conference Service (observer mode - no sending)
        const videoService = new VideoConferenceService(
          WS_BASE_URL,
          sessionId,
          'observer',
          true // isObserver flag - prevents camera/mic access
        );

        // ✅ FIX: Store in ref immediately for cleanup safety
        webRTCRef.current = videoService;

        // 2. Setup Callbacks
        videoService.onRemoteStream = (stream) => {
          if (!isMounted) return;
          console.log('[ObserverSession] Received trainer screen stream');
          setTrainerScreen(stream);
          setConnectionStatus('Connected');
          toast.success("Connected to trainer's screen");
        };

        videoService.onConnectionStateChange = (state) => {
          if (!isMounted) return;
          const statusMap = {
            'connecting': 'Connecting...',
            'connected': 'Connected',
            'disconnected': 'Disconnected',
            'failed': 'Connection Failed',
            'closed': 'Connection Closed'
          };
          setConnectionStatus(statusMap[state] || state);

          // Only show warnings for critical state changes, not during normal connection
          if (state === 'failed') {
            toast.error('Connection to trainer failed');
          }
        };

        videoService.onError = (error) => {
          if (!isMounted) return;
          console.error('[ObserverSession] WebRTC Error:', error);
          // Only show critical errors, not connection attempts
          if (error.message && !error.message.includes('getUserMedia')) {
            toast.error(`Connection error: ${error.message}`);
          }
        };

        // 4. Handle trainer stopping screen share or disconnecting
        videoService.onScreenShareStopped = () => {
          if (!isMounted) return;
          console.log('[ObserverSession] Trainer stopped screen share or disconnected');
          toast.info('Trainer has stopped the session');

          // Close connection and navigate back
          if (webRTCRef.current) {
            webRTCRef.current.close();
            webRTCRef.current = null;
          }

          setTimeout(() => {
            navigate('/head/manage-sessions');
          }, 1500);
        };

        // 5. Connect to session (will not request camera/mic for observer)
        // Pass user data to be sent to trainer
        const observerUserData = user ? { id: user.id, name: user.name } : null;
        await videoService.initialize(observerUserData);

        if (isMounted) {
          setLoading(false);
          console.log('[ObserverSession] Initialization complete');
        }

      } catch (error) {
        console.error('[ObserverSession] Init failed:', error);
        // Only show error if it's a real failure (not just WebRTC setup)
        if (isMounted && error.name !== 'NotAllowedError' && error.name !== 'NotFoundError') {
          toast.error('Failed to join as observer');
        }
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    // ✅ FIX: Cleanup function now works correctly using ref
    return () => {
      isMounted = false; // Mark as unmounted
      if (webRTCRef.current) {
        console.log('[ObserverSession] Cleaning up WebRTC...');
        webRTCRef.current.close();
        webRTCRef.current = null;
      }
    };
  }, [sessionId, user, navigate]);

  // Update screen video element when stream changes
  useEffect(() => {
    if (screenVideoRef.current && trainerScreen) {
      screenVideoRef.current.srcObject = trainerScreen;
    }
  }, [trainerScreen]);

  // Handle leave observer session
  const handleLeave = () => {
    // Cleanup is handled automatically by useEffect return when navigating
    toast.success('Left observation session');
    navigate('/head/manage-sessions');
  };

  // Handle fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('[ObserverSession] Fullscreen error:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="loading-spinner mb-4" style={{ borderTopColor: '#fff' }}></div>
          <p className="text-white text-lg">Connecting to trainer's screen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-white font-semibold text-sm">Observing Session</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${connectionStatus === 'Connected'
              ? 'bg-green-600 text-white'
              : 'bg-yellow-600 text-white'
            }`}>
            {connectionStatus}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <button
            onClick={handleLeave}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            <X size={16} />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Full-Screen Video Container - Fills remaining viewport */}
      <div
        ref={containerRef}
        className="flex-1 bg-black relative overflow-hidden flex items-center justify-center p-4"
      >
        {trainerScreen ? (
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Screen Share Video in Contained Box */}
            <div className="relative w-full h-full max-w-7xl mx-auto bg-gray-950 rounded-lg overflow-hidden shadow-2xl">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                style={{ backgroundColor: '#000' }}
              />


            </div>
          </div>
        ) : (
          <div className="text-center max-w-md text-white">
            <div className="loading-spinner mb-4 mx-auto" style={{ borderTopColor: '#fff' }}></div>
            <p className="text-xl font-semibold mb-2">Waiting for trainer's screen...</p>
            <p className="text-sm text-gray-400 mb-4">
              The trainer has been prompted to share their screen
            </p>
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 text-left">
              <p className="text-xs text-yellow-300 mb-2">🔒 Browser Security Note:</p>
              <p className="text-xs text-gray-300">
                Screen sharing requires the trainer to approve the browser permission dialog.
                This happens automatically - they just need to click "Share" in the prompt.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ObserverSession;