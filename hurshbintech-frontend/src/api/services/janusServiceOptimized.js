// /**
//  * Optimized Browser-based Recording Service with Chunked Uploads
//  * Features:
//  * - Chunked uploads to prevent data loss
//  * - Adaptive quality based on device capability
//  * - Efficient memory management
//  * - Retry mechanism for failed uploads
//  * - Reduced CPU utilization
//  */

// import sessionService from './sessionService';

// class JanusRecordingServiceOptimized {
//   constructor(videoService, sessionId, options = {}) {
//     this.videoService = videoService;
//     this.sessionId = sessionId;

//     console.log(`[JanusRecordingService] Initialized with sessionId: ${sessionId} (type: ${typeof sessionId})`);

//     // Configuration with defaults
//     this.config = {
//       // Chunk interval - reduced from 10s to 5s for faster recovery on network issues
//       chunkDuration: options.chunkDuration || 5000,

//       // VIDEO QUALITY IMPROVEMENTS (Increased from 1Mbps to 3.5Mbps range)
//       // Standard HD video needs 2.5-3.5 Mbps for good quality
//       bitrate: options.bitrate || 2500000, // 2.5 Mbps (was 1.5 Mbps)
//       videoBitrate: options.videoBitrate || 2200000, // 2.2 Mbps video (was 1 Mbps)
//       audioBitrate: options.audioBitrate || 192000, // 192 kbps audio (was 128 kbps)

//       enableAdaptiveQuality: options.enableAdaptiveQuality !== false,
//       maxRetries: options.maxRetries || 3,
//       retryDelay: options.retryDelay || 2000,
//       ...options
//     };

//     // Recording state
//     this.isRecording = false;
//     this.recordingId = null;
//     this.recordingStartTime = null;
//     this.chunkNumber = 0;
//     this.uploadedChunks = new Set();
//     this.failedChunks = new Map();

//     // MediaRecorder state
//     this.mediaRecorder = null;
//     this.currentChunkData = [];
//     this.displayStream = null;
//     this.isUploading = false;

//     // Callbacks
//     this.onRecordingStateChange = null;
//     this.onRecordingError = null;
//     this.onChunkUploaded = null;
//     this.onUploadProgress = null;

//     // Device capability detection
//     this.deviceCapability = this.detectDeviceCapability();

//     // Adjust quality based on device
//     if (this.config.enableAdaptiveQuality) {
//       this.adjustQualityForDevice();
//     }

//     // Retry queue
//     this.retryQueue = [];
//     this.retryInProgress = false;
//   }

//   /**
//    * Detect device capability (CPU, RAM, Network)
//    */
//   detectDeviceCapability() {
//     const cores = navigator.hardwareConcurrency || 4;
//     const memory = navigator.deviceMemory || 8;
//     const connection = navigator.connection || navigator.mozConnection;

//     const effectiveType = connection?.effectiveType || '4g';
//     const downlink = connection?.downlink || 10;

//     return {
//       cores,
//       memory,
//       effectiveType,
//       downlink,
//       isLowEnd: cores <= 2 || memory <= 4,
//       isHighEnd: cores >= 8 && memory >= 16,
//       isSlowNetwork: effectiveType === '3g' || effectiveType === '2g'
//     };
//   }

//   /**
//    * Adjust quality based on device capability
//    */
//   adjustQualityForDevice() {
//     const { isLowEnd, isSlowNetwork } = this.deviceCapability;

//     if (isLowEnd) {
//       // Reduce bitrate and resolution for low-end devices
//       // But keep it higher than original for better quality
//       this.config.bitrate = 1500000; // 1.5 Mbps (reduced from 2.5)
//       this.config.videoBitrate = 1200000; // 1.2 Mbps video
//       this.config.audioBitrate = 128000; // Keep audio bitrate lower for low-end
//       this.config.chunkDuration = 10000; // Larger chunks
//       console.log('[JanusRecordingService] Adjusted quality for low-end device (1.2Mbps video)');
//     }

