// AttendeeSessionLayout.jsx
// ============================================================================
// 🔹 Purpose: Shared layout component for Attendee Session Pages
// 🔸 Pages: ClientSession ✅, GuestSession ✅, LearnerSession ✅
// 🔹 Role: Common UI structure and video controls for all attendee types
// 
// 📦 EXPORTS:
// - AttendeeWaitingScreen: Displayed when instructor hasn't joined
// - AttendeeVideoControls: Mic, camera, and leave session buttons
// - RemoteVideoFeed: Instructor's video (top right corner)
// - AttendeeSessionHeader: Session info and status header
// - AttendeeMetricsHeader: P:, R:, Prompt line with bulb (NEW)
// - AttendeeMainLayout: Complete session layout wrapper (NEW)
// - AttendeeWaitingModal: Reusable waiting modal (NEW)
// - usePromptAnimation: Hook for prompt animations (NEW)
// - useBulbGlowAnimation: Hook for bucket glow animations (NEW)
// - attendeeSessionStyles: CSS-in-JS for full-screen layout
// 
// 🎯 USAGE:
// import { 
//   AttendeeMainLayout,
//   AttendeeMetricsHeader,
//   usePromptAnimation
// } from '../../components/session/AttendeeSessionLayout';
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Clock, Mic, MicOff, Video, VideoOff, PhoneOff, Bold } from 'lucide-react';

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
            {/* <div className={`session-header ${navbarClassName}`}>
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
            </div> */}

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
            bottom: '0.5rem',
            right: '0.5rem',
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
                    💬 Response
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

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
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
    overflow: auto !important;
    max-height: 120px !important;
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
      max-height: 100px !important;
      overflow-y: auto !important;
    }

    /* Make metrics header elements more compact */
    .learner-metrics-header > div {
      font-size: 11px !important;
      flex-shrink: 0 !important;
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

  /* Prompt display box constraints - fully responsive */
  .prompt-bulb-container {
    flex: 1 !important;
    min-width: 0 !important;
    overflow: visible !important;
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

/**
 * Custom Hook: Prompt Animation
 * Handles automatic prompt line opening and animation when promptText changes
 */
export const usePromptAnimation = (promptText, defaultText = '[Prompts from instructor will appear here]') => {
    const [isPromptLineOpen, setIsPromptLineOpen] = useState(false);
    const [promptLineAnimating, setPromptLineAnimating] = useState(false);
    const prevPromptTextRef = useRef(promptText);

    useEffect(() => {
        // Skip if no prompt text or if it's the default text
        if (!promptText || promptText === defaultText) {
            return;
        }

        // Only trigger animation if the prompt text actually changed
        if (prevPromptTextRef.current !== promptText) {
            // console.log('[usePromptAnimation] New prompt received:', promptText);

            // Auto-open Prompt Line when new prompt is received
            setIsPromptLineOpen(true);

            // Trigger animation
            setPromptLineAnimating(true);
            const timer = setTimeout(() => {
                setPromptLineAnimating(false);
            }, 2000);

            // Update the previous prompt text reference
            prevPromptTextRef.current = promptText;

            return () => clearTimeout(timer);
        }
    }, [promptText, defaultText]);

    return {
        isPromptLineOpen,
        setIsPromptLineOpen,
        promptLineAnimating
    };
};

/**
 * Custom Hook: Bulb Glow Animation
 * Handles bulb glow effect when bucket color changes
 */
export const useBulbGlowAnimation = (bucketColor) => {
    const [isBulbGlowing, setIsBulbGlowing] = useState(false);
    const bulbGlowTimerRef = useRef(null);

    useEffect(() => {
        if (bucketColor) {
            setIsBulbGlowing(true);
            if (bulbGlowTimerRef.current) {
                clearTimeout(bulbGlowTimerRef.current);
            }
            bulbGlowTimerRef.current = setTimeout(() => {
                setIsBulbGlowing(false);
            }, 2000);
        }
        return () => {
            if (bulbGlowTimerRef.current) {
                clearTimeout(bulbGlowTimerRef.current);
            }
        };
    }, [bucketColor]);

    return isBulbGlowing;
};

/**
 * Attendee Metrics Header
 * Displays P: (Prompt), R: (Reinforcement), Prompt Line with 💡 bulb
 * Used by: ClientSession, GuestSession, LearnerSession
 */
export const AttendeeMetricsHeader = ({
    promptMeter = 0,
    reinforcementMeter = 0,
    promptText = '[Prompts from instructor will appear here]',
    defaultPromptText = '[Prompts from instructor will appear here]',
    children, // For video controls or custom content
    style = {}
}) => {
    const { isPromptLineOpen, setIsPromptLineOpen, promptLineAnimating } = usePromptAnimation(promptText, defaultPromptText);

    return (
        <div className="learner-metrics-header" style={{
            display: 'flex',
            position: 'relative',
            alignItems: 'flex-start',
            gap: 'clamp(6px, 1.5vw, 12px)',
            padding: 'clamp(6px, 1.2vh, 8px) clamp(6px, 1.2vw, 8px)',
            backgroundColor: 'white',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            flexWrap: 'wrap',
            margin: '0',
            width: '100%',
            boxSizing: 'border-box',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            minHeight: 'clamp(50px, 6vh, 80px)',
            maxHeight: 'clamp(100px, 15vh, 180px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            ...style
        }}>
            {/* defensive styles to ensure bulb is clickable even if overlays exist */}
            <style>{`
                .prompt-bulb-clickable { z-index: 99999 !important; pointer-events: auto !important; cursor: pointer !important; position: relative; display: inline-block; }
                .prompt-bulb-container { z-index: 99998 !important; pointer-events: auto !important; }
            `}</style>

            {/* Prompt Level */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.8vw, 6px)', whiteSpace: 'nowrap', flexShrink: 0, order: 1 }}>
                <span style={{ fontWeight: 'bold', fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#d97706' }}>P:</span>
                <span style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 'bold', color: '#d97706' }}>{promptMeter}</span>
            </div>


            {/* Reinforcement Level */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.8vw, 6px)', whiteSpace: 'nowrap', flexShrink: 0, order: 2 }}>
                <span style={{ fontWeight: 'bold', fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#16a34a' }}>R:</span>
                <span style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 'bold', color: '#16a34a' }}>{reinforcementMeter}</span>
            </div>


            {/* Prompt Line with Bulb */}
            <div className="prompt-bulb-container" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.2vw, 8px)', position: 'relative', zIndex: 10, flex: 1, minWidth: 0, order: 3, width: '100%', minHeight: 0 }}>
                <span className="prompt-bulb-clickable"
                    onClick={(e) => {
                        e.stopPropagation();
                        // console.log('[Bulb Click] Current state:', isPromptLineOpen, '-> toggling to:', !isPromptLineOpen);
                        setIsPromptLineOpen(!isPromptLineOpen);
                    }}
                    style={{
                        fontSize: 'clamp(20px, 3.5vw, 24px)',
                        filter: promptLineAnimating ? 'drop-shadow(0 0 12px #fbbf24) drop-shadow(0 0 20px rgba(251, 191, 36, 0.6))' : promptText !== defaultPromptText ? 'drop-shadow(0 0 8px #fbbf24)' : 'none',
                        animation: promptLineAnimating ? 'pulse 1.5s ease-in-out infinite' : 'none',
                        transition: 'filter 0.3s ease, transform 0.2s ease',
                        transform: isPromptLineOpen ? 'scale(1.1)' : 'scale(1)',
                        userSelect: 'none',
                        display: 'inline-block',
                        padding: '2px',
                        position: 'relative',
                        flexShrink: 0
                    }}
                    title="Click to toggle prompt visibility"
                >
                    💡
                </span>
                {isPromptLineOpen && (
                    <div style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: 'clamp(4px, 0.8vw, 6px)',
                        padding: 'clamp(6px, 1.2vw, 8px) clamp(8px, 1.5vw, 12px)',
                        border: promptText !== defaultPromptText ? '2px solid #fbbf24' : '1px solid #e5e7eb',
                        flex: 1,
                        maxHeight: 'clamp(50px, 8vh, 100px)',
                        overflowY: 'auto',
                        transition: 'border 0.3s ease',
                        boxSizing: 'border-box',
                        minWidth: 0
                    }}>
                        <p style={{
                            fontSize: 'clamp(10px, 1.8vw, 12px)',
                            color: '#374151',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            overflow: 'hidden'
                        }}>
                            {promptText !== defaultPromptText ? promptText : 'Waiting for prompt...'}
                        </p>
                    </div>
                )}
            </div>

            {/* Custom content (e.g., video controls) */}
            {children}
        </div>
    );
};

