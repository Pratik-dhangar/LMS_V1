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
