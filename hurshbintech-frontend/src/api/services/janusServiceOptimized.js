/**
 * COMPLETE Recording Service with Full Implementation
 * All missing logic is now included and active
 * 
 * Features:
 * - Active MediaRecorder lifecycle
 * - 5-10 second chunk collection
 * - Automatic upload with retry logic
 * - Network failure handling
 * - Memory management
 * - Progress tracking
 * - Device adaptation
 */

import sessionService from './sessionService';

class JanusRecordingService {
  constructor(videoService, sessionId, options = {}) {
    this.videoService = videoService;
    this.sessionId = sessionId;

    console.log(`[RecordingService] ✅ Initialized with sessionId: ${sessionId} (type: ${typeof sessionId})`);

    // === CONFIGURATION ===
    this.config = {
      chunkDuration: options.chunkDuration || 5000, // 5 seconds
      bitrate: options.bitrate || 2500000, // 2.5 Mbps
      videoBitrate: options.videoBitrate || 2200000, // 2.2 Mbps
      audioBitrate: options.audioBitrate || 192000, // 192 kbps
      enableAdaptiveQuality: options.enableAdaptiveQuality !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000,
      ...options
    };

    // === RECORDING STATE ===
    this.isRecording = false;
    this.recordingId = null;
    this.recordingStartTime = null;
    this.recordingDuration = 0;
    this.chunkNumber = 0;
    this.uploadedChunks = new Set();
    this.failedChunks = new Map();

    // === MEDIARECORDER STATE ===
    this.mediaRecorder = null;
    this.currentChunkData = [];
    this.displayStream = null;
    this.isUploading = false;

    // === CALLBACKS ===
    this.onRecordingStateChange = null;
    this.onRecordingError = null;
    this.onChunkUploaded = null;
    this.onUploadProgress = null;

    // === DEVICE CAPABILITY ===
    this.deviceCapability = this.detectDeviceCapability();
    if (this.config.enableAdaptiveQuality) {
      this.adjustQualityForDevice();
    }

    // === UPLOAD QUEUE & RETRY ===
    this.uploadQueue = [];
    this.retryQueue = [];
    this.retryInProgress = false;
    this.isProcessingQueue = false;

    // === TIMERS ===
    this.recordingTimer = null;
    this.chunkUploadInterval = null;
    this.queueProcessInterval = null;

    // === NETWORK STATE ===
    this.isOnline = navigator.onLine;
    this.networkStatusCheckInterval = null;
    this.setupNetworkListener();

    // === STATS ===
    this.stats = {
      totalChunksCollected: 0,
      totalChunksUploaded: 0,
      totalChunksFailed: 0,
      totalBytesUploaded: 0,
      startTime: null,
      endTime: null
    };
  }

  // ============================================================================
  // DEVICE CAPABILITY DETECTION
  // ============================================================================

  detectDeviceCapability() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 8;
    const connection = navigator.connection || navigator.mozConnection;

    const effectiveType = connection?.effectiveType || '4g';
    const downlink = connection?.downlink || 10;