AttendeeMetricsHeader.propTypes = {
    promptMeter: PropTypes.number,
    reinforcementMeter: PropTypes.number,
    promptText: PropTypes.string,
    defaultPromptText: PropTypes.string,
    children: PropTypes.node,
    style: PropTypes.object
};

/**
 * Attendee Waiting Modal
 * Reusable modal for waiting states (instructor not joined, connection issues, etc.)
 */
export const AttendeeWaitingModal = ({
    show,
    title = 'Waiting for Instructor',
    description = "The instructor is starting the session. You'll be automatically added once they begin! ✨",
    retrying = false,
    onRetry,
    onCancel,
    retryButtonText = '🔄 Retry Now',
    cancelButtonText = 'Back to Dashboard'
}) => {
    if (!show) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '480px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                animation: 'slideUp 0.3s ease-out',
            }}>
                <style>{`
                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.6; }
                    }
                `}</style>

                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '24px',
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }}>
                        <Clock size={48} color="#f59e0b" style={{ animation: 'spin 2s linear infinite' }} />
                    </div>
                </div>

                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: '0 0 12px 0',
                }}>
                    {title}
                </h2>

                <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '0 0 24px 0',
                    lineHeight: '1.6',
                }}>
                    {description}
                </p>

                <div style={{
                    backgroundColor: '#dbeafe',
                    border: '1px solid #93c5fd',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '24px',
                    fontSize: '13px',
                    color: '#1e40af',
                }}>
                    🔄 Auto-joining in progress... or click "Retry Now" to join immediately
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center',
                }}>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            disabled={retrying}
                            style={{
                                flex: 1,
                                padding: '12px 24px',
                                backgroundColor: retrying ? '#d1d5db' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: retrying ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                if (!retrying) e.target.style.backgroundColor = '#059669';
                            }}
                            onMouseLeave={(e) => {
                                if (!retrying) e.target.style.backgroundColor = '#10b981';
                            }}
                        >
                            {retrying ? 'Checking...' : retryButtonText}
                        </button>
                    )}

                    {onCancel && (
                        <button
                            onClick={onCancel}
                            disabled={retrying}
                            style={{
                                flex: 1,
                                padding: '12px 24px',
                                backgroundColor: retrying ? '#d1d5db' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: retrying ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                if (!retrying) e.target.style.backgroundColor = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                                if (!retrying) e.target.style.backgroundColor = '#3b82f6';
                            }}
                        >
                            {cancelButtonText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

AttendeeWaitingModal.propTypes = {
    show: PropTypes.bool.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    retrying: PropTypes.bool,
    onRetry: PropTypes.func,
    onCancel: PropTypes.func,
    retryButtonText: PropTypes.string,
    cancelButtonText: PropTypes.string
};

/**
 * Attendee Main Layout
 * Complete wrapper for attendee session pages
 * Provides consistent structure: Metrics Header → Whiteboard → Extras
 */
export const AttendeeMainLayout = ({
    pageClassName = '',
    customStyles = attendeeSessionStyles,
    metricsHeaderProps = {},
    children
}) => {
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
            <style>{customStyles}</style>
            {children}
        </div>
    );
};

AttendeeMainLayout.propTypes = {
    pageClassName: PropTypes.string,
    customStyles: PropTypes.string,
    metricsHeaderProps: PropTypes.object,
    children: PropTypes.node.isRequired
};

/**
 * Attendee Whiteboard Section
 * Common nested div structure for whiteboard area
 * Used by all three session types (learner, guest, client)
 */
export const AttendeeWhiteboardSection = ({ children }) => {
    return (
        <div className="learner-whiteboard-wrapper">
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div className="session-whiteboard-container">
                    {children}
                </div>
            </div>
        </div>
    );
};

AttendeeWhiteboardSection.propTypes = {
    children: PropTypes.node.isRequired
};

/**
 * Attendee Exercise Tool Container
 * Container for exercise tool below whiteboard
 * Used by GuestSession and ClientSession (LearnerSession uses overlay)
 */
export const AttendeeExerciseToolContainer = ({ show, children }) => {
    if (!show) return null;

    return (
        <div className="exercise-tool-container" style={{
            marginTop: '20px',
            padding: '0 10px',
            position: 'relative'
        }}>
            {children}
        </div>
    );
};

AttendeeExerciseToolContainer.propTypes = {
    show: PropTypes.bool.isRequired,
    children: PropTypes.node
};

/**
 * Attendee Session Root Container
 * Root wrapper with audio, styles, and page className
 * Used by all three session types
 */
export const AttendeeSessionRoot = ({
    pageClassName = '',
    audioRef,
    customStyles = attendeeSessionStyles,
    children
}) => {
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
            <audio ref={audioRef} crossOrigin="anonymous" style={{ display: 'none' }} />
            <style>{customStyles}</style>
            {children}
        </div>
    );
};

AttendeeSessionRoot.propTypes = {
    pageClassName: PropTypes.string,
    audioRef: PropTypes.object,
    customStyles: PropTypes.string,
    children: PropTypes.node.isRequired
};

/**
 * Attendee Metrics Header With Controls
 * Metrics header with centered video controls
 * Used by GuestSession and ClientSession (LearnerSession has different structure)
 */
export const AttendeeMetricsHeaderWithControls = ({
    promptMeter,
    reinforcementMeter,
    promptText,
    micEnabled,
    cameraEnabled,
    onToggleMic,
    onToggleCamera,
    onLeaveSession
}) => {
    return (
        <AttendeeMetricsHeader
            promptMeter={promptMeter}
            reinforcementMeter={reinforcementMeter}
            promptText={promptText}
        >
            {/* Centered Video Controls */}
            <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 60,
                pointerEvents: 'auto'
            }}>
                <AttendeeVideoControls
                    micEnabled={micEnabled}
                    cameraEnabled={cameraEnabled}
                    onToggleMic={onToggleMic}
                    onToggleCamera={onToggleCamera}
                    onLeaveSession={onLeaveSession}
                />
            </div>
        </AttendeeMetricsHeader>
    );
};