//     if (isSlowNetwork) {
//       // Reduce bitrate for slow networks but stay above minimum
//       this.config.bitrate = 1200000; // 1.2 Mbps
//       this.config.videoBitrate = 1000000; // 1 Mbps video
//       this.config.audioBitrate = 128000;
//       this.config.chunkDuration = 15000; // Larger chunks for slow networks
//       console.log('[JanusRecordingService] Adjusted quality for slow network (1.0Mbps video)');
//     }
//   }

//   /**
//    * Start recording with chunked upload
//    */
//   async startRecording() {
//     try {
//       if (this.isRecording) {
//         console.warn('[JanusRecordingService] Recording already in progress');
//         return false;
//       }

//       // Generate recording ID
//       this.recordingId = `session-${this.sessionId}-${Date.now()}`;
//       this.recordingStartTime = new Date();
//       this.chunkNumber = 0;
//       this.uploadedChunks.clear();
//       this.failedChunks.clear();

//       console.log(`[JanusRecordingService] Starting optimized recording: ${this.recordingId}`);
//       console.log(`[JanusRecordingService] Device - Cores: ${this.deviceCapability.cores}, Memory: ${this.deviceCapability.memory}GB, Network: ${this.deviceCapability.effectiveType}`);
//       console.log(`[JanusRecordingService] Bitrate: ${this.config.bitrate} bps, Chunk Duration: ${this.config.chunkDuration}ms`);

//       // Request display media
//       const displayStream = await navigator.mediaDevices.getDisplayMedia({
//         video: {
//           displaySurface: 'browser',
//           cursor: 'always',
//           width: { ideal: 1920 }, // Full HD for better quality
//           height: { ideal: 1080 },
//           frameRate: { ideal: 30 } // 30fps for smooth video
//         },
//         audio: false,
//         preferCurrentTab: true,
//         selfBrowserSurface: 'include',
//         surfaceSwitching: 'exclude',
//         systemAudio: 'exclude'
//       });

//       // Get audio from trainer's microphone
//       const localStream = this.videoService.localStream;
//       let audioTrack = null;
//       if (localStream) {
//         const audioTracks = localStream.getAudioTracks();
//         if (audioTracks.length > 0) {
//           audioTrack = audioTracks[0];
//         }
//       }

//       // Combine streams
//       const stream = new MediaStream();
//       displayStream.getVideoTracks().forEach(track => stream.addTrack(track));
//       if (audioTrack) {
//         stream.addTrack(audioTrack);
//       }

//       this.displayStream = displayStream;

//       // Create MediaRecorder with optimized settings
//       this.currentChunkData = [];
//       this.mediaRecorder = new MediaRecorder(stream, {
//         mimeType: 'video/webm;codecs=vp8,opus',
//         videoBitsPerSecond: this.config.videoBitrate,
//         audioBitsPerSecond: this.config.audioBitrate
//       });

//       // Handle data available
//       this.mediaRecorder.ondataavailable = (event) => {
//         if (event.data && event.data.size > 0) {
//           this.currentChunkData.push(event.data);
//           console.log(`[JanusRecordingService] Data chunk: ${event.data.size} bytes (total: ${this.currentChunkData.reduce((a, b) => a + b.size, 0)} bytes)`);
//         }
//       };

//       // Handle recording stop
//       this.mediaRecorder.onstop = async () => {
//         console.log('[JanusRecordingService] MediaRecorder stopped');
//         await this.finalizeRecording();
//       };

//       // Start recording
//       this.mediaRecorder.start(this.config.chunkDuration);
//       this.isRecording = true;

//       // Start chunk upload interval
//       this.startChunkUploadInterval();

//       if (this.onRecordingStateChange) {
//         this.onRecordingStateChange('recording');
//       }

//       return true;
//     } catch (error) {
//       console.error('[JanusRecordingService] Error starting recording:', error);
//       if (this.onRecordingError) {
//         this.onRecordingError(error);
//       }
//       return false;
//     }
//   }

