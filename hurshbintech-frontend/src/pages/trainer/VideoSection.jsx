import React, { useEffect } from 'react';


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
  // Debug video element when stream changes
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('[VideoSection] Remote stream updated:', {
        streamActive: remoteStream.active,
        tracks: remoteStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        })),
        videoElement: {
          srcObject: !!remoteVideoRef.current.srcObject,
          readyState: remoteVideoRef.current.readyState,
          paused: remoteVideoRef.current.paused,
          width: remoteVideoRef.current.offsetWidth,
          height: remoteVideoRef.current.offsetHeight,
          videoWidth: remoteVideoRef.current.videoWidth,
          videoHeight: remoteVideoRef.current.videoHeight
        }
      });
    }
  }, [remoteStream, remoteVideoRef]);

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
            {!remoteStream && (
              <div className="video-placeholder">
                Waiting for learner to join...
              </div>
            )}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="video-player"
              style={{
                opacity: remoteStream ? 1 : 0,
                transition: 'opacity 0.3s ease'
              }}
              onLoadedMetadata={() => {
                console.log('[VideoSection] Video metadata loaded');
              }}
              onPlay={() => {
                console.log('[VideoSection] Video started playing');
              }}
              onError={(e) => {
                console.error('[VideoSection] Video error:', e);
              }}
            />
            {remoteStream && (
              <div style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                zIndex: 10
              }}>
                Stream Active
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSection;
