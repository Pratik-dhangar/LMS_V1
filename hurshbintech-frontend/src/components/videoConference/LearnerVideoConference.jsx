/**
 * Video Conference Component for Learner
 * Displays remote (trainer) video stream only
 * Learner doesn't see their own video to minimize distraction
 */

import React, { useEffect, useRef, useState } from 'react';
import '../../styles/videoConference.css';

const LearnerVideoConference = ({
    remoteStream,
    connectionStatus,
    sessionInfo
}) => {
    const remoteVideoRef = useRef(null);
    const [remoteVideoReady, setRemoteVideoReady] = useState(false);

    // Set up remote video stream (trainer's video)
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            console.log('[LearnerVideo] Setting up trainer stream');
            remoteVideoRef.current.srcObject = remoteStream;

            // Ensure video plays
            remoteVideoRef.current.play().catch(error => {
                console.error('[LearnerVideo] Remote video play error:', error);
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
                    <span>Video Call with Trainer</span>
                </div>
                <div className={`network-status ${getConnectionClass()}`}>
                    <div className="network-status-dot"></div>
                    <span>{connectionStatus || 'Connecting...'}</span>
                </div>
            </div>

            {/* Video Body */}
            <div className="video-conference-body">
                {/* Video Grid - Single Video (Trainer Only) */}
                <div className="video-grid">
                    {/* Remote Video (Trainer) */}
                    <div className="video-item">
                        <div className="video-label">
                            <span className="video-label-text">Trainer</span>
                            <span className={`video-status ${remoteVideoReady ? 'video-status-connected' : 'video-status-waiting'}`}>
                                {remoteVideoReady ? '● Live' : '○ Connecting...'}
                            </span>
                        </div>

                        {!remoteStream && (
                            <div className="video-placeholder">
                                <div className="video-placeholder-icon">⏳</div>
                                <div className="video-placeholder-text">Connecting to trainer...</div>
                                <div className="video-placeholder-subtext">Please wait while we establish connection</div>
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
                                console.log('[LearnerVideo] Trainer video metadata loaded');
                            }}
                            onPlay={() => {
                                console.log('[LearnerVideo] Trainer video playing');
                            }}
                            onError={(e) => {
                                console.error('[LearnerVideo] Trainer video error:', e);
                            }}
                        />

                        {remoteVideoReady && (
                            <div className={`video-connection-badge ${getConnectionClass()}`}>
                                <span>● Live</span>
                            </div>
                        )}

                        {/* Show audio level indicator when trainer is speaking */}
                        {remoteVideoReady && (
                            <div className="audio-level-indicator">
                                <div className="audio-level-bar"></div>
                                <div className="audio-level-bar"></div>
                                <div className="audio-level-bar"></div>
                                <div className="audio-level-bar"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LearnerVideoConference;
