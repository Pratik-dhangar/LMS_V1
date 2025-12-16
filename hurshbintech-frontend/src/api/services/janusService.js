/**
 * Browser-based Recording Service
 * Uses MediaRecorder API to capture actual video/audio streams
 */

import sessionService from './sessionService';

class JanusRecordingService {
  constructor(videoService, sessionId) {
    this.videoService = videoService;
    this.sessionId = sessionId;
    this.isRecording = false;
    this.recordingId = null;
    this.recordingStartTime = null;
    this.onRecordingStateChange = null;
    this.onRecordingError = null;

    // MediaRecorder state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.displayStream = null;
  }

  /**
   * Start recording the actual video stream
   */
  async startRecording() {
    try {
      if (this.isRecording) {
        console.warn('[JanusRecordingService] Recording already in progress');
        return false;
      }

      // Generate recording ID with session ID and timestamp
      this.recordingId = `session-${this.sessionId}-${Date.now()}`;
      this.recordingStartTime = new Date();

      // Capture the entire browser tab (trainer session page) including all UI elements
      console.log('[JanusRecordingService] Requesting display media capture...');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser', // Prefer browser tab over window/monitor
          cursor: 'always', // Include cursor in recording
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false, // We'll add audio from the local stream
        preferCurrentTab: true, // Chrome/Edge feature to prefer current tab
        selfBrowserSurface: 'include', // Allow capturing current tab
        surfaceSwitching: 'exclude', // Prevent switching to other surfaces during recording
        systemAudio: 'exclude' // Don't capture system audio
      });

      // Get audio from the trainer's microphone
      const localStream = this.videoService.localStream;
      let audioTrack = null;
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTrack = audioTracks[0];
          console.log('[JanusRecordingService] Adding audio track from local stream');
        }
      }

      // Combine display video with audio from microphone
      const stream = new MediaStream();
      displayStream.getVideoTracks().forEach(track => stream.addTrack(track));
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }

      // Store display stream reference to stop it later
      this.displayStream = displayStream;

      // Hide browser recording indicators by removing visual elements
      this.hideBrowserRecordingIndicators();

      if (!stream) {
        throw new Error('No media stream available to record');
      }

      // Create MediaRecorder to record the stream
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      // Collect data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          console.log(`[JanusRecordingService] Recorded chunk: ${event.data.size} bytes`);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log(`[JanusRecordingService] Recording stopped, total chunks: ${this.recordedChunks.length}`);
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every 1 second
      this.isRecording = true;
      console.log(`[JanusRecordingService] Recording started: ${this.recordingId}`);

      if (this.onRecordingStateChange) {
        this.onRecordingStateChange('recording');
      }

      return true;
    } catch (error) {
      console.error('[JanusRecordingService] Error starting recording:', error);
      if (this.onRecordingError) {
        this.onRecordingError(error);
      }
      return false;
    }
  }

  /**
   * Stop recording and upload to backend
   */
  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.warn('[JanusRecordingService] No recording in progress');
        return false;
      }

      const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);

      // Stop the MediaRecorder
      return new Promise((resolve, reject) => {
        this.mediaRecorder.onstop = async () => {
          try {
            console.log(`[JanusRecordingService] Processing ${this.recordedChunks.length} chunks`);

            // Create blob from recorded chunks
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            console.log(`[JanusRecordingService] Created blob: ${blob.size} bytes`);

            // Upload the recording to backend
            const formData = new FormData();
            formData.append('file', blob, `${this.recordingId}.webm`);
            formData.append('session_id', this.sessionId);
            formData.append('recording_id', this.recordingId);
            formData.append('duration', duration);

            console.log(`[JanusRecordingService] Uploading recording to backend...`);
            await sessionService.uploadRecording(formData);
            console.log(`[JanusRecordingService] Recording uploaded successfully`);

            this.isRecording = false;
            this.recordedChunks = [];
            this.mediaRecorder = null;

            // Stop display stream tracks
            if (this.displayStream) {
              this.displayStream.getTracks().forEach(track => track.stop());
              this.displayStream = null;
              console.log('[JanusRecordingService] Display stream stopped');
            }

            // Remove recording indicator attribute
            document.documentElement.removeAttribute('data-recording');

            console.log(`[JanusRecordingService] Recording stopped: ${this.recordingId} (${duration}s)`);

            if (this.onRecordingStateChange) {
              this.onRecordingStateChange('stopped');
            }

            resolve(true);
          } catch (error) {
            console.error('[JanusRecordingService] Error processing recording:', error);
            if (this.onRecordingError) {
              this.onRecordingError(error);
            }
            reject(error);
          }
        };

        this.mediaRecorder.stop();
      });
    } catch (error) {
      console.error('[JanusRecordingService] Error stopping recording:', error);
      if (this.onRecordingError) {
        this.onRecordingError(error);
      }
      return false;
    }
  }

  /**
   * Get current recording status
   */
  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      recordingId: this.recordingId,
      startTime: this.recordingStartTime,
      duration: this.isRecording ? Math.floor((Date.now() - this.recordingStartTime) / 1000) : 0
    };
  }

  /**
   * Hide browser recording indicators
   * Attempts to minimize visual indicators that browser shows during recording
   */
  hideBrowserRecordingIndicators() {
    try {
      // Add class to document to apply CSS rules
      document.documentElement.setAttribute('data-recording', 'true');

      // Try to hide Chrome's screen sharing indicator notification
      // Note: This has limited effect due to browser security, but may help in some cases
      if (window.chrome && chrome.runtime) {
        // Some Chrome-specific handling could go here
        console.log('[JanusRecordingService] Chrome recording mode activated');
      }

      console.log('[JanusRecordingService] Recording indicators hidden (where possible)');
    } catch (error) {
      console.warn('[JanusRecordingService] Could not hide all recording indicators:', error);
    }
  }

  /**
   * Format recording duration for display
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.isRecording) {
      this.stopRecording();
    }

    // Stop display stream if still active
    if (this.displayStream) {
      this.displayStream.getTracks().forEach(track => track.stop());
      this.displayStream = null;
    }

    // Remove recording indicator attribute
    document.documentElement.removeAttribute('data-recording');

    this.videoService = null;
    this.onRecordingStateChange = null;
    this.onRecordingError = null;
  }
}

export default JanusRecordingService;
