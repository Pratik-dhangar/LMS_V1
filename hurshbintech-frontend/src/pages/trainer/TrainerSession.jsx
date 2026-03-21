// TrainerSession.jsx - Trainer Live Session Interface
// Uses shared InstructorSessionPage component and custom hooks
// Manages Observer connections, Recording, and Learner-specific logic

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionService from '../../api/services/sessionService';
import sessionReportService from '../../api/services/sessionReportService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import JanusRecordingServiceOptimized from '../../api/services/janusServiceOptimized';
import useVoiceInput from '../../hooks/useVoiceInput';
import useStopwatch from '../../hooks/useStopwatch';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { useMediaControl } from '../../context/MediaControlContext';
import useInstructorSessionState from '../../hooks/useInstructorSessionState';
import useInstructorHandlers from '../../hooks/useInstructorHandlers';
import useInstructorEffects from '../../hooks/useInstructorEffects';
import LearningProgramSidebar from './LearningProgramSidebar';
import { clearSessionActivity } from '../../utils/sessionActivityTracker';
import {
  WB_BUTTON_STYLES,
  MUSIC_OPTIONS,
  getWSBaseURL,
  initializeWhiteboardService,
  initializeToolsService,
  cleanupSessionResources,
  InstructorSessionPage,
} from '../../components/session/InstructorSessionLayout';
import '../../styles/session.css';

const WS_BASE_URL = getWSBaseURL();

const TrainerSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Custom hooks for state, handlers, and effects
  const state = useInstructorSessionState('trainer');
  const stopwatch = useStopwatch();
  const mediaControl = useMediaControl();
  const { toggleListening, listening, transcript } = useVoiceInput();
  const { pageClassName, navbarClassName } = useAutoHideNavbar();

  // Admit/reject state for learner join requests
  const [pendingAdmission, setPendingAdmission] = useState(null);
  const [isReinforcementValueVisible, setIsReinforcementValueVisible] = useState(true);
  const reinforcementVisibilityRef = React.useRef(true);

  // Recording UI state
  const [recordingStatus, setRecordingStatus] = useState(null); // null, 'recording', 'paused', 'stopped'
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);

  React.useEffect(() => {
    reinforcementVisibilityRef.current = isReinforcementValueVisible;
  }, [isReinforcementValueVisible]);

  // Cleanup function
  const cleanup = () => {
    cleanupSessionResources({
      videoService: state.videoService,
      whiteboardService: state.whiteboardService,
      toolsService: state.toolsService,
      recordingService: state.recordingService,
      secondaryVideoService: state.observerRTC,
      isInitializingRef: state.isInitializingRef,
    });
    state.observerInitializedRef.current = false;
    state.timersRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    state.timersRef.current.clear();
    state.stopwatchesRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    state.stopwatchesRef.current.clear();
    clearSessionActivity(sessionId, 'trainer');
  };

  // Initialize WebRTC for Learner (with Observer hooks)
  const initializeWebRTC = async (numericSessionId) => {
    if (state.isInitializingRef.current) return;
    state.isInitializingRef.current = true;

    // Initialize Whiteboard
    const wbService = initializeWhiteboardService({
      wsBaseUrl: WS_BASE_URL,
      sessionId,
      role: 'trainer',
      setBuckets: state.setBuckets,
      setFloatingAnimations: state.setFloatingAnimations,
      setErasePenTrigger: state.setErasePenTrigger,
      setRedrawCanvasTrigger: state.setRedrawCanvasTrigger,
    });

    if (wbService) {
      state.setWhiteboardService(wbService);
      const tbService = initializeToolsService(wbService);
      state.setToolsService(tbService);
    }

    // Initialize Learner Video Conference with Observer event hooks
    const learnerVideoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'trainer');

    try {
      learnerVideoService.onLocalStream = (stream) => state.setLocalStream(stream);
      learnerVideoService.onRemoteStream = (stream) => {
        state.setRemoteStream(stream);
        learnerVideoService.sendReinforcementVisibility(reinforcementVisibilityRef.current);
        if (!state.connectedRef.current) {
          state.connectedRef.current = true;
          toast.success(`${state.sessionInfo?.learner_name || 'Learner'} has joined the session`);
        }
      };

      learnerVideoService.onConnectionStateChange = (stateStr) => {
        const statusMap = {
          'new': 'connecting', 'connecting': 'connecting', 'connected': 'connected',
          'disconnected': 'disconnected', 'failed': 'failed', 'closed': 'disconnected',
        };
        state.setConnectionStatus(statusMap[stateStr] || stateStr);

        if ((stateStr === 'disconnected' || stateStr === 'closed') && state.connectedRef.current) {
          toast.info(`${state.sessionInfo?.learner_name || 'Learner'} has left the session`);
          state.setRemoteStream(null);
          state.connectedRef.current = false;
        }
      };

      learnerVideoService.onError = (error) => {
        toast.error(`Video error: ${error.message}`);
      };

      // Observer event hooks
      learnerVideoService.onObserverJoined = (observerUserData) => {
        state.setObserverData(observerUserData);
        state.setShowObserverModal(true);
      };

      learnerVideoService.onObserverLeft = () => {
        toast.info('Observer left the session', { autoClose: 2000, position: 'top-center' });
        if (state.observerRTC) {
          state.observerRTC.close();
          state.setObserverRTC(null);
          state.observerInitializedRef.current = false;
        }
      };

      learnerVideoService.onParticipantJoinRequest = () => {
        const learnerName = state.sessionInfo?.learner_name || 'Learner';
        setPendingAdmission({ name: learnerName });
      };

      await learnerVideoService.initialize();
      state.setVideoService(learnerVideoService);

      // Initialize Optimized Recording Service with chunked uploads
      const recService = new JanusRecordingServiceOptimized(learnerVideoService, numericSessionId, {
        chunkDuration: 10000,              // Upload every 10 seconds
        enableAdaptiveQuality: true,       // Auto-adjust for device
        maxRetries: 3,                     // Retry failed chunks
        bitrate: 1500000                   // 1.5 Mbps (reduced for low-end devices)
      });

      // Setup recording callbacks for UI updates
      recService.onRecordingStateChange = (state_str) => {
        console.log('[TrainerSession] Recording state changed:', state_str);
        setRecordingStatus(state_str);
        if (state_str === 'recording') {
          toast.info('🔴 Recording started', { autoClose: 2000 });
        } else if (state_str === 'stopped') {
          toast.info('⏹️ Recording stopped', { autoClose: 2000 });
        }
      };

      recService.onChunkUploaded = ({ chunkNumber, uploadedChunks }) => {
        console.log(`✅ Chunk ${chunkNumber} uploaded (Total: ${uploadedChunks})`);
      };

      recService.onUploadProgress = ({ uploadedChunks, totalChunks }) => {
        console.log(`📊 Upload progress: ${uploadedChunks}/${totalChunks} chunks`);
      };

      recService.onRecordingError = (error) => {
        console.error('[TrainerSession] Recording error:', error);
        if (error.type === 'chunk_upload_failed') {
          toast.warning(`⚠️ Chunk upload failed - retrying...`, { autoClose: 3000 });
        } else {
          toast.error(`Recording error: ${error.message || 'Unknown error'}`, { autoClose: 3000 });
        }
      };

      state.setRecordingService(recService);

      state.setMicEnabled(learnerVideoService.isMicrophoneEnabled());
      state.setCameraEnabled(learnerVideoService.isCameraEnabled());
    } catch (error) {
      toast.error('Failed to initialize video conference');
    }
  };

  // Initialize Observer connection
  const initializeObserverConnection = async () => {
    if (state.observerInitializedRef.current) return;
    state.observerInitializedRef.current = true;

    try {
      const observerVideoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'trainer', false, 'observer');
      observerVideoService.onError = (error) => {
        toast.error(`Observer connection error: ${error.message}`);
      };
      observerVideoService.onConnectionStateChange = (stateStr) => {
        console.log('[TrainerSession] OBSERVER connection state:', stateStr);
      };

      await observerVideoService.initialize();
      state.setObserverRTC(observerVideoService);

      setTimeout(async () => {
        try {
          await observerVideoService.startScreenShare('observer');
          toast.success('Screen sharing started for observer', { autoClose: 2000 });
        } catch (error) {
          if (error.name === 'NotAllowedError') {
            toast.warning('Screen sharing cancelled', { autoClose: 3000 });
          } else {
            toast.error('Failed to start screen sharing');
          }
        }
      }, 1000);
    } catch (error) {
      toast.error('Failed to initialize observer connection');
      state.observerInitializedRef.current = false;
    }
  };

  // Observer modal handler
  const handleObserverModalOk = async () => {
    state.setShowObserverModal(false);
    await initializeObserverConnection();
  };

  // Admission modal handlers
  const handleAdmitLearner = () => {
    setPendingAdmission(null);
    if (state.videoService) state.videoService.admitParticipant();
  };

  const handleRejectLearner = () => {
    setPendingAdmission(null);
    if (state.whiteboardService) {
      state.whiteboardService.send('waiting_message', { text: '__ADMISSION_REJECTED__' });
    }
  };

  // Remove learner from ongoing session
  const handleRemoveLearner = () => {
    const learnerName = state.sessionInfo?.learner_name || 'Learner';
    if (window.confirm(`Exit ${learnerName} from the session?`)) {
      state.whiteboardService?.send('waiting_message', { text: '__REMOVED_FROM_SESSION__' });
      toast.info(`${learnerName} has been removed from the session`);
    }
  };

  const handleToggleReinforcementValueVisibility = () => {
    setIsReinforcementValueVisible((prev) => {
      const next = !prev;
      reinforcementVisibilityRef.current = next;
      state.videoService?.sendReinforcementVisibility(next);
      return next;
    });
  };

  // Session report handler (Trainer only)
  const handleSaveReport = async (reportData) => {
    try {
      if (!reportData?.programName || reportData?.reinforcementMeter === null || reportData?.reinforcementMeter === undefined) {
        toast.error('Please select a program and reinforcement level');
        return;
      }

      const toPromptMeter = (value) => {
        if (value === null || value === undefined || value === '') return 'I';
        return String(value);
      };

      const toReinforcementMeter = (value) => {
        if (value === null || value === undefined || value === '') return null;

        if (value === 'Full') return 'Full';

        const numeric = Number(value);
        if (Number.isNaN(numeric)) return null;

        if (numeric >= 100) return 'Full';
        if (numeric <= 0) return '0';
        return String(numeric);
      };

      const reinforcementMeter = toReinforcementMeter(reportData.reinforcementMeter);
      const promptMeter = toPromptMeter(reportData.promptMeter);

      // Convert sessionId to integer and build report with API-required fields
      const numericSessionId = parseInt(sessionId) || state.sessionInfo?.id;
      const reportPayload = {
        session_id: numericSessionId,
        learner_id: state.sessionInfo?.learner_id,
        program_id: reportData.programId || null,
        program_name: reportData.programName,
        prompt_meter: promptMeter,
        reinforcement_meter: reinforcementMeter,
      };

      console.log('[TrainerSession] Saving report:', reportPayload);
      await sessionReportService.create(reportPayload);
      toast.success('Session report saved successfully');
      // Reset meters after successful save
      state.setSelectedPromptLevel(null);
      state.setSelectedReinforcementLevel(null);
      state.setSelectedProgramId(null);
    } catch (error) {
      console.error('[TrainerSession] Error saving report:', error);
      console.error('Response details:', error.response?.data);
      toast.error('Failed to save session report');
    }
  };

  // Recording control handlers
  const handleToggleRecording = async () => {
    try {
      if (!state.recordingService) {
        toast.error('Recording service not initialized');
        return;
      }

      if (recordingStatus === 'recording') {
        // Stop recording
        const success = await state.recordingService.stopRecording();
        if (success) {
          setRecordingStatus('stopped');
          setIsRecordingPaused(false);
          console.log('[TrainerSession] Recording stopped successfully');
        }
      } else {
        // Start recording
        const success = await state.recordingService.startRecording();
        if (success) {
          setRecordingStatus('recording');
          setIsRecordingPaused(false);
          console.log('[TrainerSession] Recording started successfully');
        }
      }
    } catch (error) {
      console.error('[TrainerSession] Recording toggle error:', error);
      toast.error(`Recording error: ${error.message}`);
    }
  };

  // For future implementation: pause/resume recording
  // Note: MediaRecorder API pause/resume requires different implementation
  const handlePauseResumeRecording = () => {
    try {
      if (!state.recordingService?.mediaRecorder) {
        toast.warning('Cannot pause - recording not active');
        return;
      }

      if (isRecordingPaused) {
        // Resume recording
        if (state.recordingService.mediaRecorder.state === 'paused') {
          state.recordingService.mediaRecorder.resume();
          setIsRecordingPaused(false);
          toast.info('▶️ Recording resumed', { autoClose: 2000 });
          console.log('[TrainerSession] Recording resumed');
        }
      } else {
        // Pause recording
        if (state.recordingService.mediaRecorder.state === 'recording') {
          state.recordingService.mediaRecorder.pause();
          setIsRecordingPaused(true);
          toast.info('⏸️ Recording paused', { autoClose: 2000 });
          console.log('[TrainerSession] Recording paused');
        }
      }
    } catch (error) {
      console.error('[TrainerSession] Pause/resume error:', error);
      toast.error(`Pause/resume error: ${error.message}`);
    }
  };

  // Use custom hooks for handlers and effects
  const handlers = useInstructorHandlers({
    role: 'trainer',
    sessionId,
    videoService: state.videoService,
    observerRTC: state.observerRTC,
    whiteboardService: state.whiteboardService,
    sessionNotes: state.sessionNotes,
    buckets: state.buckets,
    bucketColor: state.bucketColor,
    whiteboardCanvasRef: state.whiteboardCanvasRef,
    isFrozen: state.isFrozen,
    floatingAnimations: state.floatingAnimations,
    toolAccess: state.toolAccess,
    lineWidth: state.lineWidth,
    audioRef: state.audioRef,
    musicOptions: MUSIC_OPTIONS,
    selectedMusic: state.selectedMusic,
    backgroundMusicPlaying: state.backgroundMusicPlaying,
    musicVolume: state.musicVolume,
    sessionService,
    navigate,
    cleanup,
    setMicEnabled: state.setMicEnabled,
    setCameraEnabled: state.setCameraEnabled,
    setIsFrozen: state.setIsFrozen,
    setSessionNotes: state.setSessionNotes,
    setFloatingAnimations: state.setFloatingAnimations,
    setYoutubePopups: state.setYoutubePopups,
    setInlineYoutube: state.setInlineYoutube,
    setExerciseData: state.setExerciseData,
    setToolAccess: state.setToolAccess,
    setBuckets: state.setBuckets,
    setErasePenTrigger: state.setErasePenTrigger,
    setRedrawCanvasTrigger: state.setRedrawCanvasTrigger,
    setTool: state.setTool,
    setActiveIcons: state.setActiveIcons,
    setFeedbackMessage: state.setFeedbackMessage,
    setWaitingMessage: state.setWaitingMessage,
    setShowExercise: state.setShowExercise,
    isWaitActive: state.isWaitActive,
    setIsWaitActive: state.setIsWaitActive,
    setBackgroundMusicPlaying: state.setBackgroundMusicPlaying,
    setSelectedMusic: state.setSelectedMusic,
    setMusicVolume: state.setMusicVolume,
    setLearningContentSearch: state.setLearningContentSearch,
    setDatabaseSearchResults: state.setDatabaseSearchResults,
    setIsSearching: state.setIsSearching,
    setSelectedProgramId: state.setSelectedProgramId,
    setShowHeader: state.setShowHeader,
  });

  // Use effects hook
  useInstructorEffects({
    role: 'trainer',
    sessionId,
    sessionInfo: state.sessionInfo,
    sessionNotes: state.sessionNotes,
    whiteboardService: state.whiteboardService,
    remoteStream: state.remoteStream,
    remoteVideoRef: state.remoteVideoRef,
    stopwatch,
    lastSyncTimeRef: state.lastSyncTimeRef,
    mediaWasVisibleRef: state.mediaWasVisibleRef,
    mediaControl,
    learningContentSearch: state.learningContentSearch,
    learningGoalsSearch: state.learningGoalsSearch,
    restrictionAlertShownRef: state.restrictionAlertShownRef,
    floatingAnimations: state.floatingAnimations,
    sessionService,
    setSessionInfo: state.setSessionInfo,
    setLoading: state.setLoading,
    setSessionNotes: state.setSessionNotes,
    setTimeLeft: state.setTimeLeft,
    setRemoteSelectedItemIds: state.setRemoteSelectedItemIds,
    setFloatingAnimations: state.setFloatingAnimations,
    setExerciseData: state.setExerciseData,
    setBuckets: state.setBuckets,
    setErasePenTrigger: state.setErasePenTrigger,
    setRedrawCanvasTrigger: state.setRedrawCanvasTrigger,
    setShowStopwatch: state.setShowStopwatch,
    setDatabaseSearchResults: state.setDatabaseSearchResults,
    setIsSearching: state.setIsSearching,
    setFilteredLearningGoals: state.setFilteredLearningGoals,
    setDatabaseGoalsSearchResults: state.setDatabaseGoalsSearchResults,
    setIsSearchingGoals: state.setIsSearchingGoals,
    initializeWebRTC,
    cleanup,
    handleEndSession: handlers.handleEndSession,
  });

  // Sync stopwatch state to learner when it becomes 0 (reset)
  React.useEffect(() => {
    if (stopwatch?.elapsedTime === 0 && state.whiteboardService) {
      state.whiteboardService.send('stopwatch_sync', {
        elapsedTime: 0,
        isRunning: false
      });
    }
  }, [stopwatch?.elapsedTime, state.whiteboardService]);

  // Loading state
  if (state.loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  // Render session page
  const filteredLearningContent = state.learningContentSearch.trim()
    ? state.databaseSearchResults
    : (state.sessionInfo?.learning_contents || []);

  const wbBtnBase = WB_BUTTON_STYLES.base;
  const wbBtnActive = WB_BUTTON_STYLES.active;
  const wbSmallBtnBase = WB_BUTTON_STYLES.smallBase;
  const wbSmallBtnActive = WB_BUTTON_STYLES.smallActive;

  return (
    <>
      {/* Learner admission modal */}
      {pendingAdmission && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '36px 32px', maxWidth: '420px', width: '92%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>Learner Wants to Join</h2>
            <p style={{ color: '#555', marginBottom: '28px', fontSize: '15px' }}>
              <strong>{pendingAdmission.name}</strong> is requesting to join this session.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button
                onClick={handleAdmitLearner}
                style={{ padding: '10px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
              >
                ✅ Admit
              </button>
              <button
                onClick={handleRejectLearner}
                style={{ padding: '10px 28px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
              >
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      )}
      <InstructorSessionPage
        role="trainer"
        participantName="Learner"
        participantType="learner"
        pageClassName={pageClassName}
        navbarClassName={navbarClassName}
        showHeader={state.showHeader}
        showInfoBar={state.showInfoBar}
        setShowInfoBar={state.setShowInfoBar}
        sessionInfo={state.sessionInfo}
        connectionStatus={state.connectionStatus}
        timeLeft={state.timeLeft}
        micEnabled={state.micEnabled}
        cameraEnabled={state.cameraEnabled}
        handleToggleMic={handlers.handleToggleMic}
        handleToggleCamera={handlers.handleToggleCamera}
        handleFreeze={handlers.handleFreeze}
        handleRemoveParticipant={handleRemoveLearner}
        handleEndSession={handlers.handleEndSession}
        eraseAllPen={handlers.eraseAllPen}
        addBucket={handlers.addBucket}
        isFrozen={state.isFrozen}
        recordingStatus={recordingStatus}
        onToggleRecording={handleToggleRecording}
        onPauseResumeRecording={handlePauseResumeRecording}
        isPaused={isRecordingPaused}
        localStream={state.localStream}
        remoteStream={state.remoteStream}
        remoteVideoRef={state.remoteVideoRef}
        audioRef={state.audioRef}
        whiteboardService={state.whiteboardService}
        whiteboardCanvasRef={state.whiteboardCanvasRef}
        canvasItems={state.canvasItems}
        setCanvasItems={state.setCanvasItems}
        remoteSelectedItemIds={state.remoteSelectedItemIds}
        setRemoteSelectedItemIds={state.setRemoteSelectedItemIds}
        feedbackMessage={state.feedbackMessage}
        waitingMessage={state.waitingMessage}
        floatingAnimations={state.floatingAnimations}
        setFloatingAnimations={state.setFloatingAnimations}
        handleAnimationPop={handlers.handleAnimationPop}
        tool={state.tool}
        setTool={state.setTool}
        color={state.color}
        setColor={state.setColor}
        lineWidth={state.lineWidth}
        setLineWidth={state.setLineWidth}
        buckets={state.buckets}
        setBuckets={state.setBuckets}
        bucketColor={state.bucketColor}
        setBucketColor={state.setBucketColor}
        toolActive={state.toolActive}
        setToolActive={state.setToolActive}
        eraserActive={state.eraserActive}
        setEraserActive={state.setEraserActive}
        eraseAllActive={state.eraseAllActive}
        setEraseAllActive={state.setEraseAllActive}
        clearCanvasTrigger={state.clearCanvasTrigger}
        setClearCanvasTrigger={state.setClearCanvasTrigger}
        erasePenTrigger={state.erasePenTrigger}
        redrawCanvasTrigger={state.redrawCanvasTrigger}
        toolAccess={state.toolAccess}
        toggleToolAccess={handlers.toggleToolAccess}
        showExercise={state.showExercise}
        setShowExercise={state.setShowExercise}
        exerciseData={state.exerciseData}
        handleExerciseSubmit={handlers.handleExerciseSubmit}
        handleExerciseUpdate={handlers.handleExerciseUpdate}
        handleExerciseDelete={handlers.handleExerciseDelete}
        handleExerciseAnswerChange={handlers.handleExerciseAnswerChange}
        showStopwatch={state.showStopwatch}
        setShowStopwatch={state.setShowStopwatch}
        stopwatch={stopwatch}
        musicOptions={MUSIC_OPTIONS}
        toggleBackgroundMusic={handlers.toggleBackgroundMusic}
        selectedMusic={state.selectedMusic}
        backgroundMusicPlaying={state.backgroundMusicPlaying}
        musicVolume={state.musicVolume}
        handleMusicVolumeChange={handlers.handleMusicVolumeChange}
        sessionNotes={state.sessionNotes}
        handleNotesChange={handlers.handleNotesChange}
        handleClearNotes={handlers.handleClearNotes}
        learningContentSearch={state.learningContentSearch}
        handleLearningContentSearch={handlers.handleLearningContentSearch}
        filteredLearningContent={filteredLearningContent}
        isSearching={state.isSearching}
        onDragStartContent={handlers.onDragStartContent}
        filteredLearningGoals={state.filteredLearningGoals}
        selectedPromptLevel={state.selectedPromptLevel}
        setSelectedPromptLevel={state.setSelectedPromptLevel}
        selectedReinforcementLevel={state.selectedReinforcementLevel}
        setSelectedReinforcementLevel={state.setSelectedReinforcementLevel}
        selectedProgramId={state.selectedProgramId}
        handleProgramCheck={handlers.handleProgramCheck}
        webRTC={state.videoService}
        toggleListening={toggleListening}
        listening={listening}
        transcript={transcript}
        onSaveReport={handleSaveReport}
        youtubePopups={state.youtubePopups}
        handleYoutubeDropped={handlers.handleYoutubeDropped}
        handleCloseYoutubePopup={handlers.handleCloseYoutubePopup}
        inlineYoutube={state.inlineYoutube}
        setInlineYoutube={state.setInlineYoutube}
        activeIcons={state.activeIcons}
        isWaitActive={state.isWaitActive}
        handleToolClick={handlers.handleToolClick}
        wbBtnBase={wbBtnBase}
        wbBtnActive={wbBtnActive}
        wbSmallBtnBase={wbSmallBtnBase}
        wbSmallBtnActive={wbSmallBtnActive}
        handleHeaderClick={handlers.handleHeaderClick}
        showObserverModal={state.showObserverModal}
        observerData={state.observerData}
        handleObserverModalOk={handleObserverModalOk}
        LeftSidebarComponent={
          <LearningProgramSidebar
            sessionInfo={state.sessionInfo}
            filteredLearningGoals={state.filteredLearningGoals}
            selectedPromptLevel={state.selectedPromptLevel}
            setSelectedPromptLevel={state.setSelectedPromptLevel}
            selectedReinforcementLevel={state.selectedReinforcementLevel}
            setSelectedReinforcementLevel={state.setSelectedReinforcementLevel}
            reinforcementValueVisible={isReinforcementValueVisible}
            onToggleReinforcementValueVisibility={handleToggleReinforcementValueVisibility}
            selectedProgramId={state.selectedProgramId}
            handleProgramCheck={handlers.handleProgramCheck}
            webRTC={state.videoService}
            toggleListening={toggleListening}
            listening={listening}
            transcript={transcript}
            whiteboardService={state.whiteboardService}
            onSaveReport={handleSaveReport}
          />
        }
      />
    </>
  );
};

export default TrainerSession;
