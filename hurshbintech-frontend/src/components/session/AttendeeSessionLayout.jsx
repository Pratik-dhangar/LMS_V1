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
 */
export const AttendeeWaitingScreen = ({
    sessionInfo,
    attendeeName,
    onBackClick,
    backButtonText = 'Back to Home',
    pageClassName = '',
    navbarClassName = ''
}) => {
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
                <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md mx-4">
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
    navbarClassName: PropTypes.string
};

/**
 * Attendee Video Controls (Bottom Center)
 * Microphone, Camera, and Leave Session buttons
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
                onClick={onToggleMic}
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
                onClick={onToggleCamera}
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
                onClick={onLeaveSession}
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
export const RemoteVideoFeed = ({ remoteVideoRef, remoteStream, topPosition = '55px', label = 'Instructor' }) => {
    if (!remoteStream) return null;

    return (
        <div style={{
            position: 'fixed',
            top: topPosition,
            right: '2px',
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
        }}>
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
    padding: 0 0 100px 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

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

  .session-sidebar-toggles {
    display: none !important;
  }

  @media (max-width: 768px) {
    .learner-session-page {
      height: 100vh !important;
    }
  }

  @media (min-width: 769px) {
    .learner-session-page {
      height: 100vh !important;
      min-height: 100vh !important;
    }
  }
`;