//   /**
//    * Start interval to upload chunks while recording
//    */
//   startChunkUploadInterval() {
//     this.uploadInterval = setInterval(async () => {
//       if (this.currentChunkData.length > 0 && !this.isUploading) {
//         await this.uploadCurrentChunk();
//       }
//     }, this.config.chunkDuration);

//     console.log('[JanusRecordingService] Chunk upload interval started');
//   }

//   /**
//    * Calculate SHA256 checksum for chunk validation
//    */
//   async calculateChecksum(blob) {
//     try {
//       const buffer = await blob.arrayBuffer();
//       const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
//       const hashArray = Array.from(new Uint8Array(hashBuffer));
//       const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
//       return hashHex;
//     } catch (error) {
//       console.warn('[JanusRecordingService] Checksum calculation failed:', error);
//       return null;
//     }
//   }

//   /**
//    * Upload current chunk to server
//    */
//   async uploadCurrentChunk() {
//     if (this.currentChunkData.length === 0 || this.isUploading) {
//       return;
//     }

//     // Snapshot and clear immediately so new MediaRecorder data is never lost
//     // while an upload is in progress.
//     const chunkDataToUpload = this.currentChunkData;
//     this.currentChunkData = [];

//     this.isUploading = true;

//     try {
//       const chunkBlob = new Blob(chunkDataToUpload, { type: 'video/webm' });
//       const chunkSize = chunkBlob.size;

//       if (chunkSize === 0) {
//         this.isUploading = false;
//         return;
//       }

//       // Calculate checksum for validation
//       const checksum = await this.calculateChecksum(chunkBlob);

//       const formData = new FormData();
//       formData.append('file', chunkBlob, `${this.recordingId}-chunk-${this.chunkNumber}.webm`);
//       formData.append('session_id', String(this.sessionId));
//       formData.append('recording_id', this.recordingId);
//       formData.append('chunk_number', String(this.chunkNumber));
//       if (checksum) {
//         formData.append('checksum', checksum);
//       }

//       console.log(`[JanusRecordingService] Uploading chunk ${this.chunkNumber} (${chunkSize} bytes)${checksum ? ` [SHA256: ${checksum.substring(0, 8)}...]` : ''}...`);

//       await sessionService.uploadRecordingChunk(formData);

//       this.uploadedChunks.add(this.chunkNumber);
//       this.failedChunks.delete(this.chunkNumber);
//       this.chunkNumber++;
//       this.currentChunkData = [];

//       console.log(`[JanusRecordingService] ✅ Chunk ${this.chunkNumber - 1} uploaded successfully`);

//       if (this.onChunkUploaded) {
//         this.onChunkUploaded({
//           chunkNumber: this.chunkNumber - 1,
//           size: chunkSize,
//           checksum: checksum,
//           uploadedChunks: this.uploadedChunks.size
//         });
//       }

//       if (this.onUploadProgress) {
//         this.onUploadProgress({
//           uploadedChunks: this.uploadedChunks.size,
//           totalChunks: this.chunkNumber
//         });
//       }
//     } catch (error) {
//       console.error(`[JanusRecordingService] ❌ Error uploading chunk ${this.chunkNumber}:`, error);

//       // Add to retry queue
//       this.failedChunks.set(this.chunkNumber, {
//         data: chunkDataToUpload,
//         retries: 0,
//         lastError: error
//       });

//       this.addToRetryQueue(this.chunkNumber);

//       if (this.onRecordingError) {
//         this.onRecordingError({
//           type: 'chunk_upload_failed',
//           chunkNumber: this.chunkNumber,
//           error
//         });
//       }

//       // Preserve ordering: advance sequence for failed uploads too.
//       this.chunkNumber++;
//     } finally {
//       this.isUploading = false;
//     }
//   }