    return {
      cores,
      memory,
      effectiveType,
      downlink,
      isLowEnd: cores <= 2 || memory <= 4,
      isHighEnd: cores >= 8 && memory >= 16,
      isSlowNetwork: effectiveType === '3g' || effectiveType === '2g'
    };
  }

  adjustQualityForDevice() {
    const { isLowEnd, isSlowNetwork } = this.deviceCapability;

    if (isLowEnd) {
      this.config.bitrate = 1500000;
      this.config.videoBitrate = 1200000;
      this.config.audioBitrate = 128000;
      this.config.chunkDuration = 10000;
      console.log('[RecordingService] ⚠️ Adjusted for low-end device (1.2 Mbps)');
    }

    if (isSlowNetwork) {
      this.config.bitrate = 1200000;
      this.config.videoBitrate = 1000000;
      this.config.audioBitrate = 128000;
      this.config.chunkDuration = 15000;
      console.log('[RecordingService] ⚠️ Adjusted for slow network (1.0 Mbps)');
    }
  }

  // ============================================================================
  // NETWORK STATE MANAGEMENT
  // ============================================================================

  setupNetworkListener() {
    window.addEventListener('online', () => {
      console.log('[RecordingService] 🌐 Network restored');
      this.isOnline = true;
      // Resume any pending uploads
      this.processPendingUploads();
    });

    window.addEventListener('offline', () => {
      console.log('[RecordingService] ⚠️ Network lost');
      this.isOnline = false;
    });

    // Periodic network check every 10 seconds
    this.networkStatusCheckInterval = setInterval(() => {
      // Connection status is automatically updated by browser
    }, 10000);
  }

  // ============================================================================
  // START RECORDING
  // ============================================================================

  async startRecording() {
    try {
      if (this.isRecording) {
        console.warn('[RecordingService] Recording already in progress');
        return false;
      }

      // Generate recording ID
      this.recordingId = `session-${this.sessionId}-${Date.now()}`;
      this.recordingStartTime = new Date();
      this.recordingDuration = 0;
      this.chunkNumber = 0;
      this.uploadedChunks.clear();
      this.failedChunks.clear();
      this.uploadQueue = [];
      this.retryQueue = [];

      // Initialize stats
      this.stats = {
        totalChunksCollected: 0,
        totalChunksUploaded: 0,
        totalChunksFailed: 0,
        totalBytesUploaded: 0,
        startTime: new Date(),
        endTime: null
      };

      console.log(`[RecordingService] ▶️ Starting recording: ${this.recordingId}`);
      console.log(`[RecordingService] Device: ${this.deviceCapability.cores} cores, ${this.deviceCapability.memory}GB RAM, ${this.deviceCapability.effectiveType}`);
      console.log(`[RecordingService] Bitrate: ${this.config.videoBitrate} bps, Chunk: ${this.config.chunkDuration}ms`);

      // === GET DISPLAY MEDIA ===
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          cursor: 'always',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude'
      });

      // === GET AUDIO FROM MICROPHONE ===
      const localStream = this.videoService?.localStream;
      let audioTrack = null;
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTrack = audioTracks[0];
        }
      }

      // === COMBINE STREAMS ===
      const stream = new MediaStream();
      displayStream.getVideoTracks().forEach(track => stream.addTrack(track));
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }

      this.displayStream = displayStream;

      // === CREATE MEDIARECORDER ===
      this.currentChunkData = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: this.config.videoBitrate,
        audioBitsPerSecond: this.config.audioBitrate
      });

      // === HANDLE DATA AVAILABLE ===
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.currentChunkData.push(event.data);
          console.log(`[RecordingService] 📦 Data chunk: ${(event.data.size / 1024).toFixed(2)} KB`);
        }
      };

      // === HANDLE RECORDING STOP ===
      this.mediaRecorder.onstop = async () => {
        console.log('[RecordingService] ⏹️ MediaRecorder stopped');
        await this.handleRecordingStop();
      };

      // === START RECORDING ===
      this.mediaRecorder.start(this.config.chunkDuration);
      this.isRecording = true;

      // === START CHUNK UPLOAD INTERVAL ===
      this.startChunkCollection();

      // === START DURATION TIMER ===
      this.startDurationTimer();

      // === PROCESS UPLOAD QUEUE ===
      this.startQueueProcessor();

      // Handle stream stop (user clicked "Stop sharing")
      displayStream.getTracks().forEach(track => {
        track.onended = () => {
          console.log('[RecordingService] User stopped screen sharing');
          this.stopRecording();
        };
      });

      // Notify listeners
      if (this.onRecordingStateChange) {
        this.onRecordingStateChange('recording');
      }

      return true;
    } catch (error) {
      console.error('[RecordingService] ❌ Error starting recording:', error);
      this.isRecording = false;

      if (this.onRecordingError) {
        this.onRecordingError({
          message: error.message,
          code: error.name
        });
      }

      return false;
    }
  }

  // ============================================================================
  // CHUNK COLLECTION
  // ============================================================================

  startChunkCollection() {
    console.log('[RecordingService] 🔄 Starting chunk collection (every 5s)');

    this.chunkUploadInterval = setInterval(async () => {
      if (!this.mediaRecorder || !this.isRecording) {
        return;
      }

      try {
        // Request data from MediaRecorder
        this.mediaRecorder.requestData();

        // Wait a bit for ondataavailable to fire
        setTimeout(() => {
          if (this.currentChunkData.length > 0) {
            this.extractAndQueueChunk();
          }
        }, 50);
      } catch (error) {
        console.error('[RecordingService] Error collecting chunk:', error);
      }
    }, this.config.chunkDuration);
  }

  extractAndQueueChunk() {
    try {
      // Create blob from collected data
      const chunkBlob = new Blob(this.currentChunkData, { type: 'video/webm' });

      if (chunkBlob.size === 0) {
        console.warn('[RecordingService] ⚠️ Empty chunk, skipping');
        this.currentChunkData = [];
        return;
      }

      this.chunkNumber++;
      this.stats.totalChunksCollected++;

      console.log(`[RecordingService] 📹 Chunk #${this.chunkNumber} created: ${(chunkBlob.size / 1024).toFixed(2)} KB`);

      // Queue for upload
      this.uploadQueue.push({
        chunkNumber: this.chunkNumber,
        blob: chunkBlob,
        size: chunkBlob.size,
        createdAt: new Date(),
        retries: 0
      });

      // Reset buffer
      this.currentChunkData = [];

      console.log(`[RecordingService] 📋 Upload queue size: ${this.uploadQueue.length}`);
    } catch (error) {
      console.error('[RecordingService] Error extracting chunk:', error);
    }
  }

  // ============================================================================
  // UPLOAD QUEUE PROCESSING
  // ============================================================================

  startQueueProcessor() {
    console.log('[RecordingService] 🚀 Starting queue processor');

    this.queueProcessInterval = setInterval(async () => {
      if (this.uploadQueue.length > 0 && !this.isProcessingQueue && this.isOnline) {
        this.isProcessingQueue = true;
        const chunk = this.uploadQueue.shift();

        try {
          await this.uploadChunkWithRetry(chunk);
        } catch (error) {
          console.error('[RecordingService] Error uploading chunk:', error);
        } finally {
          this.isProcessingQueue = false;
        }
      }
    }, 500); // Check queue every 500ms
  }

  async uploadChunkWithRetry(chunk, attempt = 1) {
    if (!this.isOnline) {
      console.log('[RecordingService] 📵 Offline, queuing chunk for retry');
      this.retryQueue.push(chunk);
      return;
    }

    try {
      console.log(`[RecordingService] 📤 Uploading chunk #${chunk.chunkNumber} (attempt ${attempt}/${this.config.maxRetries})`);

      const formData = new FormData();
      formData.append('chunk', chunk.blob, `chunk_${chunk.chunkNumber}.webm`);
      formData.append('session_id', this.sessionId);
      formData.append('chunk_number', chunk.chunkNumber);
      formData.append('recording_id', this.recordingId);

      // Upload with timeout
      const response = await Promise.race([
        sessionService.uploadRecordingChunk(formData),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout')), 60000)
        )
      ]);

      this.uploadedChunks.add(chunk.chunkNumber);
      this.stats.totalChunksUploaded++;
      this.stats.totalBytesUploaded += chunk.size;

      console.log(`[RecordingService] ✅ Chunk #${chunk.chunkNumber} uploaded (${(chunk.size / 1024).toFixed(2)} KB)`);

      if (this.onChunkUploaded) {
        this.onChunkUploaded({
          chunkNumber: chunk.chunkNumber,
          size: chunk.size,
          success: true
        });
      }
    } catch (error) {
      console.error(`[RecordingService] ❌ Upload failed (attempt ${attempt}):`, error.message);

      // Exponential backoff retry
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        console.log(`[RecordingService] ⏳ Retrying in ${delay}ms...`);

        // Keep retry chain awaited so stop/finalize waits for completion.
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.uploadChunkWithRetry(chunk, attempt + 1);
      } else {
        console.error(`[RecordingService] ❌ Chunk #${chunk.chunkNumber} failed after ${this.config.maxRetries} attempts`);
        this.failedChunks.set(chunk.chunkNumber, error);
        this.stats.totalChunksFailed++;

        if (this.onChunkUploaded) {
          this.onChunkUploaded({
            chunkNumber: chunk.chunkNumber,
            size: chunk.size,
            success: false,
            error: error.message
          });
        }
      }
    }
  }

  async processPendingUploads() {
    console.log(`[RecordingService] 🔄 Processing ${this.retryQueue.length} pending uploads`);

    while (this.retryQueue.length > 0) {
      const chunk = this.retryQueue.shift();
      await this.uploadChunkWithRetry(chunk);
    }
  }

  // ============================================================================
  // DURATION TRACKING
  // ============================================================================

  startDurationTimer() {
    this.recordingTimer = setInterval(() => {
      if (this.isRecording && this.recordingStartTime) {
        this.recordingDuration = Math.floor(
          (new Date() - this.recordingStartTime) / 1000
        );
      }
    }, 100); // Update every 100ms
  }

  formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  // ============================================================================
  // STOP RECORDING
  // ============================================================================

  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.warn('[RecordingService] Recording not in progress');
        return false;
      }

      console.log('[RecordingService] ⏹️ Stopping recording...');

      // Stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop streams
      if (this.displayStream) {
        this.displayStream.getTracks().forEach(track => track.stop());
      }

      // Stop timers
      if (this.chunkUploadInterval) clearInterval(this.chunkUploadInterval);
      if (this.recordingTimer) clearInterval(this.recordingTimer);

      // Extract final chunk
      if (this.currentChunkData.length > 0) {
        this.extractAndQueueChunk();
      }

      // Update stats
      this.stats.endTime = new Date();
      console.log('[RecordingService] 📊 Recording Stats:');
      console.log(`  - Duration: ${this.formatDuration(this.recordingDuration)}`);
      console.log(`  - Chunks collected: ${this.stats.totalChunksCollected}`);
      console.log(`  - Chunks uploaded: ${this.stats.totalChunksUploaded}`);
      console.log(`  - Chunks failed: ${this.stats.totalChunksFailed}`);
      console.log(`  - Total size: ${(this.stats.totalBytesUploaded / 1024 / 1024).toFixed(2)} MB`);

      this.isRecording = false;

      // Wait for all uploads to complete
      await this.waitForUploadsComplete();

      // Queue processor is no longer needed once uploads are done
      if (this.queueProcessInterval) {
        clearInterval(this.queueProcessInterval);
        this.queueProcessInterval = null;
      }

      // Notify listeners
      if (this.onRecordingStateChange) {
        this.onRecordingStateChange('stopped');
      }

      // Finalize recording on server
      await this.finalizeRecording();

      return true;
    } catch (error) {
      console.error('[RecordingService] Error stopping recording:', error);
      if (this.onRecordingError) {
        this.onRecordingError({ message: error.message });
      }
      return false;
    }
  }

  async handleRecordingStop() {
    console.log('[RecordingService] Finalizing recording after MediaRecorder stop');
  }

  waitForUploadsComplete() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (
          this.uploadQueue.length === 0 &&
          this.retryQueue.length === 0 &&
          !this.isProcessingQueue
        ) {
          clearInterval(checkInterval);
          console.log('[RecordingService] ✅ All uploads complete');
          resolve();
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[RecordingService] Upload timeout after 5 minutes');
        resolve();
      }, 300000);
    });
  }

  // ============================================================================
  // FINALIZATION
  // ============================================================================

  async finalizeRecording() {
    try {
      console.log('[RecordingService] 🔀 Finalizing recording...');

      if (this.uploadedChunks.size === 0) {
        console.error('[RecordingService] No chunks were successfully uploaded');
        throw new Error('No chunks uploaded');
      }

      const response = await sessionService.finalizeRecording({
        recording_id: this.recordingId,
        session_id: this.sessionId,
        chunk_count: this.chunkNumber,
        total_chunks_uploaded: this.uploadedChunks.size,
        uploaded_chunks: Array.from(this.uploadedChunks).sort((a, b) => a - b),
        failed_chunks: Array.from(this.failedChunks.keys()).sort((a, b) => a - b),
        duration: this.recordingDuration
      });

      console.log('[RecordingService] ✅ Recording finalized successfully');
      return response;
    } catch (error) {
      console.error('[RecordingService] Error finalizing recording:', error);
      if (this.onRecordingError) {
        this.onRecordingError({ message: error.message });
      }
      throw error;
    }
  }

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      duration: this.recordingDuration,
      chunkCount: this.chunkNumber,
      uploadedChunks: this.uploadedChunks.size,
      queueSize: this.uploadQueue.length,
      stats: this.stats
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  destroy() {
    console.log('[RecordingService] 🧹 Destroying recording service');

    // Stop all timers
    if (this.chunkUploadInterval) clearInterval(this.chunkUploadInterval);
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    if (this.queueProcessInterval) clearInterval(this.queueProcessInterval);
    if (this.networkStatusCheckInterval) clearInterval(this.networkStatusCheckInterval);

    // Stop recording if active
    if (this.isRecording) {
      this.stopRecording();
    }

    // Stop streams
    if (this.displayStream) {
      this.displayStream.getTracks().forEach(track => track.stop());
    }

    // Clear data
    this.currentChunkData = [];
    this.uploadQueue = [];
    this.retryQueue = [];
    this.uploadedChunks.clear();
    this.failedChunks.clear();

    console.log('[RecordingService] ✅ Cleanup complete');
  }
}

export default JanusRecordingService;
