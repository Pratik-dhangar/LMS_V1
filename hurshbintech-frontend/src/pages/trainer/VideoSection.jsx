import React from 'react';
import '../../styles/Pages.css';

const VideoSection = ({
  remoteStream,
  remoteVideoRef,
  micEnabled,
  cameraEnabled,
  handleToggleMic,
  handleToggleCamera,
  sessionInfo
  // connectionStatus
}) => {
  return (
    <div className="video-section">
      <div className="video-header">
        <div className="video-title">📹 Video Conferencing</div>
        <div className="video-controls">
          <button
            onClick={handleToggleMic}
            className={`media-control ${micEnabled ? 'media-control-on' : 'media-control-off'}`}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micEnabled ? '🎤' : '🎤 '}
          </button>
          <button
            onClick={handleToggleCamera}
            className={`media-control ${cameraEnabled ? 'media-control-on' : 'media-control-off'}`}
            title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {cameraEnabled ? '📹' : '📹'}
          </button>
        </div>
      </div>
      <div className="video-session-info">
        Connected with: {sessionInfo?.learner_name ?? '—'} | Session Time: {sessionInfo?.started_at ? new Date(sessionInfo.started_at).toLocaleTimeString() : '--:--'}
      </div>
      <div className="video-container">
        {/* Remote video - learner's */}
        <div className="video-remote">
          <div className="video-label">
            <span className="video-label-text">Learner's Video</span>
            <span className={`video-status ${remoteStream ? 'video-status-connected' : 'video-status-waiting'}`}>
              {remoteStream ? '● Connected' : '○ Waiting...'}
            </span>
          </div>
          <div className="video-player-wrapper">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="video-player"
              style={{ display: remoteStream ? 'block' : 'none' }}
            />
            {!remoteStream && (
              <div className="video-placeholder">
                Waiting for learner to join...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSection;
