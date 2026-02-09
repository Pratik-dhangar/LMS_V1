// InstructorSessionLayout.jsx
// ============================================================================
// 🔹 Purpose: Shared layout components for Instructor Session Pages
// 🔸 Pages: TrainerSession (optional), CoachSession (optional)
// 🔹 Role: Common UI controls, toolbars, and session management for instructors
// 
// 📦 EXPORTS:
// - InstructorSessionHeader: Session management header with timer
// - InstructorVideoControls: Mic, camera, and freeze controls
// - ToolAccessPanel: Grant/revoke participant tool permissions
// - BackgroundMusicControls: Music player with volume control
// - SessionNotesEditor: Auto-save text area for notes
// - FeedbackMessageControls: Send feedback to participant
// - VoiceInputControls: Speech-to-text controls
// - FloatingAnimationButtons: Send reactions (bubbles, smileys, etc.)
// - QuickActionButtons: Clear canvas, erase pen, freeze screen
// - SidebarToggles: Mobile/tablet hamburger menus
// - instructorSessionStyles: CSS-in-JS for instructor layout
// 
// 💡 NOTE:
// These components are ready to use but optional. TrainerSession and CoachSession
// currently have their own UI implementations that work well.
// 
// 🎯 USAGE (when ready):
// import { 
//   InstructorSessionHeader,
//   InstructorVideoControls,
//   ToolAccessPanel
// } from '../../components/session/InstructorSessionLayout';
// ============================================================================