AttendeeMetricsHeaderWithControls.propTypes = {
    promptMeter: PropTypes.number.isRequired,
    reinforcementMeter: PropTypes.number.isRequired,
    promptText: PropTypes.string,
    micEnabled: PropTypes.bool.isRequired,
    cameraEnabled: PropTypes.bool.isRequired,
    onToggleMic: PropTypes.func.isRequired,
    onToggleCamera: PropTypes.func.isRequired,
    onLeaveSession: PropTypes.func.isRequired
};

/**
 * Attendee Whiteboard With Video Component
 * Complete whiteboard setup with remote video feed for Guest/Client sessions
 * Used by: GuestSession, ClientSession (LearnerSession has custom setup)
 */
export const AttendeeWhiteboardWithVideo = ({
    remoteVideoRef,
    remoteStream,
    whiteboardService,
    canvasItems,
    setCanvasItems,
    toolAccess,
    remoteSelectedItemIds,
    textMessages,
    setTextMessages,
    feedbackMessage,
    waitingMessage,
    floatingAnimations,
    onAnimationPop,
    erasePenTrigger,
    redrawCanvasTrigger,
    buckets,
    setBuckets,
    textBoxes,
    activeTextBoxId,
    setActiveTextBoxId,
    tool,
    setTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    keyboardMode,
    keyboardText,
    setKeyboardText,
    keyboardPosition,
    setKeyboardPosition,
    stopwatchFormattedTime,
    stopwatchIsRunning,
    Whiteboard
}) => {
    return (
        <>
            {/* Remote Video Feed - Coach */}
            <RemoteVideoFeed
                remoteVideoRef={remoteVideoRef}
                remoteStream={remoteStream}
                topPosition="4px"
                label="Coach"
            />

            {/* Whiteboard */}
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
                    onAnimationPop={onAnimationPop}
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
                    stopwatchFormattedTime={stopwatchFormattedTime}
                    stopwatchIsRunning={stopwatchIsRunning}
                />
            </div>
        </>
    );
};

AttendeeWhiteboardWithVideo.propTypes = {
    remoteVideoRef: PropTypes.object,
    remoteStream: PropTypes.object,
    whiteboardService: PropTypes.object,
    canvasItems: PropTypes.array,
    setCanvasItems: PropTypes.func,
    toolAccess: PropTypes.object,
    remoteSelectedItemIds: PropTypes.array,
    textMessages: PropTypes.array,
    setTextMessages: PropTypes.func,
    feedbackMessage: PropTypes.string,
    waitingMessage: PropTypes.string,
    floatingAnimations: PropTypes.array,
    onAnimationPop: PropTypes.func,
    erasePenTrigger: PropTypes.number,
    redrawCanvasTrigger: PropTypes.number,
    buckets: PropTypes.array,
    setBuckets: PropTypes.func,
    textBoxes: PropTypes.array,
    activeTextBoxId: PropTypes.string,
    setActiveTextBoxId: PropTypes.func,
    tool: PropTypes.string,
    setTool: PropTypes.func,
    color: PropTypes.string,
    setColor: PropTypes.func,
    lineWidth: PropTypes.number,
    setLineWidth: PropTypes.func,
    keyboardMode: PropTypes.string,
    keyboardText: PropTypes.string,
    setKeyboardText: PropTypes.func,
    keyboardPosition: PropTypes.object,
    setKeyboardPosition: PropTypes.func,
    stopwatchFormattedTime: PropTypes.string,
    stopwatchIsRunning: PropTypes.bool,
    Whiteboard: PropTypes.elementType.isRequired
};

/**
 * Learner Whiteboard With Video and Exercise Overlay Component
 * Learner-specific whiteboard setup with custom video overlay and exercise positioned over whiteboard
 * Unique features: Fixed video overlay, exercise overlay, custom props (canvasRefForParent, clearCanvasTrigger, bucketColor)
 */
export const LearnerWhiteboardWithVideo = ({
    remoteVideoRef,
    remoteStream,
    whiteboardCanvasRef,
    whiteboardService,
    canvasItems,
    setCanvasItems,
    toolAccess,
    remoteSelectedItemIds,
    feedbackMessage,
    waitingMessage,
    floatingAnimations,
    onAnimationPop,
    clearCanvasTrigger,
    erasePenTrigger,
    redrawCanvasTrigger,
    buckets,
    setBuckets,
    bucketColor,
    setBucketColor,
    tool,
    setTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    syncedElapsedTime,
    syncedIsRunning,
    stopwatch,
    Whiteboard
}) => {
    return (
        <>
            {/* Whiteboard component */}
            <div className="w-full h-full" style={{ position: 'relative' }}>
                <Whiteboard
                    canvasRefForParent={whiteboardCanvasRef}
                    whiteboardService={whiteboardService}
                    isTrainer={false}
                    canvasItems={canvasItems}
                    setCanvasItems={setCanvasItems}
                    isFrozen={false}
                    isPaused={false}
                    toolAccess={toolAccess}
                    remoteSelectedItemIds={remoteSelectedItemIds}
                    feedbackMessage={feedbackMessage}
                    waitingMessage={waitingMessage}
                    floatingAnimations={floatingAnimations}
                    onAnimationPop={onAnimationPop}
                    clearCanvasTrigger={clearCanvasTrigger}
                    erasePenTrigger={erasePenTrigger}
                    redrawCanvasTrigger={redrawCanvasTrigger}
                    buckets={buckets}
                    setBuckets={setBuckets}
                    bucketColor={bucketColor}
                    setBucketColor={setBucketColor}
                    tool={tool}
                    setTool={setTool}
                    color={color}
                    setColor={setColor}
                    lineWidth={lineWidth}
                    setLineWidth={setLineWidth}
                    stopwatchFormattedTime={syncedElapsedTime > 0 ? stopwatch.formatTime(syncedElapsedTime) : null}
                    stopwatchIsRunning={syncedIsRunning}
                />
            </div>
        </>
    );
};

LearnerWhiteboardWithVideo.propTypes = {
    remoteVideoRef: PropTypes.object,
    remoteStream: PropTypes.object,
    whiteboardCanvasRef: PropTypes.object,
    whiteboardService: PropTypes.object,
    canvasItems: PropTypes.array,
    setCanvasItems: PropTypes.func,
    toolAccess: PropTypes.object,
    remoteSelectedItemIds: PropTypes.array,
    feedbackMessage: PropTypes.string,
    waitingMessage: PropTypes.string,
    floatingAnimations: PropTypes.array,
    onAnimationPop: PropTypes.func,
    clearCanvasTrigger: PropTypes.number,
    erasePenTrigger: PropTypes.number,
    redrawCanvasTrigger: PropTypes.number,
    buckets: PropTypes.array,
    setBuckets: PropTypes.func,
    bucketColor: PropTypes.string,
    setBucketColor: PropTypes.func,
    tool: PropTypes.string,
    setTool: PropTypes.func,
    color: PropTypes.string,
    setColor: PropTypes.func,
    lineWidth: PropTypes.number,
    setLineWidth: PropTypes.func,
    syncedElapsedTime: PropTypes.number,
    syncedIsRunning: PropTypes.bool,
    stopwatch: PropTypes.object,
    Whiteboard: PropTypes.elementType.isRequired
};