//   /**
//    * Add failed chunk to retry queue
//    */
//   addToRetryQueue(chunkNumber) {
//     if (!this.retryQueue.includes(chunkNumber)) {
//       this.retryQueue.push(chunkNumber);
//       console.log(`[JanusRecordingService] Added chunk ${chunkNumber} to retry queue`);

//       if (!this.retryInProgress) {
//         this.processRetryQueue();
//       }
//     }
//   }

//   /**
//    * Process retry queue
//    */
//   async processRetryQueue() {
//     if (this.retryInProgress || this.retryQueue.length === 0) {
//       return;
//     }

//     this.retryInProgress = true;

//     while (this.retryQueue.length > 0) {
//       const chunkNumber = this.retryQueue.shift();
//       const failedChunk = this.failedChunks.get(chunkNumber);

//       if (!failedChunk) {
//         continue;
//       }

//       if (failedChunk.retries >= this.config.maxRetries) {
//         console.error(`[JanusRecordingService] Max retries reached for chunk ${chunkNumber}`);
//         this.failedChunks.delete(chunkNumber);
//         continue;
//       }

//       failedChunk.retries++;

//       try {
//         console.log(`[JanusRecordingService] Retrying chunk ${chunkNumber} (attempt ${failedChunk.retries}/${this.config.maxRetries})...`);

//         const chunkBlob = new Blob(failedChunk.data, { type: 'video/webm' });
//         const checksum = await this.calculateChecksum(chunkBlob);

//         const formData = new FormData();
//         formData.append('file', chunkBlob, `${this.recordingId}-chunk-${chunkNumber}.webm`);
//         formData.append('session_id', String(this.sessionId));
//         formData.append('recording_id', this.recordingId);
//         formData.append('chunk_number', String(chunkNumber));
//         if (checksum) {
//           formData.append('checksum', checksum);
//         }

//         await sessionService.uploadRecordingChunk(formData);

//         this.uploadedChunks.add(chunkNumber);
//         this.failedChunks.delete(chunkNumber);
//         console.log(`[JanusRecordingService] ✅ Chunk ${chunkNumber} uploaded successfully on retry`);
//       } catch (error) {
//         console.error(`[JanusRecordingService] ❌ Retry failed for chunk ${chunkNumber}:`, error);
//         failedChunk.lastError = error;
//         this.retryQueue.push(chunkNumber); // Re-add to queue
//       }

//       // Wait before next retry
//       await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
//     }

//     this.retryInProgress = false;
//   }

//   /**
//    * Stop recording and finalize upload
//    */
//   async stopRecording() {
//     try {
//       if (!this.isRecording) {
//         console.warn('[JanusRecordingService] No recording in progress');
//         return false;
//       }

//       return new Promise((resolve, reject) => {
//         this.mediaRecorder.onstop = async () => {
//           try {
//             // Clear upload interval
//             if (this.uploadInterval) {
//               clearInterval(this.uploadInterval);
//             }

//             // Upload remaining chunks
//             if (this.currentChunkData.length > 0) {
//               await this.uploadCurrentChunk();
//             }

//             // Wait for all retries to complete
//             await this.processRetryQueue();

//             // Finalize recording on server
//             const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
//             await this.finalizeRecordingOnServer(duration);

//             this.isRecording = false;
//             this.currentChunkData = [];
//             this.mediaRecorder = null;

//             // Stop display stream
//             if (this.displayStream) {
//               this.displayStream.getTracks().forEach(track => track.stop());
//               this.displayStream = null;
//             }

//             document.documentElement.removeAttribute('data-recording');

//             console.log(`[JanusRecordingService] Recording stopped: ${this.recordingId} (${duration}s, ${this.uploadedChunks.size} chunks)`);

//             if (this.onRecordingStateChange) {
//               this.onRecordingStateChange('stopped');
//             }

//             resolve(true);
//           } catch (error) {
//             console.error('[JanusRecordingService] Error finalizing recording:', error);
//             if (this.onRecordingError) {
//               this.onRecordingError(error);
//             }
//             reject(error);
//           }
//         };

