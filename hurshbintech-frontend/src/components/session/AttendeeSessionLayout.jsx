// AttendeeSessionLayout.jsx
// ============================================================================
// 🔹 Purpose: Shared layout component for Attendee Session Pages
// 🔸 Pages: ClientSession ✅, GuestSession ✅, LearnerSession (future)
// 🔹 Role: Common UI structure and video controls for all attendee types
// 
// 📦 EXPORTS:
// - AttendeeWaitingScreen: Displayed when instructor hasn't joined
// - AttendeeVideoControls: Mic, camera, and leave session buttons
// - RemoteVideoFeed: Instructor's video (top right corner)
// - AttendeeSessionHeader: Session info and status header
// - attendeeSessionStyles: CSS-in-JS for full-screen layout
// 
// 🎯 USAGE:
// import { 
//   AttendeeWaitingScreen,
//   AttendeeVideoControls,
//   RemoteVideoFeed
// } from '../../components/session/AttendeeSessionLayout';
// ============================================================================

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Attendee Session Waiting Screen
 * Displayed when instructor hasn't joined yet
 * Shows local camera preview and media controls while waiting
 */
export const AttendeeWaitingScreen = ({
    sessionInfo,
    attendeeName,
    onBackClick,
    backButtonText = 'Back to Home',
    pageClassName = '',
    navbarClassName = '',
    localVideoRef = null,
    localStream = null,
    micEnabled = true,
    cameraEnabled = true,
    onToggleMic = null,
    onToggleCamera = null
}) => {
    React.useEffect(() => {
        // Display local stream in video element when it becomes available
        if (localVideoRef?.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, localVideoRef]);

    return (
        <div className={`learner-session-page ${pageClassName}`}>
            <div className={`session-header ${navbarClassName}`}>
                <div className="session-header-main">
                    <div>
                        <div className="session-header-title">Session</div>
                        <div className="session-header-subtitle">
                            Welcome, {attendeeName || 'Guest'}
                        </div>
                    </div>
                    <div className="session-header-controls">
                        <button className="btn-session btn-session-end" onClick={onBackClick}>
                            🏠 {backButtonText}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 150px)' }}>
                <div style={{ width: '100%', maxWidth: '600px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Local Video Preview - Show while waiting */}
                    {localStream && (
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '16 / 9',
                            backgroundColor: '#000',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}>
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: 'scaleX(-1)' // Mirror effect
                                }}
                            />
                            {/* Media Status Indicators */}
                            <div style={{
                                position: 'absolute',
                                bottom: '12px',
                                right: '12px',
                                display: 'flex',
                                gap: '8px'
                            }}>
                                {cameraEnabled && (
                                    <div style={{
                                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                        color: '#10b981',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        📹 Camera On
                                    </div>
                                )}
                                {micEnabled && (
                                    <div style={{
                                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                        color: '#10b981',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        🎤 Mic On
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Waiting Message Card */}
                    <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
                        <div className="text-6xl mb-4 animate-bounce">⏳</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-3">
                            Waiting for Instructor
                        </h2>
                        <p className="text-gray-600 mb-4">
                            Your session is ready and you're connected!
                        </p>
                        <p className="text-gray-600 mb-6">
                            Please wait while <strong>{sessionInfo?.instructor_name || 'your instructor'}</strong> joins the session.
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

                    {/* Media Control Buttons */}
                    {localStream && (
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            justifyContent: 'center'
                        }}>
                            <button
                                onClick={onToggleMic}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: micEnabled ? '#10b981' : '#ef4444',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                }}
                                title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                            >
                                {micEnabled ? '🎤' : '🔇'} {micEnabled ? 'Mic On' : 'Mic Off'}
                            </button>
                            <button
                                onClick={onToggleCamera}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: cameraEnabled ? '#10b981' : '#ef4444',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                }}
                                title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                            >
                                {cameraEnabled ? '📹' : '🚫'} {cameraEnabled ? 'Camera On' : 'Camera Off'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

AttendeeWaitingScreen.propTypes = {
    sessionInfo: PropTypes.object,
    attendeeName: PropTypes.string,
    onBackClick: PropTypes.func.isRequired,
    backButtonText: PropTypes.string,
    pageClassName: PropTypes.string,
    navbarClassName: PropTypes.string,
    localVideoRef: PropTypes.object,
    localStream: PropTypes.object,
    micEnabled: PropTypes.bool,
    cameraEnabled: PropTypes.bool,
    onToggleMic: PropTypes.func,
    onToggleCamera: PropTypes.func
};

/**
 * Attendee Video Controls (Above Whiteboard)
 * Microphone, Camera, and Leave Session buttons
 * ✅ Fully Responsive - adapts to mobile, tablet, and desktop
 */
export const AttendeeVideoControls = ({
    micEnabled,
    cameraEnabled,
    onToggleMic,
    onToggleCamera,
    onLeaveSession
}) => {
    return (
        <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            gap: 'clamp(4px, 1vw, 8px)',
            zIndex: 50,
            // backgroundColor: 'rgba(0,0,0,0.7)',
            padding: 'clamp(6px, 1vh, 8px) clamp(8px, 1.5vw, 12px)',
            borderRadius: 'clamp(4px, 0.8vw, 6px)',
            flexWrap: 'nowrap',
            justifyContent: 'center',
            maxWidth: '100%',
            boxSizing: 'border-box'
        }}>
            <button
                onClick={onToggleMic}
                className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{
                    padding: 'clamp(4px, 0.8vh, 6px) clamp(8px, 1.5vw, 12px)',
                    fontSize: 'clamp(10px, 1.5vw, 13px)',
                    gap: 'clamp(3px, 0.6vw, 5px)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    minWidth: 'auto'
                }}
                title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
            >
                <span>{micEnabled ? '🎤' : '🔇'}</span>
                <span style={{ display: window.innerWidth < 400 ? 'none' : 'inline' }}>
                    {micEnabled ? ' Mic On' : ' Mic Off'}
                </span>
            </button>

            <button
                onClick={onToggleCamera}
                className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{
                    padding: 'clamp(4px, 0.8vh, 6px) clamp(8px, 1.5vw, 12px)',
                    fontSize: 'clamp(10px, 1.5vw, 13px)',
                    gap: 'clamp(3px, 0.6vw, 5px)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    minWidth: 'auto'
                }}
                title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
            >
                <span>{cameraEnabled ? '📹' : '📷'}</span>
                <span style={{ display: window.innerWidth < 400 ? 'none' : 'inline' }}>
                    {cameraEnabled ? ' Video On' : ' Video Off'}
                </span>
            </button>

            <button
                onClick={onLeaveSession}
                className="bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center transition-all duration-200 shadow-md"
                style={{
                    padding: 'clamp(4px, 0.8vh, 6px) clamp(8px, 1.5vw, 12px)',
                    fontSize: 'clamp(10px, 1.5vw, 13px)',
                    gap: 'clamp(3px, 0.6vw, 5px)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    minWidth: 'auto'
                }}
                title="Leave Session"
            >
                <span>🚪</span>
                <span style={{ display: window.innerWidth < 400 ? 'none' : 'inline' }}>
                    {' Leave Session'}
                </span>
            </button>
        </div>
    );
};

AttendeeVideoControls.propTypes = {
    micEnabled: PropTypes.bool.isRequired,
    cameraEnabled: PropTypes.bool.isRequired,
    onToggleMic: PropTypes.func.isRequired,
    onToggleCamera: PropTypes.func.isRequired,
    onLeaveSession: PropTypes.func.isRequired
};

/**
 * Remote Video Feed (Instructor's Video - Top Right Corner)
 */
export const RemoteVideoFeed = ({ remoteVideoRef, remoteStream, topPosition = '4px', label = 'Instructor' }) => {
    if (!remoteStream) return null;

    return (
        <div style={{
            position: 'absolute',
            top: topPosition,
            right: '4px',
            width: 'clamp(120px, 15vw, 250px)',
            height: 'clamp(90px, 12vw, 180px)',
            backgroundColor: '#000',
            borderRadius: '8px',
            border: '2px solid #374151',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}
            className="remote-video-feed-overlay">
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
                {label}
            </div>
        </div>
    );
};

RemoteVideoFeed.propTypes = {
    remoteVideoRef: PropTypes.object.isRequired,
    remoteStream: PropTypes.object,
    topPosition: PropTypes.string,
    label: PropTypes.string
};

/**
 * Session Header for Attendee
 */
export const AttendeeSessionHeader = ({
    title = 'Session',
    subtitle,
    connectionStatus,
    timeLeft,
    navbarClassName = ''
}) => {
    return (
        <div className={`session-header ${navbarClassName}`}>
            <div className="session-header-main">
                <div>
                    <div className="session-header-title">{title}</div>
                    {subtitle && <div className="session-header-subtitle">{subtitle}</div>}
                </div>

                <div className="session-header-controls">
                    <div className="session-header-info">
                        Status: <strong>{connectionStatus}</strong>
                    </div>
                    {timeLeft && (
                        <div className="session-header-info">
                            Time Left: <strong>{timeLeft}</strong>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

AttendeeSessionHeader.propTypes = {
    title: PropTypes.string,
    subtitle: PropTypes.string,
    connectionStatus: PropTypes.string,
    timeLeft: PropTypes.string,
    navbarClassName: PropTypes.string
};

/**
 * Attendee Comments Panel
 * Displays trainer comments and allows attendee to send comments
 * Used by: ClientSession, GuestSession, LearnerSession
 */
export const AttendeeCommentsPanel = ({
    isOpen,
    setIsOpen,
    trainerComments,
    commentInput,
    setCommentInput,
    onSendComment,
    onFlushComment,
    sessionType = 'client'
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            width: 'clamp(200px, 25vw, 350px)',
            maxHeight: '400px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
            border: '1px solid #e5e7eb',
            animation: 'slideUp 0.3s ease-out'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                backgroundColor: '#f9fafb',
                borderRadius: '8px 8px 0 0'
            }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#374151' }}>
                    💬 Comments
                </span>
            </div>

            {/* Comment Input */}
            <div style={{
                padding: '12px',
                display: 'flex',
                gap: '6px',
                alignItems: 'flex-end',
                backgroundColor: '#f9fafb',
                borderRadius: '0 0 8px 8px'
            }}>
                <textarea
                    value={commentInput}
                    onChange={(e) => {
                        setCommentInput(e.target.value);
                        onSendComment(e.target.value);
                    }}
                    onBlur={(e) => {
                        onFlushComment(e.target.value);
                    }}
                    placeholder="Type a comment..."
                    style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        resize: 'none',
                        minHeight: '36px',
                        maxHeight: '80px',
                        overflowY: 'auto'
                    }}
                />
            </div>
        </div>
    );
};

AttendeeCommentsPanel.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    setIsOpen: PropTypes.func.isRequired,
    trainerComments: PropTypes.array,
    commentInput: PropTypes.string,
    setCommentInput: PropTypes.func.isRequired,
    onSendComment: PropTypes.func.isRequired,
    onFlushComment: PropTypes.func.isRequired,
    sessionType: PropTypes.string
};

/**
 * Full-Screen Session Styles (CSS-in-JS)
 */
export const attendeeSessionStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

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

  .session-header {
    flex-shrink: 0;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .learner-main-container {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 !important;
    width: 100% !important;
    height: 100% !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0rem !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  @media (max-width: 767px) {
    .learner-main-container {
      padding: 0rem !important;
    }
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

  /* Mobile: Ensure whiteboard wrapper takes proper height */
  @media (max-width: 768px) {
    .learner-whiteboard-wrapper {
      flex: 1 1 auto !important;
      /* Shorter height for mobile portrait - accounting for metrics header */
      min-height: calc(100svh - 120px) !important;
      /* Use dvh (dynamic viewport) for when address bar hides */
      min-height: calc(100dvh - 120px) !important;
      /* iOS Safari fallback */
      min-height: calc(-webkit-fill-available - 120px) !important;
      /* Limit max height to prevent excessive scrolling */
      max-height: calc(100dvh - 60px) !important;
      max-height: calc(-webkit-fill-available - 60px) !important;
      /* Account for safe area insets at bottom (navigation bars, rounded corners) */
      padding-bottom: env(safe-area-inset-bottom, 0) !important;
    }

    /* Ensure whiteboard container and canvas fill available space */
    .session-whiteboard-container {
      min-height: 100% !important;
    }

    .learner-whiteboard-wrapper canvas {
      /* Touch-action for better mobile interaction */
      touch-action: none !important;
    }

    .learner-session-page {
      height: 100vh !important;
    }
  }

  /* Very small phones (iPhone SE, etc.) */
  @media (max-width: 375px) and (max-height: 667px) {
    .learner-metrics-header {
      padding: 4px 4px !important;
      gap: 8px !important;
    }

    .learner-whiteboard-wrapper {
      /* Smaller height for tiny screens */
      min-height: calc(100svh - 100px) !important;
      min-height: calc(100dvh - 100px) !important;
      min-height: calc(-webkit-fill-available - 100px) !important;
      max-height: calc(100dvh - 50px) !important;
    }
  }

  /* Mobile Landscape Mode - Optimize for horizontal orientation */
  @media (max-width: 768px) and (orientation: landscape) {
    .learner-session-page {
      /* In landscape, use full height - browser chrome typically hidden when scrolled */
      height: 100vh !important;
      height: 100dvh !important;
      height: -webkit-fill-available !important;
      /* Prevent scrolling in landscape - should fit perfectly */
      overflow: hidden !important;
    }

    .learner-main-container {
      /* No scrolling needed in landscape */
      overflow: hidden !important;
    }

    .learner-whiteboard-wrapper {
      /* In landscape, fit perfectly in viewport when browser chrome is hidden */
      min-height: calc(100vh - 40px) !important;
      max-height: calc(100vh - 40px) !important;
      height: calc(100vh - 40px) !important;
      /* Use dvh for dynamic adjustment */
      min-height: calc(100dvh - 40px) !important;
      max-height: calc(100dvh - 40px) !important;
      height: calc(100dvh - 40px) !important;
      /* iOS Safari fallback */
      min-height: calc(-webkit-fill-available - 40px) !important;
      max-height: calc(-webkit-fill-available - 40px) !important;
      /* Remove bottom padding in landscape */
      padding-bottom: 0 !important;
    }
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

  /* Header with Metrics - Full width */
  .learner-metrics-header {
    width: 100% !important;
    box-sizing: border-box !important;
    flex-shrink: 0 !important;
    padding: 8px 8px !important;
    margin: 0 !important;
    gap: 12px !important;
    overflow: visible !important;
  }

  /* Hide sidebar toggles in full-width learner mode */
  .session-sidebar-toggles {
    display: none !important;
  }

  /* Remote Video Feed - Responsive positioning */
  .remote-video-feed-overlay {
    /* Mobile portrait - smaller size, better positioned */
  }

  @media (max-width: 768px) {
    .remote-video-feed-overlay {
      width: clamp(100px, 20vw, 150px) !important;
      height: clamp(75px, 15vw, 115px) !important;
      right: 4px !important;
    }
  }

  @media (max-width: 768px) and (orientation: landscape) {
    .learner-metrics-header {
      /* Minimize header in landscape to maximize whiteboard space */
      padding: 2px 4px !important;
      gap: 6px !important;
      font-size: 12px !important;
    }

    /* Make metrics header elements more compact */
    .learner-metrics-header > div {
      font-size: 11px !important;
    }

    .learner-metrics-header span {
      font-size: 11px !important;
    }

    .remote-video-feed-overlay {
      /* In landscape mobile, make video feed smaller and position better */
      width: clamp(80px, 12vw, 120px) !important;
      height: clamp(60px, 9vw, 90px) !important;
      top: 2px !important;
      right: 4px !important;
    }
  }

  /* Safe area handling for mobile devices with notches */
  @media (max-width: 768px) {
    .learner-metrics-header {
      padding-top: max(8px, env(safe-area-inset-top, 8px)) !important;
      padding-left: max(8px, env(safe-area-inset-left, 8px)) !important;
      padding-right: max(8px, env(safe-area-inset-right, 8px)) !important;
    }
  }

  /* Desktop: Use regular viewport height and prevent overflow */
  @media (min-width: 769px) {
    .learner-session-page {
      height: 100vh !important;
      min-height: 100vh !important;
      overflow: hidden !important;
    }
  }
`;

/**
 * Instructor Comments Display Panel
 * Displays comments received from attendees (guests, clients, learners)
 * Used by: CoachSession, TrainerSession
 */
export const InstructorCommentsDisplay = ({
    comments = [],
    isOpen = true,
    maxHeight = '300px'
}) => {
    if (!isOpen || !comments || comments.length === 0) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '120px',
            right: '20px',
            width: 'clamp(250px, 30vw, 400px)',
            maxHeight: maxHeight,
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            border: '2px solid #3b82f6',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
            animation: 'slideUp 0.3s ease-out'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px',
                borderRadius: '6px 6px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span>💬 Attendee Comments ({comments.length})</span>
            </div>

            {/* Comments List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: '#f0f4f8'
            }}>
                {comments.map((comment, idx) => (
                    <div key={idx} style={{
                        backgroundColor: 'white',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        borderLeft: '3px solid #3b82f6',
                        fontSize: '13px'
                    }}>
                        <div style={{
                            fontWeight: 'bold',
                            color: '#1e40af',
                            marginBottom: '4px',
                            textTransform: 'capitalize'
                        }}>
                            {comment.sender || 'Unknown'}:
                        </div>
                        <div style={{
                            color: '#374151',
                            wordWrap: 'break-word'
                        }}>
                            {comment.text}
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: '#9ca3af',
                            marginTop: '4px'
                        }}>
                            {new Date(comment.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

InstructorCommentsDisplay.propTypes = {
    comments: PropTypes.array,
    isOpen: PropTypes.bool,
    maxHeight: PropTypes.string
};