/**
 * useAttendeeComments Hook
 * Manages all comment-related state and handlers for attendee sessions
 * Consolidates duplicate comment logic from all three session types
 */
export const useAttendeeComments = (whiteboardService, sessionType) => {
    const [commentInput, setCommentInput] = React.useState('');
    const [trainerComments, setTrainerComments] = React.useState([]);
    const [isCommentsOpen, setIsCommentsOpen] = React.useState(false);
    const commentHandlerRef = React.useRef(null);

    // Import utility functions (need to be imported where this hook is used)
    const createCommentSendHandler = (ws, type) => {
        return {
            sendComment: (message) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'comment_message',
                        role: type,
                        message: message
                    }));
                }
            },
            flushComment: (message) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'comment_message',
                        role: type,
                        message: message
                    }));
                }
            },
            cleanup: () => { }
        };
    };

    // Initialize comment handler
    React.useEffect(() => {
        if (!whiteboardService) return;
        commentHandlerRef.current = createCommentSendHandler(whiteboardService, sessionType);
        return () => {
            if (commentHandlerRef.current) {
                commentHandlerRef.current.cleanup();
            }
        };
    }, [whiteboardService, sessionType]);

    const debouncedSendComment = React.useCallback((message) => {
        if (commentHandlerRef.current) {
            commentHandlerRef.current.sendComment(message);
        }
    }, []);

    const flushSendComment = React.useCallback((message) => {
        if (commentHandlerRef.current) {
            commentHandlerRef.current.flushComment(message);
        }
    }, []);

    // Setup comment listeners
    React.useEffect(() => {
        if (!whiteboardService) return;

        whiteboardService.onCommentReceived = (data) => {
            setTrainerComments(prev => [...prev, { text: data.message, timestamp: Date.now() }]);
            setIsCommentsOpen(true);
        };

        return () => {
            if (whiteboardService) {
                whiteboardService.onCommentReceived = null;
            }
        };
    }, [whiteboardService]);

    return {
        commentInput,
        setCommentInput,
        trainerComments,
        setTrainerComments,
        isCommentsOpen,
        setIsCommentsOpen,
        debouncedSendComment,
        flushSendComment
    };
};

/**
 * Attendee Comments Panel Wrapper
 * Wraps AttendeeCommentsPanel with conditional logic
 * For learner: hides when exercise is shown
 * For guest/client: always shows based on isCommentsOpen
 */
export const AttendeeCommentsPanelWrapper = ({
    isCommentsOpen,
    setIsCommentsOpen,
    trainerComments,
    commentInput,
    setCommentInput,
    onSendComment,
    onFlushComment,
    sessionType,
    // Optional: for learner session to hide when exercise is shown
    exerciseData = null
}) => {
    // Determine visibility
    let panelIsOpen = isCommentsOpen;

    // Learner session: hide comments when exercise is shown
    if (sessionType === 'learner' && exerciseData) {
        panelIsOpen = isCommentsOpen && !exerciseData.question && !exerciseData.qaItems?.length;
    }

    return (
        <AttendeeCommentsPanel
            isOpen={panelIsOpen}
            setIsOpen={setIsCommentsOpen}
            trainerComments={trainerComments}
            commentInput={commentInput}
            setCommentInput={setCommentInput}
            onSendComment={onSendComment}
            onFlushComment={onFlushComment}
            sessionType={sessionType}
        />
    );
};

AttendeeCommentsPanelWrapper.propTypes = {
    isCommentsOpen: PropTypes.bool.isRequired,
    setIsCommentsOpen: PropTypes.func.isRequired,
    trainerComments: PropTypes.array.isRequired,
    commentInput: PropTypes.string.isRequired,
    setCommentInput: PropTypes.func.isRequired,
    onSendComment: PropTypes.func.isRequired,
    onFlushComment: PropTypes.func.isRequired,
    sessionType: PropTypes.oneOf(['guest', 'client', 'learner']).isRequired,
    exerciseData: PropTypes.object
};

/**
 * ============================================================================
 * NEW LAYOUT COMPONENTS - Left (20%): P:, R:, Bulb | Middle (60%): Prompt, Comment/Answer | Right (20%): Video
 * ============================================================================
 */

/**
 * AttendeeMetricsPanel (Left 20%)
 * Displays P:, R:, and bulb vertically in the left panel
 */