import React from 'react';
import PropTypes from 'prop-types';
import { FaMicrophone, FaBars, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import VideoConferenceService from '../../api/services/videoConferenceService';
import WhiteboardService from '../../api/services/whiteboardService';
import WhiteboardToolsService from '../../api/services/WhiteboardToolsService';
import Emoji from '../common/Emoji';

/**
 * Session Header for Instructor
 * Displays session title, participant info, timer, and controls
 */
export const InstructorSessionHeader = ({
    title = 'Session',
    participantName,
    connectionStatus,
    timeLeft,
    onEndSession,
    showEndButton = true,
    navbarClassName = '',
    additionalInfo
}) => {
    return (
        <div className={`session-header ${navbarClassName}`}>
            <div className="session-header-main">
                <div>
                    <div className="session-header-title">{title}</div>
                    {participantName && (
                        <div className="session-header-subtitle">
                            With: <strong>{participantName}</strong>
                        </div>
                    )}
                </div>

                <div className="session-header-controls">
                    {additionalInfo}
                    <div className="session-header-info">
                        Status: <strong>{connectionStatus}</strong>
                    </div>
                    {timeLeft && (
                        <div className="session-header-info">
                            Time Left: <strong>{timeLeft}</strong>
                        </div>
                    )}
                    {showEndButton && (
                        <button className="btn-session btn-session-end" onClick={onEndSession}>
                            🏁 End Session
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

InstructorSessionHeader.propTypes = {
    title: PropTypes.string,
    participantName: PropTypes.string,
    connectionStatus: PropTypes.string,
    timeLeft: PropTypes.string,
    onEndSession: PropTypes.func,
    showEndButton: PropTypes.bool,
    navbarClassName: PropTypes.string,
    additionalInfo: PropTypes.node
};

/**
 * Video Controls for Instructor
 * Microphone, Camera, Freeze Screen controls
 */
export const InstructorVideoControls = ({
    micEnabled,
    cameraEnabled,
    isFrozen,
    onToggleMic,
    onToggleCamera,
    onToggleFreeze,
    showFreezeButton = true
}) => {
    return (
        <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            marginBottom: '12px'
        }}>
            <button
                onClick={onToggleMic}
                className={`${micEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    gap: '8px',
                    border: 'none',
                    cursor: 'pointer'
                }}
                title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
                <span style={{ fontSize: '18px' }}>{micEnabled ? '🎤' : '🔇'}</span>
                <span>{micEnabled ? 'Mic On' : 'Mic Off'}</span>
            </button>

            <button
                onClick={onToggleCamera}
                className={`${cameraEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    gap: '8px',
                    border: 'none',
                    cursor: 'pointer'
                }}
                title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
            >
                <span style={{ fontSize: '18px' }}>{cameraEnabled ? '📹' : '📷'}</span>
                <span>{cameraEnabled ? 'Video On' : 'Video Off'}</span>
            </button>

            {showFreezeButton && (
                <button
                    onClick={onToggleFreeze}
                    className={`${isFrozen ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-600 hover:bg-gray-700'} text-white rounded-lg flex items-center transition-all duration-200 shadow-md`}
                    style={{
                        padding: '10px 16px',
                        fontSize: '14px',
                        gap: '8px',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                    title={isFrozen ? 'Unfreeze Participant Screen' : 'Freeze Participant Screen'}
                >
                    <span style={{ fontSize: '18px' }}>{isFrozen ? '🔓' : '🔒'}</span>
                    <span>{isFrozen ? 'Unfreeze' : 'Freeze'}</span>
                </button>
            )}
        </div>
    );
};

InstructorVideoControls.propTypes = {
    micEnabled: PropTypes.bool.isRequired,
    cameraEnabled: PropTypes.bool.isRequired,
    isFrozen: PropTypes.bool.isRequired,
    onToggleMic: PropTypes.func.isRequired,
    onToggleCamera: PropTypes.func.isRequired,
    onToggleFreeze: PropTypes.func.isRequired,
    showFreezeButton: PropTypes.bool
};

/**
 * Sidebar Toggle Buttons (Mobile/Tablet)
 * Hamburger menu and close buttons for left/right sidebars
 */
export const SidebarToggles = ({
    isLeftSidebarOpen,
    isRightSidebarOpen,
    onToggleLeft,
    onToggleRight
}) => {
    return (
        <>
            {/* Left Sidebar Toggle */}
            <button
                onClick={onToggleLeft}
                className="md:hidden fixed top-16 left-2 z-50 bg-[#DB9D32] text-white p-3 rounded-lg shadow-lg hover:bg-[#c48c28] transition-all"
                style={{ fontSize: '20px' }}
            >
                {isLeftSidebarOpen ? <FaTimes /> : <FaBars />}
            </button>

            {/* Right Sidebar Toggle */}
            <button
                onClick={onToggleRight}
                className="md:hidden fixed top-16 right-2 z-50 bg-[#DB9D32] text-white p-3 rounded-lg shadow-lg hover:bg-[#c48c28] transition-all"
                style={{ fontSize: '20px' }}
            >
                {isRightSidebarOpen ? <FaTimes /> : <FaBars />}
            </button>
        </>
    );
};

SidebarToggles.propTypes = {
    isLeftSidebarOpen: PropTypes.bool.isRequired,
    isRightSidebarOpen: PropTypes.bool.isRequired,
    onToggleLeft: PropTypes.func.isRequired,
    onToggleRight: PropTypes.func.isRequired
};

/**
 * Tool Access Control Panel
 * Grant/revoke participant access to whiteboard tools
 */
export const ToolAccessPanel = ({
    participantToolAccess,
    onToggleToolAccess,
    participantLabel = 'Participant'
}) => {
    const tools = [
        { key: 'select', label: 'Select', icon: '🔍' },
        { key: 'drag', label: 'Drag', icon: '👆' },
        { key: 'keyboard', label: 'Keyboard', icon: '⌨️' }
    ];

    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 text-gray-800">
                🛠️ {participantLabel} Tool Access
            </h3>
            <div className="space-y-2">
                {tools.map(tool => (
                    <div key={tool.key} className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-gray-700">
                            <span>{tool.icon}</span>
                            <span>{tool.label}</span>
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={participantToolAccess[tool.key] || false}
                                onChange={() => onToggleToolAccess(tool.key, !participantToolAccess[tool.key])}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#DB9D32]/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#DB9D32]"></div>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
};

ToolAccessPanel.propTypes = {
    participantToolAccess: PropTypes.object.isRequired,
    onToggleToolAccess: PropTypes.func.isRequired,
    participantLabel: PropTypes.string
};

/**
 * Background Music Controls
 * Play/stop music, select track, adjust volume
 */
export const BackgroundMusicControls = ({
    musicOptions,
    selectedMusic,
    backgroundMusicPlaying,
    musicVolume,
    onMusicSelect,
    onPlayMusic,
    onStopMusic,
    onVolumeChange
}) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 text-gray-800">🎵 Background Music</h3>

            <div className="space-y-3">
                {/* Music Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Track:
                    </label>
                    <select
                        value={selectedMusic ?? ''}
                        onChange={(e) => onMusicSelect(e.target.value === '' ? null : parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DB9D32]"
                    >
                        <option value="">-- Choose Music --</option>
                        {musicOptions.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Play/Stop Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={onPlayMusic}
                        disabled={selectedMusic === null || backgroundMusicPlaying}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${selectedMusic === null || backgroundMusicPlaying
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                    >
                        ▶️ Play
                    </button>
                    <button
                        onClick={onStopMusic}
                        disabled={!backgroundMusicPlaying}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${!backgroundMusicPlaying
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                    >
                        ⏹️ Stop
                    </button>
                </div>

                {/* Volume Control */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Volume: {Math.round(musicVolume * 100)}%
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={musicVolume * 100}
                        onChange={(e) => onVolumeChange(parseInt(e.target.value) / 100)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#DB9D32]"
                    />
                </div>
            </div>
        </div>
    );
};

BackgroundMusicControls.propTypes = {
    musicOptions: PropTypes.array.isRequired,
    selectedMusic: PropTypes.number,
    backgroundMusicPlaying: PropTypes.bool.isRequired,
    musicVolume: PropTypes.number.isRequired,
    onMusicSelect: PropTypes.func.isRequired,
    onPlayMusic: PropTypes.func.isRequired,
    onStopMusic: PropTypes.func.isRequired,
    onVolumeChange: PropTypes.func.isRequired
};

/**
 * Session Notes Editor
 * Auto-save text area for session documentation
 */
export const SessionNotesEditor = ({
    sessionNotes,
    onNotesChange,
    placeholder = 'Enter session notes here...',
    disabled = false
}) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 text-gray-800">📝 Session Notes</h3>
            <textarea
                value={sessionNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#DB9D32] transition-all"
                style={{
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    opacity: disabled ? 0.6 : 1
                }}
            />
            <p className="text-xs text-gray-500 mt-2">
                💾 Auto-saves every 2 seconds
            </p>
        </div>
    );
};

SessionNotesEditor.propTypes = {
    sessionNotes: PropTypes.string.isRequired,
    onNotesChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    disabled: PropTypes.bool
};

/**
 * Feedback Message Controls
 * Send feedback messages to participant's whiteboard
 */
export const FeedbackMessageControls = ({
    feedbackMessage,
    onFeedbackChange,
    onSendFeedback,
    onClearFeedback
}) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 text-gray-800">💬 Feedback Message</h3>

            <textarea
                value={feedbackMessage}
                onChange={(e) => onFeedbackChange(e.target.value)}
                placeholder="Type feedback message..."
                className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#DB9D32] transition-all mb-3"
                style={{ fontSize: '14px' }}
            />

            <div className="flex gap-2">
                <button
                    onClick={onSendFeedback}
                    disabled={!feedbackMessage.trim()}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${!feedbackMessage.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#DB9D32] hover:bg-[#c48c28] text-white'
                        }`}
                >
                    📤 Send
                </button>
                <button
                    onClick={onClearFeedback}
                    className="flex-1 px-4 py-2 rounded-lg font-medium bg-gray-500 hover:bg-gray-600 text-white transition-all"
                >
                    🗑️ Clear
                </button>
            </div>
        </div>
    );
};

FeedbackMessageControls.propTypes = {
    feedbackMessage: PropTypes.string.isRequired,
    onFeedbackChange: PropTypes.func.isRequired,
    onSendFeedback: PropTypes.func.isRequired,
    onClearFeedback: PropTypes.func.isRequired
};

/**
 * Voice Input Controls
 * Speech-to-text controls for instructor
 */
export const VoiceInputControls = ({
    listening,
    transcript,
    onToggleListening,
    disabled = false
}) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 text-gray-800">🎤 Voice Input</h3>

            <button
                onClick={onToggleListening}
                disabled={disabled}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-all mb-3 ${listening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-[#DB9D32] hover:bg-[#c48c28] text-white'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <FaMicrophone className="inline-block mr-2" />
                {listening ? '🔴 Stop Listening' : '🎙️ Start Voice Input'}
            </button>

            {transcript && (
                <div className="p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-700">{transcript}</p>
                </div>
            )}
        </div>
    );
};

VoiceInputControls.propTypes = {
    listening: PropTypes.bool.isRequired,
    transcript: PropTypes.string,
    onToggleListening: PropTypes.func.isRequired,
    disabled: PropTypes.bool
};

/**
 * Floating Animation Buttons
 * Send reactions to participant (bubbles, smileys, balloons, stars)
 */
export const FloatingAnimationButtons = ({
    onSendAnimation,
    activeAnimations = new Set()
}) => {
    const animations = [
        { type: 'bubble', label: 'Bubbles', icon: '🫧' },
        { type: 'smiley', label: 'Smileys', icon: '😊' },
        { type: 'balloon', label: 'Balloons', icon: '🎈' },
        { type: 'star', label: 'Stars', icon: '⭐' }
    ];

    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 text-gray-800">🎉 Reactions</h3>

            <div className="grid grid-cols-2 gap-2">
                {animations.map(anim => (
                    <button
                        key={anim.type}
                        onClick={() => onSendAnimation(anim.type)}
                        disabled={activeAnimations.has(anim.type)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${activeAnimations.has(anim.type)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#DB9D32] hover:bg-[#c48c28] text-white'
                            }`}
                    >
                        <span className="text-2xl mr-2">{anim.icon}</span>
                        <span className="text-sm">{anim.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

FloatingAnimationButtons.propTypes = {
    onSendAnimation: PropTypes.func.isRequired,
    activeAnimations: PropTypes.instanceOf(Set)
};

/**
 * Quick Action Buttons
 * Clear canvas, erase pen strokes, freeze screen
 */
export const QuickActionButtons = ({
    onClearCanvas,
    onErasePen,
    onFreezeScreen,
    isFrozen = false
}) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="font-bold text-lg mb-3 text-gray-800">⚡ Quick Actions</h3>

            <div className="space-y-2">
                <button
                    onClick={onClearCanvas}
                    className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
                >
                    🗑️ Clear Canvas
                </button>

                <button
                    onClick={onErasePen}
                    className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all"
                >
                    ✏️ Erase Pen Strokes
                </button>

                <button
                    onClick={onFreezeScreen}
                    className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${isFrozen
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                        }`}
                >
                    {isFrozen ? '🔓 Unfreeze Screen' : '🔒 Freeze Screen'}
                </button>
            </div>
        </div>
    );
};

QuickActionButtons.propTypes = {
    onClearCanvas: PropTypes.func.isRequired,
    onErasePen: PropTypes.func.isRequired,
    onFreezeScreen: PropTypes.func.isRequired,
    isFrozen: PropTypes.bool
};

/**
 * Full-Screen Session Styles (CSS-in-JS)
 */
export const instructorSessionStyles = `
  .instructor-session-page {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .instructor-main-content {
    display: flex;
    flex: 1;
    width: 100%;
    overflow: hidden;
  }

  .instructor-sidebar {
    background-color: #f9fafb;
    border-right: 1px solid #e5e7eb;
    overflow-y: auto;
    padding: 16px;
  }

  .instructor-sidebar-left {
    width: 320px;
  }

  .instructor-sidebar-right {
    width: 320px;
    border-right: none;
    border-left: 1px solid #e5e7eb;
  }

  .instructor-whiteboard-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .instructor-sidebar {
      position: fixed;
      top: 60px;
      bottom: 0;
      z-index: 40;
      width: 280px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .instructor-sidebar-left {
      left: -280px;
      transition: left 0.3s ease-in-out;
    }

    .instructor-sidebar-left.open {
      left: 0;
    }

    .instructor-sidebar-right {
      right: -280px;
      transition: right 0.3s ease-in-out;
    }

    .instructor-sidebar-right.open {
      right: 0;
    }
  }
`;

// =============================
// SESSION UTILS - MOVED FROM sessionUtils.jsx
// =============================
// All utilities previously in sessionUtils.jsx are now consolidated here
// for use by Instructor session pages (Trainer/Coach)

// =============================
// CONSTANTS & CONFIGURATIONS
// =============================

/**
 * WebSocket base URL for services
 */
export const getWSBaseURL = () => {
    return import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
};

/**
 * Common reaction SVG assets used in both Trainer and Coach sessions
 */
export const REACTION_SVG_ASSETS = {
    smiley: {
        type: 'svg',
        src: '/reactions/realistic-pastel-smile.svg',
        alt: 'Realistic Pastel Smile'
    },
    bubble: {
        type: 'svg',
        src: '/reactions/realistic-bubble.svg',
        alt: 'Realistic Soap Bubble'
    },
    balloon: [
        {
            type: 'svg',
            src: '/reactions/02_pastel_mint.svg',
            alt: 'Realistic Pink Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/03_pastel_pink.svg',
            alt: 'Realistic Red Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/04_pastel_lavender.svg',
            alt: 'Realistic Blue Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/05_pastel_peach.svg',
            alt: 'Realistic Green Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/06_pastel_coral.svg',
            alt: 'Realistic Yellow Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/07_pastel_teal.svg',
            alt: 'Realistic Purple Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/08_pastel_yellow.svg',
            alt: 'Realistic Orange Balloon'
        }
    ],
    star: {
        type: 'svg',
        src: '/reactions/realistic-oil-pastel-star.svg',
        alt: 'Realistic Oil Pastel Star'
    }
};

/**
 * Unified whiteboard button styles
 */
export const WB_BUTTON_STYLES = {
    base: 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center',
    active: 'bg-white border-2 border-[#DB9D32] text-black shadow-lg rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center',
    smallBase: 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1',
    smallActive: 'bg-white border-2 border-[#DB9D32] text-black shadow-lg rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1'
};

/**
 * Default bucket colors for whiteboard
 */
export const BUCKET_COLORS = [
    { name: 'Brown', hex: '#8B6F47' },
    { name: 'Red', hex: '#ec221a' },
    { name: 'Blue', hex: '#5B7B9F' },
    { name: 'Yellow', hex: '#F4D394' },
    { name: 'Pink', hex: '#E8A8C7' },
    { name: 'Orange', hex: '#E8944C' }
];

// =============================
// SESSION INITIALIZATION
// =============================

/**
 * Validate user session and retrieve user data from localStorage
 */
export const validateUserSession = ({ requiredRole, navigate, loginPath = '/login' }) => {
    const userData = localStorage.getItem('user_data');

    if (!userData) {
        console.error('[InstructorSession] No user data found in localStorage');
        toast.error('Please login first');
        navigate(loginPath);
        return null;
    }

    const user = JSON.parse(userData);

    if (requiredRole && user.role !== requiredRole) {
        toast.error(`Unauthorized access - ${requiredRole}s only`);
        navigate('/');
        return null;
    }

    return user;
};

// =============================
// WEBRTC & WHITEBOARD SETUP
// =============================

/**
 * Initialize whiteboard service with common callbacks
 */
export const initializeWhiteboardService = ({
    wsBaseUrl,
    sessionId,
    role,
    setBuckets,
    setFloatingAnimations,
    setErasePenTrigger,
    setRedrawCanvasTrigger
}) => {
    try {
        console.log(`[InstructorSession] Initializing whiteboard service for ${role}`);
        const wbService = new WhiteboardService(wsBaseUrl, sessionId, role);
        wbService.initialize();

        if (setBuckets) {
            wbService.onBucketAdded = (data) => {
                console.log(`[InstructorSession] Bucket added:`, data);
                setBuckets(prev => {
                    const exists = prev.find(bucket => bucket.id === data.id);
                    if (!exists) {
                        return [...prev, data];
                    }
                    return prev;
                });
            };

            wbService.onBucketUpdate = (data) => {
                console.log(`[InstructorSession] Bucket updated:`, data);
                if (data.removed) {
                    setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
                } else {
                    setBuckets(prev => prev.map(bucket =>
                        bucket.id === data.id ? { ...bucket, ...data } : bucket
                    ));
                }
            };
        }

        if (setFloatingAnimations) {
            wbService.onFloatingAnimations = (data) => {
                console.log(`[InstructorSession] Floating animations received:`, data);
                setFloatingAnimations(prev => [...prev, ...data.animations]);

                setTimeout(() => {
                    setFloatingAnimations(prev =>
                        prev.filter(a => !data.animations.find(na => na.id === a.id))
                    );
                }, 13000);
            };
        }

        if (setErasePenTrigger && setRedrawCanvasTrigger) {
            wbService.onErasePen = () => {
                console.log(`[InstructorSession] Received erase pen event`);
                setErasePenTrigger(prev => prev + 1);
                setRedrawCanvasTrigger(prev => prev + 1);
            };
        }

        console.log(`[InstructorSession] Whiteboard service initialized for ${role}`);
        return wbService;
    } catch (error) {
        console.error(`[InstructorSession] Error initializing whiteboard:`, error);
        toast.error('Failed to initialize whiteboard');
        return null;
    }
};

/**
 * Initialize video conference service with common callbacks
 */
export const initializeVideoConferenceService = async ({
    wsBaseUrl,
    sessionId,
    role,
    setLocalStream,
    setRemoteStream,
    setConnectionStatus,
    connectedRef,
    sessionInfo,
    participantName = 'Participant'
}) => {
    try {
        console.log(`[InstructorSession] Initializing video conference service for ${role}`);
        const videoService = new VideoConferenceService(wsBaseUrl, sessionId, role);

        videoService.onLocalStream = (stream) => {
            console.log(`[InstructorSession] Local stream received`);
            setLocalStream(stream);
            setConnectionStatus('Waiting for participant...');
        };

        videoService.onRemoteStream = (stream) => {
            console.log(`[InstructorSession] Remote stream received from ${participantName}`);
            setRemoteStream(stream);
            setConnectionStatus('Connected');

            if (connectedRef && !connectedRef.current) {
                connectedRef.current = true;
                const name = sessionInfo?.learner_name || sessionInfo?.client_name || participantName;
                toast.success(`${name} has joined the session`);
            }
        };

        videoService.onConnectionStateChange = (state) => {
            console.log(`[InstructorSession] Connection state changed to:`, state);
            const statusMap = {
                'new': 'connecting',
                'connecting': 'connecting',
                'connected': 'connected',
                'disconnected': 'disconnected',
                'failed': 'failed',
                'closed': 'disconnected'
            };
            setConnectionStatus(statusMap[state] || state);

            if ((state === 'disconnected' || state === 'closed') && connectedRef?.current) {
                console.log(`[InstructorSession] ${participantName} disconnected`);
                const name = sessionInfo?.learner_name || sessionInfo?.client_name || participantName;
                toast.info(`${name} has left the session`);
                setRemoteStream(null);
                connectedRef.current = false;
            }
        };

        videoService.onError = (error) => {
            console.error(`[InstructorSession] Video conference error:`, error);
            toast.error(`Video error: ${error.message}`);
        };

        await videoService.initialize();
        console.log(`[InstructorSession] Video conference service initialized for ${role}`);

        return videoService;
    } catch (error) {
        console.error(`[InstructorSession] Video Conference init error:`, error);
        toast.error('Failed to initialize video conference: ' + error.message);
        return null;
    }
};

/**
 * Initialize whiteboard tools service
 */
export const initializeToolsService = (whiteboardService) => {
    try {
        console.log('[InstructorSession] Initializing tools service');
        const toolsService = new WhiteboardToolsService(whiteboardService);
        console.log('[InstructorSession] Tools service initialized');
        return toolsService;
    } catch (error) {
        console.error('[InstructorSession] Error initializing tools service:', error);
        return null;
    }
};

// =============================
// MEDIA CONTROLS
// =============================

/**
 * Toggle microphone on/off
 */
export const toggleMicrophone = (videoService, setMicEnabled, additionalServices = []) => {
    if (!videoService) {
        toast.error('Video service not initialized');
        return false;
    }

    const newState = videoService.toggleMicrophone();
    setMicEnabled(newState);

    additionalServices.forEach(service => {
        if (service && service.peerConnection) {
            const audioSenders = service.peerConnection.getSenders().filter(s => s.track?.kind === 'audio');
            audioSenders.forEach(sender => {
                if (sender.track) {
                    sender.track.enabled = false;
                }
            });
        }
    });

    return newState;
};

/**
 * Toggle camera on/off
 */
export const toggleCamera = (videoService, setCameraEnabled) => {
    if (!videoService) {
        toast.error('Video service not initialized');
        return false;
    }

    const newState = videoService.toggleCamera();
    setCameraEnabled(newState);
    return newState;
};

/**
 * Toggle freeze mode for participant window
 */
export const toggleFreeze = (currentFreezeState, setIsFrozen, videoService, participantRole = 'participant') => {
    const newFreezeState = !currentFreezeState;
    setIsFrozen(newFreezeState);

    if (videoService) {
        const freezeSignal = {
            type: 'freeze',
            frozen: newFreezeState,
            timestamp: new Date().toISOString()
        };

        if (typeof videoService.sendSignal === 'function') {
            videoService.sendSignal(freezeSignal);
        } else if (typeof videoService.sendMessage === 'function') {
            videoService.sendMessage(freezeSignal);
        }

        console.log(`[InstructorSession] Freeze signal sent for ${participantRole}:`, freezeSignal);
        toast.info(newFreezeState ? `${participantRole} window frozen` : `${participantRole} window unfrozen`);
    } else {
        console.error(`[InstructorSession] Cannot send freeze signal - Video service not initialized`);
        toast.error('Unable to send freeze signal');
        setIsFrozen(!newFreezeState);
    }

    return newFreezeState;
};

// =============================
// CANVAS & DRAWING OPERATIONS
// =============================

/**
 * Clear all canvas items
 */
export const clearAllCanvas = ({
    setCanvasItems,
    setBuckets,
    setTextBoxes,
    setFloatingAnimations,
    setErasePenTrigger,
    setClearCanvasTrigger,
    setEraseAllActive,
    whiteboardService
}) => {
    setCanvasItems([]);
    setBuckets([]);
    if (setTextBoxes) setTextBoxes([]);
    setFloatingAnimations([]);

    setErasePenTrigger(prev => prev + 1);
    setClearCanvasTrigger(prev => prev + 1);
    setEraseAllActive(true);

    if (whiteboardService) {
        whiteboardService.send('clear_canvas', {
            timestamp: Date.now()
        });
    }

    setTimeout(() => setEraseAllActive(false), 300);
    console.log('[InstructorSession] Canvas cleared');
};

/**
 * Add a new bucket to the canvas
 */
export const addBucket = (existingBuckets, setBuckets, whiteboardService, bucketColor = '#8B6F47', canvasWidth = 1200, canvasHeight = 600, canvasRef = null) => {
    const BUCKET_WIDTH = 150;
    const BUCKET_HEIGHT = 150;
    const PADDING = 20;
    const START_X = 20;
    const START_Y = 20;
    const SAFE_MARGIN = 30;

    let newX = START_X;
    let newY = START_Y;

    const maxX = canvasWidth - BUCKET_WIDTH - SAFE_MARGIN;
    const maxY = canvasHeight - BUCKET_HEIGHT - SAFE_MARGIN;

    if (existingBuckets.length > 0) {
        const lastBucket = existingBuckets[existingBuckets.length - 1];
        const potentialX = lastBucket.x + BUCKET_WIDTH + PADDING;

        if (potentialX + BUCKET_WIDTH + SAFE_MARGIN > canvasWidth) {
            newX = START_X;
            newY = lastBucket.y + BUCKET_HEIGHT + PADDING;

            if (newY + BUCKET_HEIGHT + SAFE_MARGIN > canvasHeight) {
                let foundSpace = false;
                for (let row = 0; row < 10 && !foundSpace; row++) {
                    const testY = START_Y + (row * (BUCKET_HEIGHT + PADDING));
                    if (testY + BUCKET_HEIGHT + SAFE_MARGIN <= canvasHeight) {
                        let testX = START_X;

                        for (const bucket of existingBuckets) {
                            if (Math.abs(bucket.y - testY) < BUCKET_HEIGHT / 2) {
                                const nextPos = bucket.x + BUCKET_WIDTH + PADDING;
                                if (nextPos > testX) {
                                    testX = nextPos;
                                }
                            }
                        }

                        if (testX + BUCKET_WIDTH + SAFE_MARGIN <= canvasWidth) {
                            newX = testX;
                            newY = testY;
                            foundSpace = true;
                        }
                    }
                }

                if (!foundSpace) {
                    newX = START_X;
                    newY = Math.max(START_Y, maxY - BUCKET_HEIGHT - PADDING);
                }
            }
        } else {
            newX = potentialX;
            newY = lastBucket.y;
        }
    }

    newX = Math.max(START_X, Math.min(newX, maxX));
    newY = Math.max(START_Y, Math.min(newY, maxY));

    const newBucket = {
        id: Date.now(),
        x: newX,
        y: newY,
        width: BUCKET_WIDTH,
        height: BUCKET_HEIGHT,
        label: 'Bucket',
        color: bucketColor,
        items: []
    };

    setBuckets(prev => [...prev, newBucket]);

    if (whiteboardService) {
        whiteboardService.sendBucketAdded(newBucket);
    }

    return newBucket;
};

// =============================
// FLOATING ANIMATIONS
// =============================

/**
 * Generate evenly spaced positions for floating animations
 */
export const generateSpacedPositions = (count, minPercent = 5, maxPercent = 95) => {
    const positions = [];
    const step = (maxPercent - minPercent) / (count - 1 || 1);
    for (let i = 0; i < count; i++) {
        positions.push(minPercent + i * step);
    }
    return positions;
};

/**
 * Spawn floating animation
 */
export const spawnFloatingAnimation = ({
    type,
    asset,
    activeFloatingAnimationTypesRef,
    setFloatingAnimations,
    whiteboardService,
    count = 10
}) => {
    if (activeFloatingAnimationTypesRef.has(type)) {
        toast.warn(`${type.charAt(0).toUpperCase() + type.slice(1)}s are already active!`);
        return [];
    }

    activeFloatingAnimationTypesRef.add(type);

    const leftPositions = generateSpacedPositions(count);

    const newAnimations = leftPositions.map((leftPercent, index) => {
        const selectedAsset = Array.isArray(asset)
            ? asset[Math.floor(Math.random() * asset.length)]
            : asset;

        return {
            id: `${type}-${Date.now()}-${index}`,
            type: type,
            x: leftPercent,
            startDelay: index * 200,
            duration: 8000 + Math.random() * 5000,
            asset: {
                type: selectedAsset.type,
                src: selectedAsset.src,
                alt: selectedAsset.alt
            },
            popped: false
        };
    });

    setFloatingAnimations(prev => [...prev, ...newAnimations]);

    if (whiteboardService) {
        whiteboardService.sendFloatingAnimations(newAnimations);
    }

    setTimeout(() => {
        setFloatingAnimations(prev =>
            prev.filter(a => !newAnimations.find(na => na.id === a.id))
        );
        activeFloatingAnimationTypesRef.delete(type);
    }, 13000);

    console.log(`[InstructorSession] Spawned ${count} ${type} animations`);
    return newAnimations;
};

// =============================
// TOOL ACCESS CONTROL
// =============================

/**
 * Toggle tool access for participant
 */
export const toggleToolAccess = (toolName, currentAccess, setToolAccess, whiteboardService, setTool) => {
    const updated = { ...currentAccess, [toolName]: !currentAccess[toolName] };

    if (toolName === 'drag' && updated.drag) {
        updated.select = true;
    }

    setToolAccess(updated);

    if (whiteboardService) {
        whiteboardService.send('tool_access', {
            toolName,
            enabled: updated[toolName],
            allPermissions: updated
        });

        if (toolName === 'drag' && updated.drag) {
            whiteboardService.send('tool_access', {
                toolName: 'select',
                enabled: true,
                allPermissions: updated
            });
        }
    }

    console.log('[InstructorSession] Tool access updated:', updated);

    if (toolName === 'drag' && updated.drag && setTool) {
        setTool('select');
    }

    return updated;
};

// =============================
// SESSION CLEANUP
// =============================

/**
 * Cleanup session resources
 */
export const cleanupSessionResources = ({
    videoService,
    whiteboardService,
    toolsService,
    recordingService,
    secondaryVideoService,
    isInitializingRef
}) => {
    console.log('[InstructorSession] Cleaning up session resources');

    if (videoService?.localStream) {
        videoService.localStream.getTracks().forEach(track => {
            track.stop();
            console.log('[InstructorSession] Stopped track:', track.kind);
        });
    }

    if (videoService) {
        videoService.close();
        console.log('[InstructorSession] Video service closed');
    }

    if (secondaryVideoService) {
        secondaryVideoService.close();
        console.log('[InstructorSession] Secondary video service closed');
    }

    if (whiteboardService) {
        whiteboardService.close();
        console.log('[InstructorSession] Whiteboard service closed');
    }

    if (toolsService) {
        toolsService.cleanup();
        console.log('[InstructorSession] Tools service cleaned up');
    }

    if (recordingService) {
        if (typeof recordingService.cleanup === 'function') {
            recordingService.cleanup();
        } else if (typeof recordingService.stopRecording === 'function') {
            recordingService.stopRecording();
        }
        console.log('[InstructorSession] Recording service cleaned up');
    }

    if (isInitializingRef) {
        isInitializingRef.current = false;
    }

    console.log('[InstructorSession] Session cleanup complete');
};

// =============================
// STOPWATCH SYNC
// =============================

/**
 * Send stopwatch sync to participant via whiteboard service (throttled)
 */
export const syncStopwatchToParticipant = ({
    whiteboardService,
    elapsedTime,
    isRunning,
    lastSyncTimeRef,
    throttleMs = 100
}) => {
    if (!whiteboardService || elapsedTime < 0) return false;

    if (!whiteboardService.ws || whiteboardService.ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    const now = Date.now();
    if (now - lastSyncTimeRef.current >= throttleMs) {
        lastSyncTimeRef.current = now;

        whiteboardService.send('stopwatch_sync', {
            elapsedTime,
            isRunning
        });

        return true;
    }

    return false;
};

// =============================
// SESSION ENDING
// =============================

/**
 * End session and notify participants
 */
export const endSession = async ({
    whiteboardService,
    sessionServiceEndFn,
    sessionId,
    notes = '',
    cleanupFn,
    navigate,
    dashboardPath,
    roleName = 'trainer'
}) => {
    if (!window.confirm('Are you sure you want to end this session?')) {
        return false;
    }

    try {
        if (whiteboardService) {
            whiteboardService.send('session_ended', {
                message: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} has ended the session`,
                timestamp: Date.now()
            });
        }

        await sessionServiceEndFn(sessionId, notes);

        toast.success('Session ended successfully');

        if (cleanupFn) {
            cleanupFn();
        }

        navigate(dashboardPath);

        return true;
    } catch (error) {
        console.error('[InstructorSession] Error ending session:', error);
        toast.error('Failed to end session');
        return false;
    }
};

// =============================
// COUNTDOWN TIMER
// =============================

/**
 * Calculate time remaining for session
 */
export const calculateTimeRemaining = (sessionInfo) => {
    if (!sessionInfo || !sessionInfo.started_at || !sessionInfo.duration) {
        return '--:--';
    }

    let startTime;
    if (typeof sessionInfo.started_at === 'string') {
        startTime = new Date(sessionInfo.started_at.replace(' ', 'T')).getTime();
    } else {
        startTime = new Date(sessionInfo.started_at).getTime();
    }

    if (isNaN(startTime)) {
        console.error('[InstructorSession] Invalid start time:', sessionInfo.started_at);
        return '--:--';
    }

    const durationMs = sessionInfo.duration * 60 * 1000;
    const endTime = startTime + durationMs;
    const now = Date.now();
    const remaining = endTime - now;

    if (remaining <= 0) {
        return '00:00';
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// =============================
// KEYBOARD TRIGGER
// =============================

/**
 * Trigger keyboard tool for participant
 */
export const triggerParticipantKeyboard = (whiteboardService, participantRole = 'participant') => {
    if (whiteboardService) {
        if (typeof whiteboardService.sendTriggerKeyboard === 'function') {
            whiteboardService.sendTriggerKeyboard();
        } else {
            whiteboardService.send('trigger_keyboard', {
                timestamp: Date.now()
            });
        }
        toast.info(`Keyboard tool sent to ${participantRole}`);
    }
};

// =============================
// AUDIO CONTEXT & SOUND EFFECTS
// =============================

let audioContextInstance = null;

/**
 * Get or create AudioContext instance
 */
export const getAudioContext = () => {
    if (!audioContextInstance) {
        audioContextInstance = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextInstance;
};

/**
 * Play pop sound effect based on animation type
 */
export const playPopSound = (animationType) => {
    try {
        const audioContext = getAudioContext();
        const now = audioContext.currentTime;

        switch (animationType) {
            case 'bubble': {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(700, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.08);
                break;
            }

            case 'smiley': {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }

            case 'balloon': {
                const bufferSize = audioContext.sampleRate * 0.05;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);

                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noiseSource = audioContext.createBufferSource();
                noiseSource.buffer = buffer;
                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(0.4, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                noiseSource.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noiseSource.start(now);

                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.04);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.04);
                break;
            }

            case 'star': {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.12);
                break;
            }

            default: {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.frequency.setValueAtTime(500, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.1);
            }
        }
    } catch (error) {
        console.error('[InstructorSession] Error playing pop sound:', error);
    }
};

/**
 * Handle animation pop event
 */
export const handleAnimationPop = ({
    animationId,
    poppedLeft,
    poppedTop,
    floatingAnimations,
    setFloatingAnimations,
    whiteboardService
}) => {
    const animation = floatingAnimations.find(a => a.id === animationId);
    if (animation) {
        playPopSound(animation.type);
    }

    setFloatingAnimations(prev =>
        prev.map(a => a.id === animationId ? { ...a, popped: true, poppedLeft, poppedTop } : a)
    );

    if (whiteboardService) {
        whiteboardService.send('animation_popped', {
            animationId,
            poppedLeft,
            poppedTop,
            timestamp: Date.now()
        });
    }

    console.log('[InstructorSession] Animation popped:', animationId);
};

// =============================
// PEN/ERASER TOOLS
// =============================

/**
 * Erase all pen strokes from whiteboard
 */
export const eraseAllPen = ({
    setErasePenTrigger,
    setRedrawCanvasTrigger,
    whiteboardService
}) => {
    setErasePenTrigger(prev => prev + 1);
    setRedrawCanvasTrigger(prev => prev + 1);

    if (whiteboardService) {
        whiteboardService.send('erase_pen', {
            timestamp: Date.now()
        });
    }

    console.log('[InstructorSession] Pen strokes erased');
};

// =============================
// FEEDBACK MESSAGES & TOOLS
// =============================

/**
 * Send feedback message to participant
 */
export const sendFeedbackMessage = ({
    message,
    setFeedbackMessage,
    whiteboardService,
    duration = 3000
}) => {
    setFeedbackMessage(message);

    if (whiteboardService) {
        whiteboardService.send('feedback_message', {
            text: message,
            timestamp: Date.now()
        });
    }

    setTimeout(() => {
        setFeedbackMessage('');
        if (whiteboardService) {
            whiteboardService.send('feedback_message', {
                text: '',
                timestamp: Date.now()
            });
        }
    }, duration);

    console.log('[InstructorSession] Feedback message sent:', message);
};

/**
 * Send waiting message to participant
 */
export const sendWaitingMessage = ({
    message,
    setWaitingMessage,
    whiteboardService,
    duration = 5000
}) => {
    setWaitingMessage(message);

    if (whiteboardService) {
        whiteboardService.send('waiting_message', {
            text: message,
            timestamp: Date.now()
        });
    }

    setTimeout(() => {
        setWaitingMessage('');
        if (whiteboardService) {
            whiteboardService.send('waiting_message', {
                text: '',
                timestamp: Date.now()
            });
        }
    }, duration);

    console.log('[InstructorSession] Waiting message sent:', message);
};

/**
 * Handle all session tool clicks
 */
export const handleToolClick = ({
    tool,
    setFeedbackMessage,
    setWaitingMessage,
    setShowExercise,
    spawnFloatingAnimation,
    toggleLearnerToolAccess,
    whiteboardService,
    REACTION_SVG_ASSETS
}) => {
    console.log('[InstructorSession] Tool clicked:', tool);

    switch (tool) {
        case '👍 Good Job!':
            sendFeedbackMessage({
                message: 'Good Job!',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '🌟 Wow!':
            sendFeedbackMessage({
                message: 'Wow!',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '💪 Doing Well':
            sendFeedbackMessage({
                message: 'Doing Well',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '🙏 Thank You':
            sendFeedbackMessage({
                message: 'Thank You',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '❤️ Loved it':
            sendFeedbackMessage({
                message: 'Loved it',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '😌 Relax':
            sendFeedbackMessage({
                message: 'Relax',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '⏳ Wait':
            sendWaitingMessage({
                message: 'Please Wait...',
                setWaitingMessage,
                whiteboardService,
                duration: 5000
            });
            break;

        case '🫧 Bubbles':
            spawnFloatingAnimation('bubble', REACTION_SVG_ASSETS.bubble);
            break;

        case '😊 Smileys':
            spawnFloatingAnimation('smiley', REACTION_SVG_ASSETS.smiley);
            break;

        case '🎈 Balloons':
            spawnFloatingAnimation('balloon', REACTION_SVG_ASSETS.balloon);
            break;

        case '⭐ Stars':
            spawnFloatingAnimation('star', REACTION_SVG_ASSETS.star);
            break;

        default:
            console.log('[InstructorSession] Unknown tool:', tool);
    }
};

// =============================
// WHITEBOARD TOOLS COMPONENT
// =============================

/**
 * WhiteboardTools - Reusable whiteboard tools UI component
 * Used by both TrainerSession and CoachSession
 */
export const WhiteboardTools = ({
    tool,
    setTool,
    toolActive,
    setToolActive,
    eraserActive,
    setEraserActive,
    setEraseAllActive,
    eraseAllPen,
    addBucket,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    bucketColor,
    setBucketColor,
    setCanvasItems,
    setBuckets,
    setFloatingAnimations,
    setClearCanvasTrigger,
    whiteboardService,
    toolAccess,
    toggleToolAccess,
    showStopwatch,
    setShowStopwatch,
    showExercise,
    setShowExercise,
    activeIcons,
    handleToolClick,
    wbBtnBase,
    wbBtnActive,
    wbSmallBtnBase,
    wbSmallBtnActive,
    participantType = 'learner',
    musicOptions = null,
    toggleBackgroundMusic = null,
    selectedMusic = null,
    backgroundMusicPlaying = false,
    musicVolume = 0.5,
    handleMusicVolumeChange = null,
    showSessionNotes = false,
    sessionNotes = '',
    handleNotesChange = null,
    handleClearNotes = null
}) => {
    return (
        <div className="session-whiteboard-tools w-full flex flex-wrap items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
            {/* Drawing tool buttons */}
            <div className="flex" style={{ gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}>
                <button
                    onClick={() => {
                        if (tool === 'pen' && toolActive && !eraserActive) {
                            setToolActive(false);
                        } else {
                            setTool('pen');
                            setToolActive(true);
                            setEraserActive(false);
                            setEraseAllActive(false);
                        }
                    }}
                    className={`${tool === 'pen' && toolActive && !eraserActive ? wbBtnActive : wbBtnBase}`}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Pen Tool (Click to activate/deactivate)"
                >
                    <span>✏️</span>
                    <span className="hidden xs:inline">Pen</span>
                </button>
                <button
                    onClick={() => {
                        if (eraserActive) {
                            setEraserActive(false);
                            setToolActive(false);
                        } else {
                            setTool('eraser');
                            setToolActive(true);
                            setEraserActive(true);
                            setEraseAllActive(false);
                        }
                    }}
                    className={`${eraserActive ? wbBtnActive : wbBtnBase}`}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Eraser Tool (Click to activate/deactivate)"
                >
                    <span>🧽</span>
                    <span className="hidden xs:inline">Eraser</span>
                </button>
                <button
                    onClick={() => {
                        eraseAllPen();
                    }}
                    className={wbBtnBase}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Erase All Pen Strokes"
                >
                    <Emoji emoji="🗑️" size="base" />
                    <span className="hidden sm:inline">Erase All</span>
                </button>
                <button
                    onClick={() => {
                        setCanvasItems([]);
                        setBuckets([]);
                        setFloatingAnimations([]);
                        setClearCanvasTrigger(prev => prev + 1);
                        if (whiteboardService) {
                            whiteboardService.send('clear_canvas', {
                                timestamp: Date.now()
                            });
                        }
                    }}
                    className={wbBtnBase}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Clear All Canvas Items and Pen Strokes"
                >
                    <Emoji emoji="🗑️" size="base" />
                    <span className="hidden sm:inline">Clear All</span>
                </button>
                <button
                    onClick={() => {
                        addBucket();
                    }}
                    className={wbBtnBase}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Add Bucket"
                >
                    <Emoji emoji="🪣" size="base" />
                    <span className="hidden xs:inline">Bucket</span>
                </button>
            </div>

            {/* Color and Size Controls */}
            <div className="flex items-center flex-wrap" style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)' }}>
                <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
                    <label className="font-semibold text-slate-700 hidden sm:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Pen Color:</label>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        disabled={tool === 'eraser'}
                        className="rounded cursor-pointer border border-gray-300"
                        style={{ width: 'clamp(1.25rem, 3vw, 1.75rem)', height: 'clamp(1.25rem, 3vw, 1.75rem)' }}
                        title="Pen Color"
                    />
                    <div className="flex items-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                        <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
                            <label className="font-semibold text-slate-700 hidden md:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Pen Size:</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={lineWidth}
                                onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                className="brush-size-slider"
                                title="Pen Size"
                                aria-label="Pen size slider"
                                style={{
                                    width: 'clamp(5rem, 12vw, 10rem)',
                                    ['--pct']: `${Math.round(((lineWidth - 1) / (10 - 1)) * 100)}%`
                                }}
                            />
                        </div>
                        <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
                            <div
                                className="brush-preview"
                                title="Brush preview"
                                style={{
                                    width: `${Math.max(6, lineWidth * 3)}px`,
                                    height: `${Math.max(6, lineWidth * 3)}px`,
                                    background: tool === 'eraser' ? 'transparent' : color,
                                    border: tool === 'eraser' ? '2px solid red' : '1px solid rgba(0,0,0,0.6)',
                                    borderRadius: tool === 'eraser' ? '4px' : '9999px'
                                }}
                            />
                            <div className="text-slate-600" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>{lineWidth}</div>
                        </div>
                    </div>
                </div>

                {/* Bucket Color Selector */}
                <div className="flex items-center flex-wrap" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
                    <label className="font-semibold text-slate-700 hidden sm:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Bucket Color:</label>
                    <div className="flex flex-wrap gap-1" style={{ gap: 'clamp(0.125rem, 0.3vw, 0.25rem)' }}>
                        {BUCKET_COLORS.map((bc) => (
                            <button
                                key={bc.hex}
                                onClick={() => setBucketColor(bc.hex)}
                                className="rounded border-2 transition-all"
                                style={{
                                    backgroundColor: bc.hex,
                                    width: 'clamp(1.25rem, 3vw, 1.75rem)',
                                    height: 'clamp(1.25rem, 3vw, 1.75rem)',
                                    borderColor: bucketColor === bc.hex ? '#000000' : '#ccc',
                                    borderWidth: bucketColor === bc.hex ? '3px' : '2px',
                                    cursor: 'pointer'
                                }}
                                title={`Bucket Color: ${bc.name}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* All tools group - participant access + interactive buttons */}
            <div className="all-tools-group w-full">
                <div className="session-tools-section w-full flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 pb-2 sm:pb-3">
                    {/* Select Tool Toggle */}
                    <button
                        onClick={() => toggleToolAccess('select')}
                        className={`${toolAccess.select ? wbSmallBtnActive : wbSmallBtnBase}`}
                        title={toolAccess.select ? 'Click to disable Select' : 'Click to enable Select'}
                    >
                        <span>✋</span>
                        <span>Select</span>
                    </button>

                    {/* Drag Tool Toggle */}
                    <button
                        onClick={() => toggleToolAccess('drag')}
                        className={`${toolAccess.drag ? wbSmallBtnActive : wbSmallBtnBase}`}
                        title={toolAccess.drag ? 'Click to disable Drag' : 'Click to enable Drag'}
                    >
                        <span>↔️</span>
                        <span>Drag</span>
                    </button>

                    {/* Exercise Tool Button */}
                    <button
                        onClick={() => setShowExercise(!showExercise)}
                        className={`${showExercise ? wbSmallBtnActive : wbSmallBtnBase}`}
                        title="Open Exercise Tool - Create Q&A exercises with keyword validation"
                    >
                        <span>💡</span>
                        <span>Q & A</span>
                    </button>

                    {/* Background Music Control - Only for Trainer */}
                    {musicOptions && toggleBackgroundMusic && (
                        <div className="flex gap-1 flex-wrap items-center">
                            {musicOptions.map((music) => (
                                <button
                                    key={music.id}
                                    onClick={() => toggleBackgroundMusic(music.id)}
                                    className={`${selectedMusic === music.id && backgroundMusicPlaying
                                        ? wbSmallBtnActive
                                        : wbSmallBtnBase
                                        }`}
                                    title={`${selectedMusic === music.id && backgroundMusicPlaying
                                        ? `Playing ${music.name} - Click to stop`
                                        : `Click to play ${music.name}`
                                        }`}
                                >
                                    <span>{music.name}</span>
                                </button>
                            ))}

                            {/* Volume Slider */}
                            {backgroundMusicPlaying && handleMusicVolumeChange && (
                                <div className="flex items-center gap-2 px-2 py-1 bg-white border-2 border-gray-300 rounded-lg">
                                    <span className="text-xs font-semibold text-gray-700">🔊</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={musicVolume * 100}
                                        onChange={(e) => handleMusicVolumeChange(e.target.value / 100)}
                                        className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        title={`Volume: ${Math.round(musicVolume * 100)}%`}
                                    />
                                    <span className="text-xs font-semibold text-gray-700">{Math.round(musicVolume * 100)}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stopwatch Tool Button */}
                    <button
                        onClick={() => setShowStopwatch(prev => !prev)}
                        className={`${showStopwatch ? wbSmallBtnActive : wbSmallBtnBase}`}
                        aria-expanded={showStopwatch}
                        aria-controls="stopwatch-panel"
                        title="Toggle stopwatch panel"
                    >
                        <Emoji emoji="⏲️" size="base" />
                        <span className="hidden sm:inline">Stopwatch</span>
                    </button>

                    {[
                        { label: 'Good Job!', icon: '👍' },
                        { label: 'Wow!', icon: '🌟' },
                        { label: 'Doing Well', icon: '💪' },
                        { label: 'Thank You', icon: '🙏' },
                        { label: 'Loved it', icon: '❤️' },
                        { label: 'Relax', icon: '😌' },
                        { label: 'Bubbles', icon: '🫧' },
                        { label: 'Smileys', icon: '😊' },
                        { label: 'Balloons', icon: '🎈' },
                        { label: 'Stars', icon: '⭐' },
                        { label: 'Wait', icon: '⏳' }
                    ].map((t, i) => (
                        <button
                            key={i}
                            onClick={() => handleToolClick(`${t.icon} ${t.label}`)}
                            className={`${activeIcons[t.label] ? wbBtnActive : wbBtnBase} px-1.5 sm:px-2 py-1.5 sm:py-2 rounded text-[9px] sm:text-[10px] text-center session-hover-transition transition-all duration-200 font-semibold flex items-center gap-0.5 sm:gap-1`}
                            title={t.label}
                        >
                            <Emoji emoji={t.icon} size="base" className="inline-block" />
                            <span className="hidden sm:inline">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Session Notes - Only for Trainer */}
            {showSessionNotes && handleNotesChange && handleClearNotes && (
                <div className="session-notes-section border-2 border-gray-300 my-2 sm:my-4 rounded bg-gray-50 w-full" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-semibold text-slate-800" style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1rem)' }}>📝 Session Notes</div>
                        <button
                            onClick={handleClearNotes}
                            className="session-interactive-buttons bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition-colors"
                            style={{ padding: 'clamp(0.25rem, 0.8vw, 0.375rem) clamp(0.5rem, 1.2vw, 0.75rem)', fontSize: 'clamp(0.5rem, 1.2vw, 0.625rem)' }}
                            title="Clear all notes"
                        >
                            <span className="hidden sm:inline">Clear</span>
                        </button>
                    </div>
                    <textarea
                        className="w-full rounded mt-1 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#DB9D32]"
                        style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', minHeight: 'clamp(60px, 15vw, 80px)' }}
                        value={sessionNotes}
                        onChange={(e) => handleNotesChange(e.target.value)}
                        placeholder="Write session notes here..."
                    />
                </div>
            )}
        </div>
    );
};