//         this.mediaRecorder.stop();
//       });
//     } catch (error) {
//       console.error('[JanusRecordingService] Error stopping recording:', error);
//       if (this.onRecordingError) {
//         this.onRecordingError(error);
//       }
//       return false;
//     }
//   }

//   /**
//    * Finalize recording on server (merge chunks)
//    */
//   async finalizeRecordingOnServer(duration) {
//     try {
//       console.log(`[JanusRecordingService] Finalizing recording on server...`);

//       const finalizationData = {
//         recording_id: this.recordingId,
//         session_id: this.sessionId,
//         duration: duration,
//         total_chunks: this.chunkNumber,
//         uploaded_chunks: Array.from(this.uploadedChunks),
//         failed_chunks: Array.from(this.failedChunks.keys())
//       };

//       const response = await sessionService.finalizeRecording(finalizationData);
//       console.log('[JanusRecordingService] Recording finalized on server:', response);

//       return response;
//     } catch (error) {
//       console.error('[JanusRecordingService] Error finalizing recording on server:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get recording status
//    */
//   getRecordingStatus() {
//     return {
//       isRecording: this.isRecording,
//       recordingId: this.recordingId,
//       startTime: this.recordingStartTime,
//       duration: this.isRecording ? Math.floor((Date.now() - this.recordingStartTime) / 1000) : 0,
//       currentChunk: this.chunkNumber,
//       uploadedChunks: this.uploadedChunks.size,
//       failedChunks: this.failedChunks.size,
//       isUploading: this.isUploading,
//       deviceCapability: this.deviceCapability,
//       config: this.config
//     };
//   }

//   /**
//    * Cleanup resources
//    */
//   destroy() {
//     if (this.uploadInterval) {
//       clearInterval(this.uploadInterval);
//     }

//     if (this.isRecording) {
//       this.stopRecording();
//     }

//     if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
//       this.mediaRecorder.stop();
//     }

//     if (this.displayStream) {
//       this.displayStream.getTracks().forEach(track => track.stop());
//     }

//     this.currentChunkData = [];
//     this.uploadedChunks.clear();
//     this.failedChunks.clear();
//     this.retryQueue = [];
//   }

//   /**
//    * Finalize recording (called from stop)
//    */
//   async finalizeRecording() {
//     // This is called by mediaRecorder.onstop
//     console.log('[JanusRecordingService] Recording finalized');
//   }
// }

// export default JanusRecordingServiceOptimized;


/**
 * Optimized Browser-based Recording Service with Chunked Uploads
 * WORKING VERSION - Proper chunk extraction
 * 
 * The key insight: Let MediaRecorder buffer data naturally,
 * don't force requestData() immediately. Let it accumulate for 10 seconds.
 */

import sessionService from './sessionService';

class JanusRecordingServiceOptimized {
  constructor(videoService, sessionId, options = {}) {
    this.videoService = videoService;
    this.sessionId = sessionId;

    console.log(`[JanusRecordingService] Initialized with sessionId: ${sessionId}`);

    this.config = {
      chunkDuration: options.chunkDuration || 10000, // 10 seconds - let data buffer naturally
      bitrate: options.bitrate || 1800000,
      videoBitrate: options.videoBitrate || 1800000,
      audioBitrate: options.audioBitrate || 192000,
      enableAdaptiveQuality: options.enableAdaptiveQuality !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000,
      ...options
    };

    this.isRecording = false;
    this.recordingId = null;
    this.recordingStartTime = null;
    this.chunkNumber = 0;
    this.uploadedChunks = new Set();
    this.failedChunks = new Map();

    this.mediaRecorder = null;
    this.currentChunkData = [];
    this.displayStream = null;
    this.isUploading = false;

    this.onRecordingStateChange = null;
    this.onRecordingError = null;
    this.onChunkUploaded = null;
    this.onUploadProgress = null;

    this.deviceCapability = this.detectDeviceCapability();

    if (this.config.enableAdaptiveQuality) {
      this.adjustQualityForDevice();
    }

    this.retryQueue = [];
    this.retryInProgress = false;
    this.chunkExtractionTimer = null;
    this.chunkMimeType = 'video/webm';
    this.chunkFileExtension = 'webm';
  }