export const AttendeeMetricsPanel = ({
    promptMeter = 0,
    reinforcementMeter = 0,
    bucketColor = null,
    micEnabled = true,
    cameraEnabled = true,
    onToggleMic,
    onToggleCamera,
    onLeaveSession,
    showControls = false,
    // New: toggle prompt visibility from bulb click
    onTogglePrompt,
    isPromptOpen = false,
    // New: when true, prompt animation (instructor sent prompt) should glow bulb
    promptAnimating = false,
    // Prompt text display
    promptText = '[Prompts from instructor will appear here]',
    defaultPromptText = '[Prompts from instructor will appear here]'
}) => {
    const bulbGlowFromBucket = useBulbGlowAnimation(bucketColor);
    const isBulbGlowing = bulbGlowFromBucket || !!promptAnimating;

    return (
        <div className="attendee-metrics-panel" style={{
            width: '20%',
            minWidth: 'clamp(7.5rem, 12vw, 9.375rem)',
            maxWidth: 'clamp(9.375rem, 15vw, 12rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(0.5rem, 1.5vh, 0.75rem)',
            backgroundColor: 'white',
            borderRadius: 'clamp(0.375rem, 1vw, 0.5rem)',
            padding: 'clamp(0.75rem, 2vh, 1rem)',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
            height: '100%',
            overflow: 'visible',
            boxSizing: 'border-box',
            position: 'relative'
        }}>
            {/* Row 1: P and R side by side */}
            <div style={{
                display: 'flex',
                height: '0.1rem',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(1rem, 3vw, 1.5rem)',
                width: '100%',
                flexShrink: 0
            }}>
                {/* Prompt Level */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 'clamp(0.15rem, 0.3vw, 0.25rem)'
                }}>
                    <span style={{
                        fontWeight: 'bold',
                        fontSize: 'clamp(0.625rem, 1.8vw, 12rem)',
                        color: '#d97706',
                        whiteSpace: 'nowrap'
                    }}>P :</span>
                    <span style={{
                        fontSize: 'clamp(0.875rem, 1.8vw, 12rem)',
                        fontWeight: 'bold',
                        color: '#d97706',
                        whiteSpace: 'nowrap'
                    }}>{promptMeter}</span>
                </div>

                {/* Reinforcement Level */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 'clamp(0.15rem, 0.3vw, 0.25rem)'
                }}>
                    <span style={{
                        fontWeight: 'bold',
                        fontSize: 'clamp(0.625rem, 1.8vw, 12rem)',
                        color: '#16a34a',
                        whiteSpace: 'nowrap'
                    }}>R :</span>
                    <span style={{
                        fontSize: 'clamp(0.875rem, 1.8vw, 12rem)',
                        fontWeight: 'bold',
                        color: '#16a34a',
                        whiteSpace: 'nowrap'
                    }}>{reinforcementMeter}</span>
                </div>
            </div>

            {/* Row 2: Bulb with Dropdown Prompt */}
            <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                // gap: '0.5rem',   
                width: '100%'
            }}>
                <span
                    onClick={(e) => { if (onTogglePrompt) onTogglePrompt(); }}
                    title={isPromptOpen ? 'Hide prompt' : 'Show prompt'}
                    style={{
                        fontSize: 'clamp(1rem, 1.6vw, 18rem)',
                        filter: isBulbGlowing ? 'drop-shadow(0 0 0.75rem #fbbf24) drop-shadow(0 0 1.25rem rgba(251, 191, 36, 0.6))' : 'none',
                        animation: isBulbGlowing ? 'pulse 1.5s ease-in-out infinite' : 'none',
                        transition: 'filter 0.3s ease, transform 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: onTogglePrompt ? 'pointer' : 'default',
                        transform: isPromptOpen ? 'scale(1.08)' : 'scale(1)',
                        zIndex: 100
                    }}
                >
                    💡
                </span>

                {/* Prompt Box - Integrated into metrics panel */}
                {isPromptOpen && (
                    <div style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        borderRadius: '0.375rem',
                        padding: 'clamp(0.5rem, 1.5vh, 0.75rem)',
                        border: promptText !== defaultPromptText ? '2px solid #fbbf24' : '1px solid #d1d5db',
                        boxShadow: promptText !== defaultPromptText
                            ? '0 2px 8px rgba(251, 191, 36, 0.2)'
                            : '0 1px 3px rgba(0, 0, 0, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        minHeight: 'clamp(3.5rem, 9vh, 4.5rem)',
                        maxHeight: 'clamp(6rem, 16vh, 5rem)',
                        overflow: 'auto',
                        animation: 'slideDown 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        position: 'relative',
                        gap: '0.25rem'
                    }}>
                        {/* Small arrow pointing to bulb */}
                        <div style={{
                            position: 'absolute',
                            top: '-6px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '0',
                            height: '0',
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderBottom: promptText !== defaultPromptText ? '6px solid #fbbf24' : '6px solid #d1d5db',
                            zIndex: 1
                        }} />

                        <p style={{
                            fontSize: 'clamp(0.65rem, 1.6vw, 0.8rem)',
                            color: promptText !== defaultPromptText ? '#1f2937' : '#6b7280',
                            margin: 0,
                            textAlign: 'center',
                            fontStyle: promptText !== defaultPromptText ? 'normal' : 'italic',
                            lineHeight: '1.4',
                            fontWeight: promptText !== defaultPromptText ? '600' : '500',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            hyphens: 'manual',
                            padding: '0.25rem 0.5rem',
                            width: '100%',
                            boxSizing: 'border-box',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                        }}>
                            {promptText !== defaultPromptText ? promptText : 'Waiting...'}

                        </p>
                    </div>
                )}
            </div>

            {/* Row 3: Video control icons */}
            {showControls && onToggleMic && onToggleCamera && onLeaveSession && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'clamp(0.75rem, 2vw, 1.25rem)',
                    flexShrink: 0
                }}>
                    <span
                        onClick={onToggleMic}
                        title={micEnabled ? 'Mute' : 'Unmute'}
                        style={{
                            cursor: 'pointer',
                            color: micEnabled ? '#16a34a' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        {micEnabled
                            ? <Mic size={18} />
                            : <MicOff size={18} />
                        }
                    </span>
                    <span
                        onClick={onToggleCamera}
                        title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                        style={{
                            cursor: 'pointer',
                            color: cameraEnabled ? '#16a34a' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        {cameraEnabled
                            ? <Video size={18} />
                            : <VideoOff size={18} />
                        }
                    </span>
                    <span
                        onClick={onLeaveSession}
                        title="Leave Session"
                        style={{
                            cursor: 'pointer',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <PhoneOff size={18} />
                    </span>
                </div>
            )}
        </div>
    );
};

AttendeeMetricsPanel.propTypes = {
    promptMeter: PropTypes.number,
    reinforcementMeter: PropTypes.number,
    bucketColor: PropTypes.string,
    micEnabled: PropTypes.bool,
    cameraEnabled: PropTypes.bool,
    onToggleMic: PropTypes.func,
    onToggleCamera: PropTypes.func,
    onLeaveSession: PropTypes.func,
    showControls: PropTypes.bool,
    onTogglePrompt: PropTypes.func,
    isPromptOpen: PropTypes.bool,
    focusOnOpen: PropTypes.bool,
    promptText: PropTypes.string,
    defaultPromptText: PropTypes.string
};


/**
 * AttendeePromptPanel (Middle 60%)
 * Displays Prompt Line (always visible), Question/Comment and Answer boxes (when instructor enables them)
 */
export const AttendeePromptPanel = ({
    promptText = '[Prompts from instructor will appear here]',
    defaultPromptText = '[Prompts from instructor will appear here]',
    isCommentsOpen = false,
    commentInput = '',
    setCommentInput,
    onSendComment,
    onFlushComment,
    exerciseData = null,
    showExercise = false,
    Exercise = null,
    whiteboardService = null,
    onExerciseSubmit = null,
    onExerciseUpdate = null,
    onExerciseDelete = null,
    sessionType = 'guest',
    // New: control whether the prompt line is visible (toggled by bulb)
    isPromptOpen = false,
    // New: when true, attempt to focus first textarea/input inside the panel when it opens
    focusOnOpen = false
}) => {
    // Local fallback for exercise answer when parent doesn't provide onExerciseUpdate
    const [localExerciseAnswer, setLocalExerciseAnswer] = React.useState(exerciseData?.answer || '');

    React.useEffect(() => {
        setLocalExerciseAnswer(exerciseData?.answer || '');
    }, [exerciseData && exerciseData.answer]);

    // Focus handling: when focusOnOpen becomes true and prompt panel is visible,
    // focus the first textarea/input inside the panel or the container itself.
    const panelRef = React.useRef(null);
    React.useEffect(() => {
        if (!focusOnOpen || !isPromptOpen) return;

        // small timeout to allow render
        const t = setTimeout(() => {
            if (!panelRef.current) return;
            const textarea = panelRef.current.querySelector('textarea, input');
            if (textarea) {
                textarea.focus();
                if (typeof textarea.select === 'function') textarea.select();
            } else {
                // focus container so keyboard can be ready for accessibility
                panelRef.current.focus && panelRef.current.focus();
            }
        }, 80);

        return () => clearTimeout(t);
    }, [focusOnOpen, isPromptOpen]);

    return (
        <div ref={panelRef} tabIndex={-1} className="attendee-prompt-panel" style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(0.5rem, 1.5vh, 0.875rem)',
            backgroundColor: 'white',
            borderRadius: 'clamp(0.375rem, 1vw, 0.5rem)',
            padding: 'clamp(0.75rem, 2vh, 1.25rem)',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
            height: '100%',
            overflow: 'hidden',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
        }}>
            {/* Question/Comment Box - Shows when instructor gives access */}
            {isCommentsOpen && setCommentInput && (
                <div style={{
                    flex: showExercise ? '0 0 auto' : '1',
                    minHeight: showExercise ? 'clamp(4.5rem, 12vh, 6rem)' : 'clamp(6rem, 15vh, 8rem)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'clamp(0.375rem, 1vh, 0.5rem)',
                    width: '100%'
                }}>
                    <div style={{
                        fontSize: 'clamp(0.625rem, 1.5vw, 0.875rem)',
                        fontWeight: 'bold',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05rem',
                        marginBottom: '0.125rem'
                    }}>
                        💬 Response
                    </div>
                    <textarea
                        value={commentInput}
                        onChange={(e) => {
                            setCommentInput(e.target.value);
                            onSendComment && onSendComment(e.target.value);
                        }}
                        onBlur={(e) => {
                            onFlushComment && onFlushComment(e.target.value);
                        }}
                        placeholder="Type your response or question here..."
                        style={{
                            flex: 1,
                            minHeight: 'clamp(3.125rem, 10vh, 4.5rem)',
                            padding: 'clamp(0.375rem, 1vh, 0.75rem)',
                            fontSize: 'clamp(0.6875rem, 1.6vw, 0.875rem)',
                            border: '0.0625rem solid #d1d5db',
                            borderRadius: 'clamp(0.25rem, 0.8vw, 0.375rem)',
                            fontFamily: 'inherit',
                            fontWeight: 'bold',
                            resize: 'none',
                            backgroundColor: '#ffffff'
                        }}
                    />
                </div>
            )}

            {/* Answer Box (Exercise) - Shows when instructor gives access to all session types */}
            {showExercise && exerciseData && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'clamp(0.25rem, 0.6vh, 0.375rem)',
                    overflow: 'hidden'
                }}>
                    {/* Question Section */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'clamp(0.125rem, 0.3vh, 0.25rem)',
                        flex: '0 0 auto'
                    }}>
                        <div style={{
                            fontSize: 'clamp(0.5rem, 1.2vw, 1rem)',
                            fontWeight: 'bold',
                            color: '#374151',
                            textTransform: 'uppercase',
                            letterSpacing: '0.025rem'
                        }}>
                            QUESTION:
                        </div>
                        <div style={{
                            fontSize: 'clamp(0.625rem, 1.4vw, 1rem)',
                            fontWeight: 'bold',
                            color: '#1f2937',
                            padding: 'clamp(0.25rem, 0.6vh, 0.375rem)',
                            backgroundColor: '#f9fafb',
                            borderRadius: 'clamp(0.25rem, 0.8vw, 0.375rem)',
                            borderLeft: '0.1875rem solid #3b82f6',
                            lineHeight: '1.3',
                            maxHeight: 'clamp(2.5rem, 5vh, 3.5rem)',
                            overflow: 'auto'
                        }}>
                            {exerciseData.question || 'Given by Instructor'}
                        </div>
                    </div>

                    {/* Answer Section */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'clamp(0.125rem, 0.3vh, 0.25rem)',
                        flex: 1,
                        minHeight: 0
                    }}>
                        <div style={{
                            fontSize: 'clamp(0.5rem, 1.2vw, 1rem)',
                            fontWeight: 'bold',
                            color: '#374151',
                            textTransform: 'uppercase',
                            letterSpacing: '0.025rem'
                        }}>
                            YOUR ANSWER:
                        </div>
                        <textarea
                            value={onExerciseUpdate ? (exerciseData?.learnerAnswer ?? exerciseData?.answer ?? '') : localExerciseAnswer}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (onExerciseUpdate && exerciseData) {
                                    onExerciseUpdate({
                                        ...exerciseData,
                                        learnerAnswer: v,
                                        timestamp: Date.now()
                                    });
                                } else {
                                    setLocalExerciseAnswer(v);
                                }
                            }}
                            placeholder="Type your answer here..."
                            style={{
                                flex: 1,
                                minHeight: 'clamp(2.5rem, 6vh, 4rem)',
                                padding: 'clamp(0.25rem, 0.6vh, 0.375rem)',
                                fontSize: 'clamp(0.625rem, 1.4vw, 1rem)',
                                border: '0.0625rem solid #d1d5db',
                                borderRadius: 'clamp(0.25rem, 0.8vw, 0.375rem)',
                                fontFamily: 'inherit',
                                fontWeight: 'bold',
                                resize: 'none',
                                backgroundColor: '#ffffff',
                                outline: 'none',
                                lineHeight: '1.3'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

AttendeePromptPanel.propTypes = {
    promptText: PropTypes.string,
    defaultPromptText: PropTypes.string,
    isCommentsOpen: PropTypes.bool,
    commentInput: PropTypes.string,
    setCommentInput: PropTypes.func,
    onSendComment: PropTypes.func,
    onFlushComment: PropTypes.func,
    exerciseData: PropTypes.object,
    showExercise: PropTypes.bool,
    Exercise: PropTypes.any,
    whiteboardService: PropTypes.object,
    onExerciseSubmit: PropTypes.func,
    onExerciseUpdate: PropTypes.func,
    onExerciseDelete: PropTypes.func,
    sessionType: PropTypes.string,
    isPromptOpen: PropTypes.bool,
    focusOnOpen: PropTypes.bool
};
/**
 * AttendeeVideoPanel (Right 20%)
 * Displays WebRTC video feed
 */
export const AttendeeVideoPanel = ({
    remoteVideoRef,
    remoteStream,
    label = 'Instructor'
}) => {
    return (
        <div className="attendee-video-panel" style={{
            width: '20%',
            minWidth: 'clamp(7.5rem, 12vw, 10rem)',
            maxWidth: 'clamp(12rem, 20vw, 17.5rem)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000',
            borderRadius: 'clamp(0.375rem, 1vw, 0.5rem)',
            overflow: 'hidden',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
            position: 'relative',
            height: '100%',
            alignItems: 'stretch',
            boxSizing: 'border-box'
        }}>
            {/* Video Feed */}
            {remoteStream ? (
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        backgroundColor: '#1a1a1a',
                        display: 'block'
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1a1a1a',
                    color: '#9ca3af',
                    fontSize: 'clamp(0.75rem, 1.8vw, 0.875rem)',
                    textAlign: 'center',
                    padding: 'clamp(1rem, 3vw, 1.25rem)',
                    boxSizing: 'border-box'
                }}>
                    Waiting for video...
                </div>
            )}

            {/* Video Label */}
            <div style={{
                position: 'absolute',
                top: 'clamp(0.25rem, 1vh, 0.5rem)',
                left: 'clamp(0.25rem, 1vw, 0.5rem)',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: 'clamp(0.1875rem, 0.5vh, 0.25rem) clamp(0.375rem, 1vw, 0.5rem)',
                borderRadius: 'clamp(0.1875rem, 0.5vw, 0.25rem)',
                fontSize: 'clamp(0.5625rem, 1.4vw, 0.75rem)',
                fontWeight: '600'
            }}>
                {label}
            </div>

            {/* Video Controls Overlay - removed, controls now in AttendeeMetricsPanel */}
        </div>
    );
};

