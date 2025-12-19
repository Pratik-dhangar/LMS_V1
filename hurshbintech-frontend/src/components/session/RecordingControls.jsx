import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import sessionService from '../../api/services/sessionService';

/**
 * RecordingControls Component
 * Provides UI for starting/stopping session recordings
 */
const RecordingControls = ({ recordingService, sessionStatus, sessionId }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Sync state with service every 500ms (more responsive)
  useEffect(() => {
    if (!recordingService) return;

    const interval = setInterval(() => {
      const status = recordingService.getRecordingStatus();
      setIsRecording(status.isRecording);
      setDuration(status.duration);
    }, 500);

    return () => clearInterval(interval);
  }, [recordingService]);

  // Handle recording state changes from service
  useEffect(() => {
    if (!recordingService) return;

    recordingService.onRecordingStateChange = (state) => {
      console.log('[RecordingControls] Recording state changed:', state);
      const newState = state === 'recording';
      setIsRecording(newState);
      if (!newState) {
        setDuration(0);
      }
      setError(null);
    };

    recordingService.onRecordingError = (error) => {
      console.error('[RecordingControls] Recording error:', error);
      setError(error.message);
      setIsRecording(false);
      toast.error(`Recording error: ${error.message}`);
    };

    return () => {
      recordingService.onRecordingStateChange = null;
      recordingService.onRecordingError = null;
    };
  }, [recordingService]);

  const handleStartRecording = async () => {
    if (!recordingService) {
      toast.error('Recording service not initialized');
      return;
    }

    if (sessionStatus !== 'connected') {
      toast.warning('Cannot record - session is not connected');
      return;
    }

    try {
      console.log('[RecordingControls] Starting recording...');
      const success = await recordingService.startRecording();
      if (success) {
        setIsRecording(true);
        setDuration(0);
        toast.success('Recording started');
      } else {
        toast.error('Failed to start recording');
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      toast.error('Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    if (!recordingService) {
      toast.error('Recording service not initialized');
      return;
    }

    try {
      console.log('[RecordingControls] Stopping recording...');
      const success = await recordingService.stopRecording();
      if (success) {
        setIsRecording(false);
        toast.success('Recording stopped — waiting for processing...');
        // Start polling backend for processed recording URL
        pollForPlaybackUrl();
      } else {
        toast.error('Failed to stop recording');
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
      toast.error('Failed to stop recording');
    }
  };

  // Poll backend for processed recording (playback url available)
  const pollForPlaybackUrl = async (attempt = 0) => {
    const maxAttempts = 20; // ~1 minute if interval=3000ms
    const intervalMs = 3000;

    if (!sessionId || typeof sessionId !== 'number') {
      console.error('[RecordingControls] sessionId is missing or invalid (must be numeric database ID):', sessionId);
      toast.error('Cannot fetch recording - invalid session ID');
      return;
    }

    try {
      console.log(`[RecordingControls] Polling for recording URL (attempt ${attempt + 1}/${maxAttempts}) for numeric sessionId:`, sessionId);
      const res = await sessionService.getRecordingUrl(sessionId);
      if (res && (res.playback_url || res.url || res.playbackUrl)) {
        const playback = res.playback_url || res.url || res.playbackUrl;
        toast.success('Recording is ready — opening playback');
        window.open(playback, '_blank');
        return;
      }
    } catch (err) {
      // If 425 Too Early or 404, keep polling
      console.debug('[RecordingControls] Poll error:', err?.response?.status, err?.message);
    }

    if (attempt < maxAttempts) {
      setTimeout(() => pollForPlaybackUrl(attempt + 1), intervalMs);
    } else {
      toast.info('Recording processing is taking longer than expected. Check later in Dashboard.');
    }
  };

  return (
    <div className="flex items-center gap-3 p-1 bg-white rounded-lg border">
      {/* Status + Timer */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className={`inline-block w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></span>
          <div className="flex flex-col">
            <span className={`text-xs ${isRecording ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{isRecording ? 'REC' : 'Idle'}</span>
            <span className="text-sm text-gray-800 font-mono">{recordingService ? recordingService.formatDuration(duration) : '0s'}</span>
          </div>
        </div>
      </div>

      {/* Controls: Start and Stop buttons always visible; enabled/disabled based on state */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleStartRecording}
          disabled={isRecording || sessionStatus !== 'connected' || error !== null}
          aria-disabled={isRecording || sessionStatus !== 'connected' || error !== null}
          className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors duration-200 ${(!isRecording && sessionStatus === 'connected' && !error) ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          title={sessionStatus !== 'connected' ? 'Connect session to record' : 'Start recording'}
        >
          <span className="text-lg">⏺️</span>
          {/* <span>Record</span> */}
        </button>

        <button
          onClick={handleStopRecording}
          disabled={!isRecording}
          aria-disabled={!isRecording}
          className={`flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors duration-200 ${isRecording ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          title="Stop recording"
        >
          <span className="text-lg">⏹️</span>
          {/* <span>Stop</span> */}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <span className="text-xs text-red-600 ml-2">
          ⚠️ {error}
        </span>
      )}
    </div>
  );
};

export default RecordingControls;