  getSupportedRecorderFormat() {
    const candidates = [
      { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
      { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
      { mimeType: 'video/webm', extension: 'webm' },
      { mimeType: 'video/mp4', extension: 'mp4' }
    ];

    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        return candidate;
      }
    }

    return { mimeType: '', extension: 'webm' };
  }

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
      this.config.bitrate = 1200000;
      this.config.videoBitrate = 1200000;
      this.config.audioBitrate = 128000;
      this.config.chunkDuration = 15000;
      console.log('[JanusRecordingService] Adjusted for low-end device');
    }

    if (isSlowNetwork) {
      this.config.bitrate = 1000000;
      this.config.videoBitrate = 1000000;
      this.config.audioBitrate = 128000;
      this.config.chunkDuration = 15000;
      console.log('[JanusRecordingService] Adjusted for slow network');
    }
  }

  /**
   * Start recording
   */
  async startRecording() {
    try {
      if (this.isRecording) {
        console.warn('[JanusRecordingService] Recording already in progress');
        return false;
      }

      this.recordingId = `session-${this.sessionId}-${Date.now()}`;
      this.recordingStartTime = new Date();
      this.chunkNumber = 0;
      this.uploadedChunks.clear();
      this.failedChunks.clear();

      console.log(`[JanusRecordingService] Starting recording: ${this.recordingId}`);

      // Request display media - 720p
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          cursor: 'always',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude'
      });

      // Get audio
      const localStream = this.videoService.localStream;
      let audioTrack = null;
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTrack = audioTracks[0];
        }
      }

      // Combine streams
      const stream = new MediaStream();
      displayStream.getVideoTracks().forEach(track => stream.addTrack(track));
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }

      this.displayStream = displayStream;

      const recorderFormat = this.getSupportedRecorderFormat();
      this.chunkMimeType = recorderFormat.mimeType || 'video/webm';
      this.chunkFileExtension = recorderFormat.extension;

      // Create MediaRecorder using the best supported browser format
      this.currentChunkData = [];
      this.mediaRecorder = recorderFormat.mimeType
        ? new MediaRecorder(stream, {
          mimeType: recorderFormat.mimeType,
          videoBitsPerSecond: 1800000,
          audioBitsPerSecond: 192000
        })
        : new MediaRecorder(stream, {
          videoBitsPerSecond: 1800000,
          audioBitsPerSecond: 192000
        });

      console.log(`[JanusRecordingService] Recorder format: ${this.chunkMimeType || 'browser-default'}`);

      // Handle data available - accumulate data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.currentChunkData.push(event.data);
          const totalSize = this.currentChunkData.reduce((a, b) => a + b.size, 0);
          console.log(`[JanusRecordingService] Data chunk: ${event.data.size} bytes (total: ${totalSize} bytes)`);
        }
      };

      // Handle stop
      this.mediaRecorder.onstop = async () => {
        console.log('[JanusRecordingService] MediaRecorder stopped');
        await this.finalizeRecording();
      };

      // ✅ KEY FIX: Start with timeslice parameter
      // This makes MediaRecorder automatically call ondataavailable every chunkDuration ms
      this.mediaRecorder.start(this.config.chunkDuration);
      this.isRecording = true;

      // ✅ Upload chunks as they accumulate
      this.startChunkUploadTimer();

      if (this.onRecordingStateChange) {
        this.onRecordingStateChange('recording');
      }

      console.log('[JanusRecordingService] Recording started');
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
   * Start timer to upload chunks
   */
  startChunkUploadTimer() {
    // Wait a bit for data to accumulate, then start checking for uploads
    this.chunkExtractionTimer = setInterval(() => {
      if (this.isRecording && this.currentChunkData.length > 0 && !this.isUploading) {
        this.uploadCurrentChunk();
      }
    }, 2000); // Check every 2 seconds if we have data to upload

    console.log('[JanusRecordingService] Chunk upload timer started');
  }

  /**
   * Calculate checksum
   */
  async calculateChecksum(blob) {
    try {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.warn('[JanusRecordingService] Checksum calculation failed');
      return null;
    }
  }

  /**
   * Upload current chunk
   */
  async uploadCurrentChunk() {
    if (this.currentChunkData.length === 0 || this.isUploading) {
      return;
    }

    // Snapshot and clear
    const chunkDataToUpload = this.currentChunkData;
    this.currentChunkData = [];

    this.isUploading = true;

    try {
      // Create blob
      const chunkBlob = new Blob(chunkDataToUpload, { type: this.chunkMimeType || 'video/webm' });
      const chunkSize = chunkBlob.size;

      if (chunkSize === 0) {
        console.log('[JanusRecordingService] Skipping empty chunk');
        this.isUploading = false;
        return;
      }

      const checksum = await this.calculateChecksum(chunkBlob);

      const formData = new FormData();
      formData.append('file', chunkBlob, `${this.recordingId}-chunk-${this.chunkNumber}.${this.chunkFileExtension}`);
      formData.append('session_id', String(this.sessionId));
      formData.append('recording_id', this.recordingId);
      formData.append('chunk_number', String(this.chunkNumber));
      if (checksum) {
        formData.append('checksum', checksum);
      }

      console.log(`[JanusRecordingService] Uploading chunk ${this.chunkNumber} (${chunkSize} bytes)...`);

      await sessionService.uploadRecordingChunk(formData);

      this.uploadedChunks.add(this.chunkNumber);
      this.failedChunks.delete(this.chunkNumber);
      this.chunkNumber++;

      console.log(`[JanusRecordingService] ✅ Chunk ${this.chunkNumber - 1} uploaded`);

      if (this.onChunkUploaded) {
        this.onChunkUploaded({
          chunkNumber: this.chunkNumber - 1,
          size: chunkSize,
          uploadedChunks: this.uploadedChunks.size
        });
      }
    } catch (error) {
      console.error('[JanusRecordingService] Error uploading chunk:', error);

      this.failedChunks.set(this.chunkNumber, {
        data: chunkDataToUpload,
        retries: 0
      });

      this.addToRetryQueue(this.chunkNumber);

      if (this.onRecordingError) {
        this.onRecordingError({
          type: 'chunk_upload_failed',
          chunkNumber: this.chunkNumber,
          error
        });
      }

      this.chunkNumber++;
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Add to retry queue
   */
  addToRetryQueue(chunkNumber) {
    if (!this.retryQueue.includes(chunkNumber)) {
      this.retryQueue.push(chunkNumber);
      console.log(`[JanusRecordingService] Added chunk ${chunkNumber} to retry queue`);

      if (!this.retryInProgress) {
        this.processRetryQueue();
      }
    }
  }

  /**
   * Process retry queue
   */
  async processRetryQueue() {
    if (this.retryInProgress || this.retryQueue.length === 0) {
      return;
    }

    this.retryInProgress = true;

    while (this.retryQueue.length > 0) {
      const chunkNumber = this.retryQueue.shift();
      const failedChunk = this.failedChunks.get(chunkNumber);

      if (!failedChunk) {
        continue;
      }

      if (failedChunk.retries >= this.config.maxRetries) {
        console.error(`[JanusRecordingService] Max retries for chunk ${chunkNumber}`);
        this.failedChunks.delete(chunkNumber);
        continue;
      }

      failedChunk.retries++;

      try {
        console.log(`[JanusRecordingService] Retrying chunk ${chunkNumber}...`);

        const chunkBlob = new Blob(failedChunk.data, { type: this.chunkMimeType || 'video/webm' });
        const checksum = await this.calculateChecksum(chunkBlob);

        const formData = new FormData();
        formData.append('file', chunkBlob, `${this.recordingId}-chunk-${chunkNumber}.${this.chunkFileExtension}`);
        formData.append('session_id', String(this.sessionId));
        formData.append('recording_id', this.recordingId);
        formData.append('chunk_number', String(chunkNumber));
        if (checksum) {
          formData.append('checksum', checksum);
        }

        await sessionService.uploadRecordingChunk(formData);

        this.uploadedChunks.add(chunkNumber);
        this.failedChunks.delete(chunkNumber);
        console.log(`[JanusRecordingService] ✅ Chunk ${chunkNumber} uploaded on retry`);
      } catch (error) {
        console.error(`[JanusRecordingService] Retry failed for chunk ${chunkNumber}`);
        this.retryQueue.push(chunkNumber);
      }

      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    }

    this.retryInProgress = false;
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.warn('[JanusRecordingService] No recording in progress');
        return false;
      }

      return new Promise((resolve, reject) => {
        this.mediaRecorder.onstop = async () => {
          try {
            // Clear timer
            if (this.chunkExtractionTimer) {
              clearInterval(this.chunkExtractionTimer);
            }

            // Upload remaining chunks
            if (this.currentChunkData.length > 0) {
              await this.uploadCurrentChunk();
            }

            // Wait for retries
            await this.processRetryQueue();

            // Finalize
            const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            await this.finalizeRecordingOnServer(duration);

            this.isRecording = false;
            this.currentChunkData = [];
            this.mediaRecorder = null;

            if (this.displayStream) {
              this.displayStream.getTracks().forEach(track => track.stop());
              this.displayStream = null;
            }

            console.log(`[JanusRecordingService] Recording stopped: ${this.recordingId} (${duration}s, ${this.uploadedChunks.size} chunks)`);

            if (this.onRecordingStateChange) {
              this.onRecordingStateChange('stopped');
            }

            resolve(true);
          } catch (error) {
            console.error('[JanusRecordingService] Error finalizing:', error);
            if (this.onRecordingError) {
              this.onRecordingError(error);
            }
            reject(error);
          }
        };

        this.mediaRecorder.stop();
      });
    } catch (error) {
      console.error('[JanusRecordingService] Error stopping:', error);
      if (this.onRecordingError) {
        this.onRecordingError(error);
      }
      return false;
    }
  }

  /**
   * Finalize on server
   */
  async finalizeRecordingOnServer(duration) {
    try {
      console.log('[JanusRecordingService] Finalizing on server...');

      const finalizationData = {
        recording_id: this.recordingId,
        session_id: this.sessionId,
        duration: duration,
        total_chunks: this.chunkNumber,
        uploaded_chunks: Array.from(this.uploadedChunks),
        failed_chunks: Array.from(this.failedChunks.keys())
      };

      const response = await sessionService.finalizeRecording(finalizationData);
      console.log('[JanusRecordingService] ✅ Finalized:', response);
      return response;
    } catch (error) {
      console.error('[JanusRecordingService] Finalization error:', error);
      throw error;
    }
  }

  /**
   * Get status
   */
  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      recordingId: this.recordingId,
      startTime: this.recordingStartTime,
      duration: this.isRecording ? Math.floor((Date.now() - this.recordingStartTime) / 1000) : 0,
      currentChunk: this.chunkNumber,
      uploadedChunks: this.uploadedChunks.size,
      failedChunks: this.failedChunks.size,
      isUploading: this.isUploading
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.chunkExtractionTimer) {
      clearInterval(this.chunkExtractionTimer);
    }

    if (this.isRecording) {
      this.stopRecording();
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.displayStream) {
      this.displayStream.getTracks().forEach(track => track.stop());
    }

    this.currentChunkData = [];
    this.uploadedChunks.clear();
    this.failedChunks.clear();
    this.retryQueue = [];
  }

  /**
   * Finalize callback
   */
  async finalizeRecording() {
    console.log('[JanusRecordingService] Recording finalized');
  }
}

export default JanusRecordingServiceOptimized;