AttendeeVideoPanel.propTypes = {
    remoteVideoRef: PropTypes.object.isRequired,
    remoteStream: PropTypes.object,
    label: PropTypes.string
};

/**
 * Exercise Overlay Component
 * For Learner Sessions: Positioned at top of whiteboard with clean UI (question + answer only)
 * For Other Sessions: Centered modal with question and answer box
 */
export const ExerciseOverlay = ({
    exerciseData = null,
    showExercise = false,
    onExerciseUpdate = null,
    sessionType = 'learner'
}) => {
    const [localExerciseAnswer, setLocalExerciseAnswer] = React.useState(exerciseData?.answer || '');

    React.useEffect(() => {
        setLocalExerciseAnswer(exerciseData?.answer || '');
    }, [exerciseData && exerciseData.answer]);

    if (!showExercise || !exerciseData) return null;

    // For Learner Sessions: Exercise shown in middle panel (AttendeePromptPanel), not in whiteboard overlay
    if (sessionType === 'learner') {
        return null;
    }

    // For Other Sessions (Guest, Client): Centered modal in whiteboard
    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 50,
            width: 'clamp(280px, 65vw, 800px)',
            maxHeight: 'clamp(200px, 70vh, 600px)',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25)',
            border: '2px solid #3b82f6',
            padding: 'clamp(1rem, 2.5vh, 1.5rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(0.75rem, 1.5vh, 1rem)',
            overflow: 'auto',
            animation: 'slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
            {/* Question Section */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
            }}>
                <label style={{
                    fontSize: 'clamp(0.875rem, 1.8vw, 1rem)',
                    fontWeight: 'bold',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}>
                    ❓ Question
                </label>
                <div style={{
                    fontSize: 'clamp(0.875rem, 1.8vw, 1rem)',
                    fontWeight: '600',
                    color: '#1f2937',
                    padding: 'clamp(0.75rem, 1.5vh, 1rem)',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px',
                    borderLeft: '4px solid #3b82f6',
                    lineHeight: '1.6',
                    maxHeight: '150px',
                    overflow: 'auto'
                }}>
                    {exerciseData.question || 'Given by Instructor'}
                </div>
            </div>

            {/* Answer Section */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                flex: 1,
                minHeight: 0
            }}>
                <label style={{
                    fontSize: 'clamp(0.875rem, 1.8vw, 1rem)',
                    fontWeight: 'bold',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}>
                    ✏️ Your Answer
                </label>
                <textarea
                    value={onExerciseUpdate ? (exerciseData?.learnerAnswer ?? exerciseData?.answer ?? '') : localExerciseAnswer}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (onExerciseUpdate && exerciseData) {
                            onExerciseUpdate({
                                ...exerciseData,
                                learnerAnswer: v,
                                timestamp: Date.now()
                            });
                        } else {
                            setLocalExerciseAnswer(v);
                        }
                    }}
                    placeholder="Type your answer here..."
                    style={{
                        flex: 1,
                        minHeight: 'clamp(80px, 15vh, 150px)',
                        padding: 'clamp(0.75rem, 1.5vh, 1rem)',
                        fontSize: 'clamp(0.875rem, 1.8vw, 1rem)',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontFamily: 'inherit',
                        fontWeight: '500',
                        resize: 'none',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                        lineHeight: '1.6',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                    }}
                />
            </div>
        </div>
    );
};

