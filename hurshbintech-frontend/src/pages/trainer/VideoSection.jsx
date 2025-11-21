import React from 'react';

const VideoSection = ({
  remoteStream,
  remoteVideoRef,
  micEnabled,
  cameraEnabled,
  handleToggleMic,
  handleToggleCamera,
  sessionInfo,
  connectionStatus
}) => {
  return (
    <div className="bg-slate-800 p-4 rounded mb-4 text-white">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold">📹 Video Conferencing</div>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleToggleMic}
            className={`${micEnabled ? 'media-control-on' : 'media-control-off'} text-white border-none px-4 py-2 rounded cursor-pointer text-xs font-medium transition-colors`}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micEnabled ? '🎤 Mic On' : '🎤 Mic Off'}
          </button>
          <button
            onClick={handleToggleCamera}
            className={`${cameraEnabled ? 'media-control-on' : 'media-control-off'} text-white border-none px-4 py-2 rounded cursor-pointer text-xs font-medium transition-colors`}
            title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {cameraEnabled ? '📹 Camera On' : '📹 Camera Off'}
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-400">
        Connected with: {sessionInfo?.learner_name ?? '—'} | Session Time: {sessionInfo?.started_at ? new Date(sessionInfo.started_at).toLocaleTimeString() : '--:--'}
      </div>
      <div className="flex justify-center items-start gap-5 w-full p-3">
        {/* Remote video - learner's */}
        <div className="flex-1 max-w-full flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-700 font-medium">Learner's Video</span>
            <span className={`text-xs ${remoteStream ? 'text-green-500' : 'text-red-500'}`}>
              {remoteStream ? '● Connected' : '○ Waiting...'}
            </span>
          </div>
          <div className="relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="session-video"
              style={{ display: remoteStream ? 'block' : 'none' }}
            />
            {!remoteStream && (
              <div className="relative inset-0 flex items-center justify-center bg-slate-800 text-white text-base font-medium h-[200px] rounded-lg">
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
