/**
 * Video Conference Component for Trainer
 * Displays both local (trainer) and remote (learner) video streams
 * Provides controls for camera and microphone
 */

import React, { useEffect, useRef, useState } from 'react';
import '../../styles/videoConference.css';

const TrainerVideoConference = ({
    localStream,
    remoteStream,
    micEnabled,
    cameraEnabled,
    onToggleMic,
    onToggleCamera,
    connectionStatus,
    sessionInfo
}) => {
    const remoteVideoRef = useRef(null);
    const [remoteVideoReady, setRemoteVideoReady] = useState(false);

    // Set up remote video stream
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            console.log('[TrainerVideo] Setting up remote stream');
            remoteVideoRef.current.srcObject = remoteStream;

            // Ensure video plays
            remoteVideoRef.current.play().catch(error => {
                console.error('[TrainerVideo] Remote video play error:', error);
            });

            setRemoteVideoReady(true);
        }
    }, [remoteStream]);

    // Get connection status class
    const getConnectionClass = () => {
        if (connectionStatus === 'connected') return 'connected';
        if (connectionStatus === 'connecting') return 'connecting';
        return 'disconnected';
    };

    return (
        <div className="video-conference-container">
            {/* Header */}
            <div className="video-conference-header">
                <div className="video-conference-header-title">
                    <span className="video-conference-header-icon">📹</span>
                    <span>Video Conference</span>
                </div>
                <div className={`network-status ${getConnectionClass()}`}>
                    <div className="network-status-dot"></div>
                    <span>{connectionStatus || 'Connecting...'}</span>
                </div>
            </div>

            {/* Video Body */}
            <div className="video-conference-body">
                {/* Video Grid - Single Video (Learner Only) */}
                <div className="video-grid">
                    {/* Remote Video (Learner) */}
                    <div className="video-item">
                        <div className="video-label">
                            <span className="video-label-text">Learner</span>
                            <span className={`video-status ${remoteVideoReady ? 'video-status-connected' : 'video-status-waiting'}`}>
                                {remoteVideoReady ? '● Live' : '○ Waiting...'}
                            </span>
                        </div>

                        {!remoteStream && (
                            <div className="video-placeholder">
                                <div className="video-placeholder-icon">⏳</div>
                                <div className="video-placeholder-text">Waiting for learner to connect...</div>
                                <div className="video-placeholder-subtext">Learner will appear here once connected</div>
                            </div>
                        )}

                        {!remoteStream && (
                            <div className="video-loading">
                                <div className="video-loading-spinner"></div>
                            </div>
                        )}

                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="video-player"
                            style={{ opacity: remoteVideoReady ? 1 : 0 }}
                            onLoadedMetadata={() => {
                                console.log('[TrainerVideo] Remote video metadata loaded');
                            }}
                            onPlay={() => {
                                console.log('[TrainerVideo] Remote video playing');
                            }}
                            onError={(e) => {
                                console.error('[TrainerVideo] Remote video error:', e);
                            }}
                        />

                        {remoteVideoReady && (
                            <div className={`video-connection-badge ${getConnectionClass()}`}>
                                <span>● Live</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Video Controls */}
                <div className="video-controls">
                    {/* Microphone Toggle */}
                    <button
                        onClick={onToggleMic}
                        className={`media-control-btn ${micEnabled ? 'mic-on' : 'mic-off'}`}
                        aria-label={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                    >
                        {micEnabled ? '🎤' : '🎤'}
                        <span className="control-tooltip">
                            {micEnabled ? 'Mute' : 'Unmute'}
                        </span>
                    </button>

                    {/* Camera Toggle */}
                    <button
                        onClick={onToggleCamera}
                        className={`media-control-btn ${cameraEnabled ? 'camera-on' : 'camera-off'}`}
                        aria-label={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                        {cameraEnabled ? '📹' : '📹'}
                        <span className="control-tooltip">
                            {cameraEnabled ? 'Camera Off' : 'Camera On'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrainerVideoConference;