ExerciseOverlay.propTypes = {
    exerciseData: PropTypes.object,
    showExercise: PropTypes.bool,
    onExerciseUpdate: PropTypes.func,
    sessionType: PropTypes.string
};

/**
 * AttendeeUpperSection (Complete Upper Layout)
 * Contains the three-panel layout: Metrics (20%) | Prompt (60%) | Video (20%)
 */
export const AttendeeUpperSection = ({
    // Metrics Panel Props
    promptMeter = 0,
    reinforcementMeter = 0,
    bucketColor = null,

    // Prompt Panel Props
    promptText = '[Prompts from instructor will appear here]',
    defaultPromptText = '[Prompts from instructor will appear here]',
    isCommentsOpen = false,
    commentInput = '',
    setCommentInput,
    onSendComment,
    onFlushComment,
    exerciseData = null,
    showExercise = false,
    Exercise = null,
    whiteboardService = null,
    onExerciseSubmit = null,
    onExerciseUpdate = null,
    onExerciseDelete = null,

    // Video Panel Props
    remoteVideoRef,
    remoteStream,
    micEnabled = true,
    cameraEnabled = true,
    onToggleMic,
    onToggleCamera,
    onLeaveSession,
    videoLabel = 'Instructor',
    showVideoControls = true,

    // General
    sessionType = 'guest'
}) => {
    const [isMobile, setIsMobile] = React.useState(false);
    const [isTablet, setIsTablet] = React.useState(false);
    // New: control whether the Prompt Line (middle panel) is visible (closed by default)
    const [isPromptOpen, setIsPromptOpen] = React.useState(false);
    // Track whether the open was triggered automatically by instructor ('auto') or manually by user ('manual')
    const [promptOpenSource, setPromptOpenSource] = React.useState(null); // 'auto' | 'manual' | null
    const autoCloseTimerRef = React.useRef(null);
    // Use prompt animation hook to detect when instructor sends a prompt
    const { isPromptLineOpen: _isPromptLineOpen, setIsPromptLineOpen: _setIsPromptLineOpen, promptLineAnimating } = usePromptAnimation(promptText, defaultPromptText);

    // Auto-open the prompt panel when instructor sends a prompt (animation starts)
    React.useEffect(() => {
        if (promptLineAnimating || _isPromptLineOpen) {
            // mark as auto-open so we can auto-close after a delay
            setPromptOpenSource('auto');
            setIsPromptOpen(true);

            // clear any existing auto-close timer
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
                autoCloseTimerRef.current = null;
            }

            // auto-close after 8 seconds unless user opens manually
            autoCloseTimerRef.current = setTimeout(() => {
                setIsPromptOpen(false);
                setPromptOpenSource(null);
                autoCloseTimerRef.current = null;
            }, 8000);
        }
    }, [promptLineAnimating, _isPromptLineOpen]);

    // If user toggles manually, cancel auto-close timer
    React.useEffect(() => {
        if (promptOpenSource === 'manual' && autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = null;
        }
    }, [promptOpenSource]);

    React.useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 768);
            setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
        };
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    return (
        <>
            <style>{`
                /* Mobile Portrait (<768px) - Stack vertically */
                @media (max-width: 767px) {
                    .attendee-upper-section {
                        flex-direction: column !important;
                        height: auto !important;
                        min-height: 35vh !important;
                        max-height: 45vh !important;
                        overflow-y: auto !important;
                        gap: clamp(0.25rem, 0.8vh, 0.375rem) !important;
                        padding: clamp(0.25rem, 0.8vh, 0.375rem) !important;
                    }
                    .attendee-metrics-panel {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 4rem !important;
                        height: auto !important;
                        flex-direction: row !important;
                        justify-content: space-around !important;
                        padding: clamp(0.375rem, 1vh, 0.5rem) !important;
                        gap: clamp(0.375rem, 1vw, 0.5rem) !important;
                    }
                    .attendee-prompt-panel {
                        width: 100% !important;
                        min-height: 8rem !important;
                        max-height: none !important;
                        flex: 1 !important;
                        padding: clamp(0.375rem, 1vh, 0.5rem) !important;
                    }
                    .attendee-video-panel {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 6rem !important;
                        max-height: 8rem !important;
                        height: auto !important;
                    }
                }

                /* Mobile Landscape (<768px landscape) */
                @media (max-width: 767px) and (orientation: landscape) {
                    .attendee-upper-section {
                        flex-direction: row !important;
                        height: 35vh !important;
                        max-height: 35vh !important;
                        min-height: auto !important;
                    }
                    .attendee-metrics-panel {
                        width: 18% !important;
                        flex-direction: column !important;
                        min-height: auto !important;
                    }
                    .attendee-prompt-panel {
                        width: 58% !important;
                        min-height: auto !important;
                    }
                    .attendee-video-panel {
                        width: 24% !important;
                        min-height: auto !important;
                        max-height: none !important;
                    }
                }

                /* Tablet Portrait (768px-1023px) */
                @media (min-width: 768px) and (max-width: 1023px) {
                    .attendee-upper-section {
                        height: clamp(9rem, 28vh, 16rem) !important;
                        gap: clamp(0.5rem, 1.2vw, 0.75rem) !important;
                    }
                    .attendee-metrics-panel {
                        width: 20% !important;
                        min-width: 7rem !important;
                        max-width: 10rem !important;
                    }
                    .attendee-prompt-panel {
                        width: 56% !important;
                        padding: clamp(0.625rem, 1.8vh, 1rem) !important;
                    }
                    .attendee-video-panel {
                        width: 24% !important;
                        min-width: 10rem !important;
                    }
                }

                /* Tablet Landscape (768px-1023px landscape) */
                @media (min-width: 768px) and (max-width: 1023px) and (orientation: landscape) {
                    .attendee-upper-section {
                        height: clamp(8rem, 35vh, 14rem) !important;
                    }
                }

                /* Desktop (≥1024px) */
                @media (min-width: 1024px) {
                    .attendee-upper-section {
                        height: clamp(10rem, 22vh, 16rem) !important;
                    }
                }

                /* Large Desktop (≥1440px) */
                @media (min-width: 1440px) {
                    .attendee-upper-section {
                        height: clamp(12rem, 24vh, 18rem) !important;
                    }
                }

                /* Ensure text stays readable on all sizes */
                @media (max-width: 767px) {
                    .attendee-metrics-panel span {
                        font-size: clamp(0.875rem, 2.5vw, 1.125rem) !important;
                    }
                    .attendee-prompt-panel textarea,
                    .attendee-prompt-panel input {
                        font-size: clamp(0.75rem, 2vw, 0.875rem) !important;
                    }
                }
            `}</style>
            <div className="attendee-upper-section" style={{
                width: '100%',
                height: 'clamp(10rem, 22vh, 16rem)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: 'clamp(0.5rem, 1.5vw, 1rem)',
                padding: 'clamp(0.5rem, 1.5vh, 0.875rem)',
                backgroundColor: '#f3f4f6',
                flexShrink: 0,
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}>
                {/* Left: Metrics Panel with P:, R:, Bulb (20%) */}
                <AttendeeMetricsPanel
                    promptMeter={promptMeter}
                    reinforcementMeter={reinforcementMeter}
                    bucketColor={bucketColor}
                    micEnabled={micEnabled}
                    cameraEnabled={cameraEnabled}
                    onToggleMic={onToggleMic}
                    onToggleCamera={onToggleCamera}
                    onLeaveSession={onLeaveSession}
                    showControls={showVideoControls}
                    // Prompt text display
                    promptText={promptText}
                    defaultPromptText={defaultPromptText}
                    // prompt toggle wiring
                    isPromptOpen={isPromptOpen}
                    onTogglePrompt={() => {
                        setPromptOpenSource('manual');
                        setIsPromptOpen(prev => !prev);
                    }}
                    // glow when bucket OR when instructor sent prompt
                    promptAnimating={promptLineAnimating}
                />

                {/* Middle: Prompt Line, Question/Comment and Answer Panel (60%) */}
                <AttendeePromptPanel
                    promptText={promptText}
                    defaultPromptText={defaultPromptText}
                    isCommentsOpen={isCommentsOpen}
                    commentInput={commentInput}
                    setCommentInput={setCommentInput}
                    onSendComment={onSendComment}
                    onFlushComment={onFlushComment}
                    exerciseData={exerciseData}
                    showExercise={showExercise}
                    Exercise={Exercise}
                    whiteboardService={whiteboardService}
                    onExerciseSubmit={onExerciseSubmit}
                    onExerciseUpdate={onExerciseUpdate}
                    onExerciseDelete={onExerciseDelete}
                    sessionType={sessionType}
                    isPromptOpen={isPromptOpen}
                    // focus the prompt panel when it was auto-opened
                    focusOnOpen={promptOpenSource === 'auto' && isPromptOpen}
                />

                {/* Right: Video Panel (20%) */}
                <AttendeeVideoPanel
                    remoteVideoRef={remoteVideoRef}
                    remoteStream={remoteStream}
                    label={videoLabel}
                />
            </div>
        </>
    );
};

AttendeeUpperSection.propTypes = {
    promptMeter: PropTypes.number,
    reinforcementMeter: PropTypes.number,
    bucketColor: PropTypes.string,
    promptText: PropTypes.string,
    defaultPromptText: PropTypes.string,
    isCommentsOpen: PropTypes.bool,
    commentInput: PropTypes.string,
    setCommentInput: PropTypes.func,
    onSendComment: PropTypes.func,
    onFlushComment: PropTypes.func,
    exerciseData: PropTypes.object,
    showExercise: PropTypes.bool,
    Exercise: PropTypes.any,
    whiteboardService: PropTypes.object,
    onExerciseSubmit: PropTypes.func,
    onExerciseUpdate: PropTypes.func,
    onExerciseDelete: PropTypes.func,
    remoteVideoRef: PropTypes.object.isRequired,
    remoteStream: PropTypes.object,
    micEnabled: PropTypes.bool,
    cameraEnabled: PropTypes.bool,
    onToggleMic: PropTypes.func,
    onToggleCamera: PropTypes.func,
    onLeaveSession: PropTypes.func,
    videoLabel: PropTypes.string,
    showVideoControls: PropTypes.bool,
    sessionType: PropTypes.string
};
